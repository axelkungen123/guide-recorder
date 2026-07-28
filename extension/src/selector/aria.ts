/**
 * Pragmatic ARIA role + accessible-name computation. This is deliberately a
 * SUBSET of the full ARIA/AccName specs — enough to produce good role/text
 * locators for common clickable elements, not a conformance implementation.
 */

/** Roles whose accessible name may come from the element's own text content. */
const NAME_FROM_CONTENT = new Set([
  "button",
  "link",
  "heading",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "treeitem",
  "checkbox",
  "radio",
  "switch",
  "cell",
  "gridcell",
]);

export function isNameFromContentRole(role: string): boolean {
  return NAME_FROM_CONTENT.has(role);
}

/** Compute a (subset) ARIA role for the element, or undefined. */
export function computeRole(el: Element): string | undefined {
  const explicit = el.getAttribute("role");
  if (explicit) {
    const first = explicit.trim().split(/\s+/)[0];
    if (first) return first;
  }
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "button":
    case "summary":
      return "button";
    case "a":
    case "area":
      return el.hasAttribute("href") ? "link" : undefined;
    case "select":
      return el.hasAttribute("multiple") ? "listbox" : "combobox";
    case "textarea":
      return "textbox";
    case "option":
      return "option";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    case "img":
      // alt="" marks a decorative image (no role/name).
      return el.getAttribute("alt") === "" ? undefined : "img";
    case "nav":
      return "navigation";
    case "input":
      return inputRole(el as HTMLInputElement);
    default:
      return undefined;
  }
}

function inputRole(el: HTMLInputElement): string | undefined {
  const type = (el.getAttribute("type") ?? "text").toLowerCase();
  switch (type) {
    case "button":
    case "submit":
    case "reset":
    case "image":
      return "button";
    case "checkbox":
      return "checkbox";
    case "radio":
      return "radio";
    case "range":
      return "slider";
    case "number":
      return "spinbutton";
    case "search":
      return "searchbox";
    case "hidden":
      return undefined;
    case "email":
    case "tel":
    case "url":
    case "text":
      return "textbox";
    default:
      return "textbox";
  }
}

/** Compute a (subset) accessible name for the element ("" if none). */
export function computeAccessibleName(el: Element): string {
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const text = resolveIdRefs(el, labelledby);
    if (text) return normalizeName(text);
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return normalizeName(ariaLabel);

  const fromLabel = associatedLabelText(el);
  if (fromLabel) return normalizeName(fromLabel);

  const role = computeRole(el);
  if (role && NAME_FROM_CONTENT.has(role)) {
    const text = (el as HTMLElement).textContent ?? "";
    if (text.trim()) return normalizeName(text);
  }

  const alt = el.getAttribute("alt");
  if (alt && alt.trim()) return normalizeName(alt);
  const title = el.getAttribute("title");
  if (title && title.trim()) return normalizeName(title);
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return normalizeName(placeholder);

  if (isButtonInput(el)) {
    const value = (el as HTMLInputElement).value;
    if (value && value.trim()) return normalizeName(value);
  }

  return "";
}

function resolveIdRefs(el: Element, ids: string): string {
  const root = el.getRootNode() as Document | ShadowRoot;
  return ids
    .trim()
    .split(/\s+/)
    .map((id) => root.getElementById(id)?.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

function associatedLabelText(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag !== "input" && tag !== "select" && tag !== "textarea") return "";
  const root = el.getRootNode() as Document | ShadowRoot;
  const id = el.getAttribute("id");
  if (id) {
    const label = root.querySelector(`label[for="${escapeAttrValue(id)}"]`);
    if (label?.textContent?.trim()) return label.textContent;
  }
  const ancestorLabel = el.closest?.("label");
  if (ancestorLabel?.textContent?.trim()) return ancestorLabel.textContent;
  return "";
}

function isButtonInput(el: Element): boolean {
  if (el.tagName.toLowerCase() !== "input") return false;
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  return type === "button" || type === "submit" || type === "reset";
}

function escapeAttrValue(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}

function normalizeName(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}
