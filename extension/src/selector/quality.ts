import type {
  CssLocator,
  Locator,
  SelectorQuality,
  SelectorRobustness,
} from "@guide-recorder/shared";
import { STABLE_ATTRS } from "./anchors";

/**
 * Grades the robustness of a ranked locator list. The overall rating reflects
 * the PRIMARY (best) locator; the CSS-structural metrics always describe the
 * CSS fallback (depth / positional segments / shadow hops), which is useful even
 * when a stronger locator is primary.
 */

const SHADOW_SEP = " >> ";
const CHILD_SEP = " > ";

// [data-testid=|[aria-label=|… , or an #id at a segment boundary.
const STABLE_ANCHOR_RE = new RegExp(
  `${STABLE_ATTRS.map((a) => `\\[${a}=`).join("|")}|(?:^|[ >])#`,
);

interface CssMetrics {
  robustness: SelectorRobustness;
  hasStableAnchor: boolean;
  depth: number;
  shadowHops: number;
  positionalSegments: number;
  notes: string[];
}

const EMPTY_METRICS: CssMetrics = {
  robustness: "positional",
  hasStableAnchor: false,
  depth: 0,
  shadowHops: 0,
  positionalSegments: 0,
  notes: [],
};

export function gradeLocators(locators: Locator[]): SelectorQuality {
  const primary = locators[0];
  const css = locators.find((l): l is CssLocator => l.kind === "css");
  const metrics = css ? analyzeCss(css.value) : EMPTY_METRICS;
  const graded = gradePrimary(primary, metrics);

  return {
    robustness: graded.robustness,
    primaryKind: primary?.kind ?? "css",
    hasStableAnchor: graded.hasStableAnchor,
    depth: metrics.depth,
    shadowHops: metrics.shadowHops,
    positionalSegments: metrics.positionalSegments,
    notes: graded.notes,
  };
}

function gradePrimary(
  primary: Locator | undefined,
  css: CssMetrics,
): { robustness: SelectorRobustness; hasStableAnchor: boolean; notes: string[] } {
  if (!primary) {
    return {
      robustness: "positional",
      hasStableAnchor: false,
      notes: ["Ingen lokaliserare"],
    };
  }
  switch (primary.kind) {
    case "testid":
      return {
        robustness: "anchored",
        hasStableAnchor: true,
        notes: [`Testid-ankare ([${primary.attr}]) — mycket stabil`],
      };
    case "role":
      return primary.name
        ? {
            robustness: "anchored",
            hasStableAnchor: true,
            notes: [
              `Roll + namn (role=${primary.role}, "${primary.name}") — semantiskt stabil`,
            ],
          }
        : {
            robustness: "mixed",
            hasStableAnchor: false,
            notes: [
              `Roll utan tillgängligt namn (role=${primary.role}) — svagare`,
            ],
          };
    case "text":
      return {
        robustness: "mixed",
        hasStableAnchor: false,
        notes: [
          `Textbaserad ("${primary.value}") — semantisk men känslig för textändringar`,
        ],
      };
    case "css":
      return {
        robustness: css.robustness,
        hasStableAnchor: css.hasStableAnchor,
        notes: css.notes.length
          ? css.notes
          : ["CSS-fallback"],
      };
  }
}

/** Heuristic analysis of a CSS selector string (the fallback locator). */
function analyzeCss(selector: string): CssMetrics {
  // Blank out quoted attribute values so separators inside them (e.g. an
  // aria-label of "Home > Settings") don't corrupt the structural split.
  const structural = selector.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  const scopes = structural.split(SHADOW_SEP);
  const shadowHops = scopes.length - 1;

  const segments = scopes.flatMap((scope) => scope.split(CHILD_SEP));
  const depth = segments.filter((s) => s.trim().length > 0).length;

  const positionalSegments = segments.filter((s) =>
    s.includes(":nth-of-type("),
  ).length;

  const hasStableAnchor = STABLE_ANCHOR_RE.test(selector);
  const robustness = rateCss(hasStableAnchor, positionalSegments);

  return {
    robustness,
    hasStableAnchor,
    depth,
    shadowHops,
    positionalSegments,
    notes: cssNotes({
      robustness,
      hasStableAnchor,
      depth,
      shadowHops,
      positionalSegments,
    }),
  };
}

function rateCss(
  hasStableAnchor: boolean,
  positionalSegments: number,
): SelectorRobustness {
  if (!hasStableAnchor) return "positional";
  if (positionalSegments === 0) return "anchored";
  return "mixed";
}

function cssNotes(m: Omit<CssMetrics, "notes">): string[] {
  const notes: string[] = [];
  if (!m.hasStableAnchor) {
    notes.push("CSS-fallback utan stabil ankare — beror på DOM-position");
  }
  if (m.positionalSegments > 0) {
    notes.push(`${m.positionalSegments} positionsbaserade segment (nth-of-type)`);
  }
  if (m.shadowHops > 0) {
    notes.push(`Korsar shadow DOM (${m.shadowHops} hopp) — ej valbar med en query`);
  }
  if (m.depth >= 5) {
    notes.push(`Djup CSS-selektor (${m.depth} nivåer)`);
  }
  return notes;
}
