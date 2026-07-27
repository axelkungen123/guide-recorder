import { getSelectorStrategy } from "../selector";
import type { StepPayload } from "../shared/messages";
import type { BoundingBox, ElementContext } from "../shared/types";

const MAX_TEXT = 200;

/** Build a step payload from a click event, or null if unusable. */
export function extractStep(event: MouseEvent): StepPayload | null {
  const target = resolveTarget(event);
  if (!target) return null;

  const strategy = getSelectorStrategy();
  const rect = target.getBoundingClientRect();
  const boundingBox: BoundingBox = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };

  const path = safeComposedPath(event);
  const context: ElementContext = {
    selector: strategy.generate(target),
    selectorStrategy: strategy.name,
    text: normalizeText(getVisibleText(target)),
    urlPattern: toUrlPattern(location.href),
    boundingBox,
    inShadowDom: path.some((n) => n instanceof ShadowRoot),
    inIframe: window.top !== window.self,
    frameUrl: location.href,
  };

  return {
    timestamp: Date.now(),
    url: location.href,
    elementContext: context,
  };
}

/**
 * The actual clicked element, piercing shadow DOM via composedPath().
 * event.target only gives the shadow host for elements inside a shadow root.
 */
function resolveTarget(event: MouseEvent): Element | null {
  const path = safeComposedPath(event);
  const first = path.find((n): n is Element => n instanceof Element);
  if (first) return first;
  return event.target instanceof Element ? event.target : null;
}

function safeComposedPath(event: MouseEvent): EventTarget[] {
  try {
    return typeof event.composedPath === "function" ? event.composedPath() : [];
  } catch {
    return [];
  }
}

function getVisibleText(el: Element): string {
  const own = (el as HTMLElement).innerText ?? el.textContent ?? "";
  if (own.trim()) return own;
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const title = el.getAttribute("title");
  if (title) return title;
  const value = (el as HTMLInputElement).value;
  if (typeof value === "string" && value) return value;
  return "";
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

/**
 * Generalize dynamic path segments so steps on the "same" screen group together.
 * e.g. https://app/orders/4213/items -> https://app/orders/:id/items
 * Query string is dropped from the pattern. Easy to swap out later.
 */
export function toUrlPattern(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const path = url.pathname
    .split("/")
    .map((seg) => (seg && isDynamicSegment(seg) ? ":id" : seg))
    .join("/");
  return `${url.origin}${path}`;
}

function isDynamicSegment(seg: string): boolean {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const longHex = /^[0-9a-f]{16,}$/i;
  const numeric = /^\d+$/;
  // long token that mixes letters and digits (slug-ish ids)
  const mixedId = /^(?=.*\d)[A-Za-z0-9_-]{8,}$/;
  return (
    uuid.test(seg) ||
    longHex.test(seg) ||
    numeric.test(seg) ||
    mixedId.test(seg)
  );
}
