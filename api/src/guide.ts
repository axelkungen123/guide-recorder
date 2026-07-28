import type {
  Guide,
  GuideStep,
  Locator,
  RecordingDetail,
  StoredStep,
} from "./types.ts";

/**
 * Deterministic guide generation: turn a recording into human-readable steps
 * derived from each step's primary locator + text. No AI — a fixed template.
 * (A later pass could send these steps to an LLM for nicer prose.)
 */

export function buildGuide(recording: RecordingDetail): Guide {
  const steps: GuideStep[] = [];
  let prevPattern: string | null = null;

  for (const step of recording.steps) {
    const described = describe(step);
    const pattern = step.elementContext.urlPattern;
    const navigatedTo =
      prevPattern !== null && pattern !== prevPattern ? pattern : undefined;
    prevPattern = pattern;

    steps.push({
      index: steps.length + 1,
      action: described.action,
      target: described.target,
      targetIsCode: described.targetIsCode,
      screenshotUrl: step.screenshotUrl,
      url: step.url,
      navigatedTo,
    });
  }

  return {
    title:
      recording.title ??
      `Guide ${new Date(recording.createdAt).toLocaleString()}`,
    createdAt: recording.createdAt,
    startUrl: recording.firstUrl,
    steps,
  };
}

interface Described {
  action: string;
  target?: string;
  targetIsCode?: boolean;
}

function describe(step: StoredStep): Described {
  const ctx = step.elementContext;
  const primary: Locator | undefined = ctx.locators?.[0];

  if (primary) {
    switch (primary.kind) {
      case "role":
        return primary.name
          ? { action: verbForRole(primary.role), target: primary.name }
          : { action: verbForRole(primary.role) };
      case "text":
        return { action: "Klicka på", target: primary.value };
      case "testid":
        return ctx.text
          ? { action: "Klicka på", target: ctx.text }
          : {
              action: "Klicka på elementet",
              target: `[${primary.attr}="${primary.value}"]`,
              targetIsCode: true,
            };
      case "css":
        break; // fall through to the generic handling below
    }
  }

  return ctx.text
    ? { action: "Klicka på", target: ctx.text }
    : { action: "Klicka på elementet", target: ctx.selector, targetIsCode: true };
}

function verbForRole(role: string): string {
  switch (role) {
    case "button":
      return "Klicka på knappen";
    case "link":
      return "Klicka på länken";
    case "tab":
      return "Välj fliken";
    case "checkbox":
    case "switch":
      return "Växla";
    case "radio":
    case "option":
    case "menuitem":
    case "menuitemcheckbox":
    case "menuitemradio":
    case "treeitem":
      return "Välj";
    case "textbox":
    case "searchbox":
    case "combobox":
    case "spinbutton":
      return "Klicka i fältet";
    default:
      return "Klicka på";
  }
}

/** Render a guide to Markdown. `screenshotBase` is prepended to screenshot URLs. */
export function guideToMarkdown(guide: Guide, screenshotBase = ""): string {
  const out: string[] = [];
  out.push(`# ${guide.title}`, "");
  out.push(`_${guide.steps.length} steg · ${new Date(guide.createdAt).toLocaleString()}_`, "");
  if (guide.startUrl) out.push(`**Börja på:** ${guide.startUrl}`, "");

  for (const step of guide.steps) {
    if (step.navigatedTo) {
      out.push(`> Sidan ändras till \`${step.navigatedTo}\``, "");
    }
    out.push(`## Steg ${step.index}`, "");
    out.push(`${step.action}${renderTarget(step)}`, "");
    if (step.screenshotUrl) {
      out.push(`![Steg ${step.index}](${screenshotBase}${step.screenshotUrl})`, "");
    }
  }

  return out.join("\n").trimEnd() + "\n";
}

function renderTarget(step: GuideStep): string {
  if (!step.target) return "";
  return step.targetIsCode ? ` \`${step.target}\`` : ` **${step.target}**`;
}
