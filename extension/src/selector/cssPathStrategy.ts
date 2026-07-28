import type { SelectorStrategy } from "./index";
import { GUARDED_ATTRS, looksDynamicValue, STABLE_ATTRS } from "./anchors";

/**
 * Default selector strategy: prefer stable anchor attributes (data-testid,
 * aria-label, name, …) or a non-generated id, otherwise build a CSS path with
 * :nth-of-type fallbacks. Shadow boundaries are crossed and joined with " >> "
 * (a conventional, NON-standard shadow-piercing separator — a single
 * querySelector cannot resolve it; consumers must split on " >> " and hop
 * through each shadowRoot).
 *
 * Intentionally simple and self-contained so it can be replaced later.
 */

const SHADOW_SEP = " >> ";

/** Escape a value for use inside a quoted attribute selector ([a="…"]). */
function escapeAttrValue(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}

/** Escape a value for use as a CSS identifier (#id). */
function cssEscapeIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^\w-]/g, (ch) => `\\${ch}`);
}

/** Heuristic: does this id look framework-generated / unstable? */
function looksGenerated(id: string): boolean {
  return (
    id.length > 40 ||
    /\d{4,}/.test(id) ||
    /^[A-Za-z]+[-_:][0-9a-f]{6,}$/i.test(id) ||
    /^(radix|mui|headlessui|react|ember)/i.test(id)
  );
}

function isUniqueInScope(root: Document | ShadowRoot, selector: string): boolean {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/** A single-element anchor (attribute/id) if one is available. */
function anchorSelector(el: Element): string | null {
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    // Guarded attrs (aria-label/name) can embed dynamic content — skip those.
    if (GUARDED_ATTRS.has(attr) && looksDynamicValue(val)) continue;
    return `[${attr}="${escapeAttrValue(val)}"]`;
  }
  const id = el.getAttribute("id");
  if (id && !looksGenerated(id)) return `#${cssEscapeIdent(id)}`;
  return null;
}

/** tag, plus :nth-of-type only when needed to disambiguate siblings. */
function positionalSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const sameTag = Array.from(parent.children).filter(
    (c) => c.tagName === el.tagName,
  );
  if (sameTag.length === 1) return tag;
  const index = sameTag.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}

function getScopeRoot(el: Element): Document | ShadowRoot {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot || root instanceof Document) return root;
  return document;
}

/** Build a selector for `el` valid within its own document/shadow scope. */
function selectorWithinScope(el: Element): string {
  const root = getScopeRoot(el);
  const segments: string[] = [];
  let current: Element | null = el;

  while (current && getScopeRoot(current) === root) {
    const anchor = anchorSelector(current);
    if (anchor && isUniqueInScope(root, anchor)) {
      // A unique anchor is enough — stop climbing.
      segments.unshift(anchor);
      return segments.join(" > ");
    }
    segments.unshift(positionalSelector(current));
    current = current.parentElement;
  }

  return segments.join(" > ");
}

export const cssPathStrategy: SelectorStrategy = {
  name: "css-path-v1",
  generate(el: Element): string {
    const chain: string[] = [];
    let node: Element | null = el;

    // Walk out of nested shadow roots, one scope at a time.
    while (node) {
      chain.unshift(selectorWithinScope(node));
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null;
    }

    return chain.join(SHADOW_SEP);
  },
};
