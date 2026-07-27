import { cssPathStrategy } from "./cssPathStrategy";

/**
 * Pluggable selector generation. Swap the active strategy to change how
 * selectors are produced without touching capture/extract code.
 */
export interface SelectorStrategy {
  /** Stable identifier stored on each step (e.g. "css-path-v1"). */
  readonly name: string;
  /** Produce a selector string for the given element. */
  generate(el: Element): string;
}

let active: SelectorStrategy = cssPathStrategy;

export function getSelectorStrategy(): SelectorStrategy {
  return active;
}

export function setSelectorStrategy(strategy: SelectorStrategy): void {
  active = strategy;
}
