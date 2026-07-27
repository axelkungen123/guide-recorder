import { extractStep } from "./extract";
import type { RuntimeMessage, StepCapturedMessage } from "../shared/messages";

/**
 * Content script: listens for clicks while recording and forwards structured
 * step payloads to the background service worker (which takes the screenshot).
 *
 * Injected on demand via chrome.scripting.executeScript (allFrames: true), and
 * re-injected after navigations, so it guards against double-installation.
 */

declare global {
  interface Window {
    __guideRecorderActive?: boolean;
  }
}

if (!window.__guideRecorderActive) {
  window.__guideRecorderActive = true;

  const onClick = (event: MouseEvent): void => {
    try {
      const payload = extractStep(event);
      if (!payload) return;
      const message: StepCapturedMessage = {
        type: "STEP_CAPTURED",
        step: payload,
      };
      // Fire-and-forget; ignore "no receiver" errors if the SW is asleep/gone.
      void chrome.runtime.sendMessage(message).catch(() => {});
    } catch (err) {
      console.warn("[guide-recorder] failed to capture click", err);
    }
  };

  // Capture phase: we still see the click even if the app calls
  // stopPropagation() during bubbling.
  document.addEventListener("click", onClick, true);

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "STOP_LISTENING") {
      document.removeEventListener("click", onClick, true);
      window.__guideRecorderActive = false;
    }
  });
}
