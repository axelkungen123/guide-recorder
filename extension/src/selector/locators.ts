import type { Locator } from "@guide-recorder/shared";
import { computeAccessibleName, computeRole, isNameFromContentRole } from "./aria";
import { getSelectorStrategy } from "./index";

/** Roles that make an element a click target in its own right. */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "switch",
  "treeitem",
  "combobox",
  "textbox",
  "searchbox",
  "slider",
  "spinbutton",
]);

const MAX_CLIMB = 8;

/** Is this element interactive on its own (a real click target)? */
function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "select" || tag === "textarea" || tag === "summary") {
    return true;
  }
  if (tag === "a" || tag === "area") return el.hasAttribute("href");
  if (tag === "input") {
    return (el.getAttribute("type") ?? "").toLowerCase() !== "hidden";
  }
  const role = computeRole(el);
  return role !== undefined && INTERACTIVE_ROLES.has(role);
}

/** Climb to the parent element, hopping out of a shadow root via its host. */
function climbParent(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * Resolve the element a click should be attributed to: the nearest interactive
 * ancestor (or the element itself). On web-component apps you often click a deep
 * inner icon whose role/name live on the enclosing button — this retargets to
 * that button, like Playwright records the control rather than the icon inside.
 * Falls back to the original element if nothing interactive is found nearby.
 */
export function resolveInteractiveTarget(el: Element): Element {
  let current: Element | null = el;
  for (let i = 0; current && i <= MAX_CLIMB; i++) {
    if (isInteractive(current)) return current;
    current = climbParent(current);
  }
  return el;
}

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
