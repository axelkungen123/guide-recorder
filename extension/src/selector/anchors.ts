/**
 * Attributes treated as stable anchors for selectors, in priority order.
 * Shared by the selector strategy (which builds selectors) and the robustness
 * analyzer (which grades them) so the two can never disagree about what counts
 * as "stable".
 */
export const STABLE_ATTRS = [
  "data-testid",
  "data-test",
  "data-cy",
  "data-qa",
  "aria-label",
  "name",
] as const;

/** Attributes whose *values* we don't blindly trust (may embed dynamic content). */
export const GUARDED_ATTRS: ReadonlySet<string> = new Set([
  "aria-label",
  "name",
]);

/** True if an attribute value looks dynamic/unstable and shouldn't anchor a selector. */
export function looksDynamicValue(value: string): boolean {
  return value.length > 80 || /\d{4,}/.test(value);
}
