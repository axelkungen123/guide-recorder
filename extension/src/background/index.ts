import * as recorder from "./recorder";
import { enqueueCapture } from "./screenshotQueue";
import { uploadRecording } from "./uploader";
import type {
  AckResponse,
  ErrorResponse,
  RuntimeMessage,
  StateResponse,
  StepCapturedMessage,
  StepsResponse,
} from "../shared/messages";

/**
 * Background service worker: owns recording state, injects the content script,
 * captures screenshots (content scripts can't call captureVisibleTab), and
 * buffers steps.
 */

const CONTENT_SCRIPT = "content.js";

type Response =
  | StateResponse
  | StepsResponse
  | AckResponse
  | ErrorResponse;

async function startRecording(): Promise<StateResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error("No active tab to record");
  const state = await recorder.startRecording(tab.id);
  await injectContentScript(tab.id);
  return { ok: true, state };
}

async function stopRecording(): Promise<StepsResponse> {
  const current = await recorder.getState();
  if (current.tabId != null) {
    try {
      await chrome.tabs.sendMessage(current.tabId, { type: "STOP_LISTENING" });
    } catch {
      // Content script may already be gone (tab closed/navigated) — fine.
    }
  }
  const state = await recorder.stopRecording();
  const steps = await recorder.getSteps();
  console.log(
    `[guide-recorder] Recording stopped — ${steps.length} step(s):`,
  );
  console.log(JSON.stringify(steps, null, 2));

  const upload = await uploadRecording(steps);
  console.log("[guide-recorder] upload result:", upload);

  return { ok: true, state, steps, upload };
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [CONTENT_SCRIPT],
  });
}

async function handleStepCaptured(
  message: StepCapturedMessage,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const state = await recorder.getState();
  if (!state.isRecording) return;
  // Only record clicks coming from the tab we're recording.
  if (sender.tab?.id != null && sender.tab.id !== state.tabId) return;

  const index = await recorder.appendStep(message.step);

  const windowId = sender.tab?.windowId;
  if (windowId == null) {
    await recorder.setScreenshot(index, null, "missing windowId");
    return;
  }
  try {
    const dataUrl = await enqueueCapture(windowId);
    await recorder.setScreenshot(index, dataUrl);
  } catch (err) {
    await recorder.setScreenshot(index, null, String(err));
  }
}

// Route runtime messages. Returns true to keep the channel open for the async
// sendResponse.
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse: (r: Response) => void) => {
    void (async () => {
      switch (message.type) {
        case "START_RECORDING":
          sendResponse(await startRecording());
          break;
        case "STOP_RECORDING":
          sendResponse(await stopRecording());
          break;
        case "GET_STATE":
          sendResponse({ ok: true, state: await recorder.getState() });
          break;
        case "GET_STEPS": {
          const [state, steps] = await Promise.all([
            recorder.getState(),
            recorder.getSteps(),
          ]);
          sendResponse({ ok: true, state, steps });
          break;
        }
        case "STEP_CAPTURED":
          await handleStepCaptured(message, sender);
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: "Unknown message" });
      }
    })().catch((err: unknown) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  },
);

// Re-inject the content script after navigations so recording continues across
// page loads within the recorded tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  void (async () => {
    const state = await recorder.getState();
    if (!state.isRecording || state.tabId !== tabId) return;
    try {
      await injectContentScript(tabId);
    } catch {
      // e.g. chrome:// or other restricted pages — nothing to record there.
    }
  })();
});
