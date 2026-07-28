/**
 * Types now come from @guide-recorder/shared (single source of truth). Re-exported
 * here so the rest of api/ can keep importing from "./types.ts". `IncomingStep` is
 * this workspace's local name for the shared `Step`.
 */
export type {
  BoundingBox,
  Viewport,
  ElementContext,
  Step as IncomingStep,
  IncomingRecording,
  RecordingSummary,
  StoredStep,
  RecordingDetail,
} from "@guide-recorder/shared";
