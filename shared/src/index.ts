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

// ---------------------------------------------------------------------------
// Locators — a small, typed selector language beyond raw CSS. The extension
// emits a ranked list (best first); downstream (viewer, future replay / guide
// generation) can render or try them in order.
// ---------------------------------------------------------------------------

export type LocatorKind = "testid" | "role" | "text" | "css";

/** A test-id attribute anchor, e.g. [data-testid="save"]. */
export interface TestIdLocator {
  kind: "testid";
  attr: string;
  value: string;
}

/** An ARIA role + accessible name, e.g. getByRole('button', { name: 'Save' }). */
export interface RoleLocator {
  kind: "role";
  role: string;
  name?: string;
}

/** Visible text, e.g. getByText('Save'). */
export interface TextLocator {
  kind: "text";
  value: string;
  exact: boolean;
}

/** A CSS path (with " >> " for shadow hops) — the last-resort fallback. */
export interface CssLocator {
  kind: "css";
  value: string;
}

export type Locator = TestIdLocator | RoleLocator | TextLocator | CssLocator;

/** How trustworthy the primary locator is for re-finding the element later. */
export type SelectorRobustness = "anchored" | "mixed" | "positional";

/** A capture-time assessment of selector/locator quality (heuristic). */
export interface SelectorQuality {
  /** Grade of the PRIMARY (best) locator. */
  robustness: SelectorRobustness;
  /** Kind of the primary locator (optional: predates older recordings). */
  primaryKind?: LocatorKind;
  /** The primary locator relies on a stable anchor / semantic identity. */
  hasStableAnchor: boolean;
  /** CSS-fallback metric: combinator-separated path segments. */
  depth: number;
  /** CSS-fallback metric: shadow-DOM boundary hops (" >> "). */
  shadowHops: number;
  /** CSS-fallback metric: segments relying on DOM position (:nth-of-type). */
  positionalSegments: number;
  /** Short human-readable reasons for the rating. */
  notes: string[];
}

/** Structured context for a clicked element — the core of the spike. */
export interface ElementContext {
  /** Display string of the primary (best) locator. */
  selector: string;
  selectorStrategy: string;
  /** Ranked locators, best first (optional: predates older recordings). */
  locators?: Locator[];
  /** Robustness assessment of the primary locator (optional: predates older). */
  selectorQuality?: SelectorQuality;
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

// ---------------------------------------------------------------------------
// Guide — a deterministic, human-readable rendering of a recording. `action`
// and `target` are kept separate so consumers can style the target (bold or
// code) without parsing markdown.
// ---------------------------------------------------------------------------

export interface GuideStep {
  /** 1-based step number in the guide. */
  index: number;
  /** Instruction verb phrase, e.g. "Klicka på länken". */
  action: string;
  /** The element's name/text, e.g. "Prenumerationer" (absent when unknown). */
  target?: string;
  /** Render `target` as code (a raw selector) rather than emphasized text. */
  targetIsCode?: boolean;
  screenshotUrl: string | null;
  url: string;
  /** Set when the page (url_pattern) changed from the previous step. */
  navigatedTo?: string;
}

export interface Guide {
  title: string;
  createdAt: number;
  startUrl: string | null;
  steps: GuideStep[];
}
