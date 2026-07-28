import type { Locator } from "@guide-recorder/shared";
import { computeAccessibleName, computeRole, isNameFromContentRole } from "./aria";
import { getSelectorStrategy } from "./index";

/**
 * Build a ranked list of locators for an element, best first:
 *   1. test-id attribute        (most stable)
 *   2. role + accessible name   (semantic, resilient to markup changes)
 *   3. visible text             (semantic, but text can change)
 *   4. role without a name      (weakly selective)
 *   5. CSS path                 (always present — last-resort fallback)
 *
 * The CSS fallback comes from the active (swappable) SelectorStrategy.
 */

const TESTID_ATTRS = ["data-testid", "data-test", "data-cy", "data-qa"];
const MAX_TEXT_LOCATOR = 80;

export function buildLocators(el: Element): Locator[] {
  const locators: Locator[] = [];

  for (const attr of TESTID_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      locators.push({ kind: "testid", attr, value });
      break;
    }
  }

  const role = computeRole(el);
  const name = computeAccessibleName(el);

  if (role && name) {
    locators.push({ kind: "role", role, name });
  }
  if (name && role && isNameFromContentRole(role) && name.length <= MAX_TEXT_LOCATOR) {
    locators.push({ kind: "text", value: name, exact: true });
  }
  if (role && !name) {
    locators.push({ kind: "role", role });
  }

  locators.push({ kind: "css", value: getSelectorStrategy().generate(el) });

  return locators;
}

/** Human-readable, Playwright-ish rendering of a locator. */
export function formatLocator(loc: Locator): string {
  switch (loc.kind) {
    case "testid":
      return `[${loc.attr}="${loc.value}"]`;
    case "role":
      return loc.name
        ? `role=${loc.role}[name="${loc.name}"]`
        : `role=${loc.role}`;
    case "text":
      return loc.exact ? `text="${loc.value}"` : `text=${loc.value}`;
    case "css":
      return loc.value;
  }
}
