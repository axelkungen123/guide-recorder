import type { StepPayload } from "../shared/messages";
import type { RecordingState, Step } from "../shared/types";

/**
 * Recording buffer + state, persisted in chrome.storage.local so it survives
 * MV3 service-worker restarts. All mutations are serialized through a single
 * promise chain to avoid lost-update races between concurrent read-modify-write
 * operations (append step vs. fill-in screenshot).
 */

const STATE_KEY = "recordingState";
const STEPS_KEY = "steps";

const DEFAULT_STATE: RecordingState = {
  isRecording: false,
  tabId: null,
  startedAt: null,
  stepCount: 0,
};

let writeChain: Promise<unknown> = Promise.resolve();

/** Run `fn` after any in-flight mutation completes. */
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  // Keep the chain alive even if this op rejects.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function getState(): Promise<RecordingState> {
  const res = await chrome.storage.local.get(STATE_KEY);
  return (res[STATE_KEY] as RecordingState | undefined) ?? DEFAULT_STATE;
}

export async function getSteps(): Promise<Step[]> {
  const res = await chrome.storage.local.get(STEPS_KEY);
  return (res[STEPS_KEY] as Step[] | undefined) ?? [];
}

export function startRecording(tabId: number): Promise<RecordingState> {
  return serialize(async () => {
    const state: RecordingState = {
      isRecording: true,
      tabId,
      startedAt: Date.now(),
      stepCount: 0,
    };
    await chrome.storage.local.set({ [STATE_KEY]: state, [STEPS_KEY]: [] });
    return state;
  });
}

export function stopRecording(): Promise<RecordingState> {
  return serialize(async () => {
    const current = await getState();
    const next: RecordingState = { ...current, isRecording: false };
    await chrome.storage.local.set({ [STATE_KEY]: next });
    return next;
  });
}

/** Append a step (screenshot filled in later). Returns its index. */
export function appendStep(payload: StepPayload): Promise<number> {
  return serialize(async () => {
    const [steps, state] = await Promise.all([getSteps(), getState()]);
    const index = steps.length;
    const step: Step = { ...payload, index, screenshot: null };
    steps.push(step);
    await chrome.storage.local.set({
      [STEPS_KEY]: steps,
      [STATE_KEY]: { ...state, stepCount: steps.length },
    });
    return index;
  });
}

/** Attach a screenshot (or error) to a previously appended step. */
export function setScreenshot(
  index: number,
  screenshot: string | null,
  error?: string,
): Promise<void> {
  return serialize(async () => {
    const steps = await getSteps();
    const step = steps[index];
    if (!step) return;
    step.screenshot = screenshot;
    if (error) step.screenshotError = error;
    await chrome.storage.local.set({ [STEPS_KEY]: steps });
  });
}
