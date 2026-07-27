/**
 * Mirrors extension/src/shared/types.ts. Kept as an independent copy so api/ has
 * no build-time coupling to the extension. If these drift, unify them into a
 * shared workspace package later.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementContext {
  selector: string;
  selectorStrategy: string;
  text: string;
  urlPattern: string;
  boundingBox: BoundingBox;
  inShadowDom: boolean;
  inIframe: boolean;
  frameUrl: string;
}

/** A step exactly as the extension emits it (screenshot is a data URL or null). */
export interface IncomingStep {
  index: number;
  timestamp: number;
  url: string;
  elementContext: ElementContext;
  screenshot: string | null;
  screenshotError?: string;
}

/** POST /recordings body. */
export interface IncomingRecording {
  steps: IncomingStep[];
  /** Optional client-supplied label. */
  title?: string;
}

// --- API response shapes ---

export interface RecordingSummary {
  id: string;
  createdAt: number;
  stepCount: number;
  firstUrl: string | null;
  title: string | null;
}

/** A stored step; screenshot is exposed as a URL, not inline base64. */
export interface StoredStep {
  index: number;
  timestamp: number;
  url: string;
  elementContext: ElementContext;
  screenshotUrl: string | null;
  screenshotError?: string;
}

export interface RecordingDetail extends RecordingSummary {
  steps: StoredStep[];
}
