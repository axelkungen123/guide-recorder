/**
 * Capture types now live in @guide-recorder/shared (single source of truth,
 * shared with api/ and web/). Re-exported here so existing imports keep working.
 * RecordingState is extension-internal and stays local.
 */
export type {
  BoundingBox,
  Viewport,
  ElementContext,
  Step,
} from "@guide-recorder/shared";

/** Recording status, persisted so it survives service-worker restarts. */
export interface RecordingState {
  isRecording: boolean;
  /** Tab being recorded. */
  tabId: number | null;
  startedAt: number | null;
  stepCount: number;
}
