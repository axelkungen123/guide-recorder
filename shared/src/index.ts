/**
 * Single source of truth for types shared across the monorepo.
 *
 * These are all *type-only* declarations (interfaces), so importing this package
 * compiles away to nothing at runtime — the extension (esbuild), api (native TS
 * on Node), and web (Vite) each just typecheck against it.
 */

// ---------------------------------------------------------------------------
// Capture types — produced by the extension, ingested by the api.
// ---------------------------------------------------------------------------

/** Position + size relative to the (frame's) viewport, in CSS pixels. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The frame's viewport at capture time — needed to map a bbox onto a screenshot. */
export interface Viewport {
  /** CSS px (frame innerWidth). */
  width: number;
  /** CSS px (frame innerHeight). */
  height: number;
  devicePixelRatio: number;
}

/** Structured context for a clicked element — the core of the spike. */
export interface ElementContext {
  selector: string;
  selectorStrategy: string;
  text: string;
  urlPattern: string;
  boundingBox: BoundingBox;
  /** Viewport the boundingBox is relative to (rides in the context blob). */
  viewport: Viewport;
  inShadowDom: boolean;
  inIframe: boolean;
  frameUrl: string;
}

/** A single recorded step, exactly as the extension emits it. */
export interface Step {
  index: number;
  timestamp: number;
  url: string;
  elementContext: ElementContext;
  /** PNG data URL of the visible tab, or null if capture failed. */
  screenshot: string | null;
  screenshotError?: string;
}

/** POST /recordings body. */
export interface IncomingRecording {
  steps: Step[];
  title?: string;
}

// ---------------------------------------------------------------------------
// API response DTOs — produced by the api, consumed by the web viewer.
// ---------------------------------------------------------------------------

export interface RecordingSummary {
  id: string;
  createdAt: number;
  stepCount: number;
  firstUrl: string | null;
  title: string | null;
}

/** A stored step; the screenshot is exposed as a URL, not inline base64. */
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
