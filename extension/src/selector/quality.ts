import type { SelectorQuality, SelectorRobustness } from "@guide-recorder/shared";

/**
 * Heuristic robustness assessment of a selector STRING (strategy-agnostic, so it
 * works for any SelectorStrategy). It reads the conventions the default strategy
 * emits: `[data-*="…"]` / `#id` anchors, `:nth-of-type(n)` positional segments,
 * ` > ` child combinators, and ` >> ` shadow-boundary hops.
 *
 * A strategy that produces a very different syntax should ship its own analyzer;
 * this one is a pragmatic default.
 */

const SHADOW_SEP = " >> ";
const CHILD_SEP = " > ";

export function analyzeSelector(selector: string): SelectorQuality {
  const scopes = selector.split(SHADOW_SEP);
  const shadowHops = scopes.length - 1;

  const segments = scopes.flatMap((scope) => scope.split(CHILD_SEP));
  const depth = segments.filter((s) => s.trim().length > 0).length;

  const positionalSegments = segments.filter((s) =>
    s.includes(":nth-of-type("),
  ).length;

  // The strategy only emits data-* attributes and #id as stable anchors.
  const hasStableAnchor = /\[data-[\w-]+=|(?:^|[ >])#/.test(selector);

  const robustness = rate(hasStableAnchor, positionalSegments);

  return {
    robustness,
    hasStableAnchor,
    depth,
    shadowHops,
    positionalSegments,
    notes: buildNotes({
      robustness,
      hasStableAnchor,
      depth,
      shadowHops,
      positionalSegments,
    }),
  };
}

function rate(
  hasStableAnchor: boolean,
  positionalSegments: number,
): SelectorRobustness {
  if (!hasStableAnchor) return "positional";
  if (positionalSegments === 0) return "anchored";
  return "mixed";
}

function buildNotes(q: Omit<SelectorQuality, "notes">): string[] {
  const notes: string[] = [];
  if (!q.hasStableAnchor) {
    notes.push("Ingen stabil ankare (data-*/id) — beror på DOM-position");
  }
  if (q.positionalSegments > 0) {
    notes.push(
      `${q.positionalSegments} positionsbaserade segment (nth-of-type)`,
    );
  }
  if (q.shadowHops > 0) {
    notes.push(
      `Korsar shadow DOM (${q.shadowHops} hopp) — ej valbar med en query`,
    );
  }
  if (q.depth >= 5) {
    notes.push(`Djup selektor (${q.depth} nivåer)`);
  }
  if (q.robustness === "anchored" && q.depth === 1) {
    notes.push("Enda stabila ankaret");
  }
  return notes;
}
