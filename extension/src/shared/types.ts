/** Position + size relative to the (frame's) viewport, in CSS pixels. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The structured context captured for the clicked element.
 * This is the core of the spike — keep it stable and self-describing.
 */
export interface ElementContext {
  /** Selector produced by the active SelectorStrategy. */
  selector: string;
  /** Name/version of the strategy that produced `selector` (for later swaps). */
  selectorStrategy: string;
  /** Visible/accessible text of the element (normalized, truncated). */
  text: string;
  /** The page URL with dynamic path segments generalized (e.g. /orders/:id). */
  urlPattern: string;
  /** Element bounding box relative to the frame viewport. */
  boundingBox: BoundingBox;
  /** True if the element lives inside a shadow root. */
  inShadowDom: boolean;
  /** True if the click happened inside an iframe (not the top document). */
  inIframe: boolean;
  /** location.href of the frame the click happened in. */
  frameUrl: string;
}

/** A single recorded step. */
export interface Step {
  /** 0-based order within the recording. */
  index: number;
  /** Epoch milliseconds when the click was captured. */
  timestamp: number;
  /** Full page URL (top frame) at capture time. */
  url: string;
  elementContext: ElementContext;
  /** PNG data URL of the visible tab, filled in asynchronously. */
  screenshot: string | null;
  /** Set if the screenshot could not be captured. */
  screenshotError?: string;
}

/** Recording status, persisted so it survives service-worker restarts. */
export interface RecordingState {
  isRecording: boolean;
  /** Tab being recorded. */
  tabId: number | null;
  startedAt: number | null;
  stepCount: number;
}
