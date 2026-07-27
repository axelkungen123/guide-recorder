import type { RecordingState, Step } from "./types";

/** The step fields the content script sends; background adds index + screenshot. */
export type StepPayload = Pick<Step, "timestamp" | "url" | "elementContext">;

// --- content -> background ---
export interface StepCapturedMessage {
  type: "STEP_CAPTURED";
  step: StepPayload;
}

// --- popup -> background ---
export interface StartRecordingMessage {
  type: "START_RECORDING";
}
export interface StopRecordingMessage {
  type: "STOP_RECORDING";
}
export interface GetStateMessage {
  type: "GET_STATE";
}
export interface GetStepsMessage {
  type: "GET_STEPS";
}

// --- background -> content ---
export interface StopListeningMessage {
  type: "STOP_LISTENING";
}

export type RuntimeMessage =
  | StepCapturedMessage
  | StartRecordingMessage
  | StopRecordingMessage
  | GetStateMessage
  | GetStepsMessage
  | StopListeningMessage;

// --- responses (background -> caller) ---
export interface StateResponse {
  ok: true;
  state: RecordingState;
}
export interface StepsResponse {
  ok: true;
  state: RecordingState;
  steps: Step[];
}
export interface AckResponse {
  ok: true;
}
export interface ErrorResponse {
  ok: false;
  error: string;
}
