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
  const steps: GuideStep[] = recording.steps.map((step) => {
    const described = describe(step);
    return {
      id: `s${step.index}`,
      index: 0, // set by normalizeGuide
      action: described.action,
      target: described.target,
      targetIsCode: described.targetIsCode,
      screenshotUrl: step.screenshotUrl,
      url: step.url,
      urlPattern: step.elementContext.urlPattern,
    };
  });

  return normalizeGuide({
    title:
      recording.title ??
      `Guide ${new Date(recording.createdAt).toLocaleString()}`,
    createdAt: recording.createdAt,
    startUrl: recording.firstUrl,
    steps,
  });
}

/**
 * Recompute derived fields after edits: 1-based `index` in the current order and
 * `navigatedTo` (set when a step's page differs from the previous step's).
 */
export function normalizeGuide(guide: Guide): Guide {
  let prevPattern: string | null = null;
  const steps = guide.steps.map((step, i) => {
    const navigatedTo =
      prevPattern !== null && step.urlPattern !== prevPattern
        ? step.urlPattern
        : undefined;
    prevPattern = step.urlPattern;
    return { ...step, index: i + 1, navigatedTo };
  });
  return { ...guide, steps };
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
    out.push(renderInstruction(step), "");
    if (step.screenshotUrl) {
      out.push(`![Steg ${step.index}](${screenshotBase}${step.screenshotUrl})`, "");
    }
  }

  return out.join("\n").trimEnd() + "\n";
}

/** Markdown for a step's instruction: override as-is, else action + styled target. */
function renderInstruction(step: GuideStep): string {
  const override = step.instructionOverride?.trim();
  if (override) return override;
  if (!step.target) return step.action;
  const target = step.targetIsCode ? `\`${step.target}\`` : `**${step.target}**`;
  return `${step.action} ${target}`;
}
