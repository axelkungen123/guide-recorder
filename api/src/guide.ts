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

/**
 * Render a guide to a self-contained HTML document. `screenshotDataUri` maps a
 * step's screenshotUrl to an inlined `data:` URI (or null) so the file works
 * offline and can be shared without the api running.
 */
export function guideToHtml(
  guide: Guide,
  screenshotDataUri: (screenshotUrl: string) => string | null,
): string {
  const stepsHtml = guide.steps
    .map((step) => {
      const nav = step.navigatedTo
        ? `<p class="nav">Sidan ändras till <code>${esc(step.navigatedTo)}</code></p>`
        : "";
      const dataUri = step.screenshotUrl
        ? screenshotDataUri(step.screenshotUrl)
        : null;
      const img = dataUri
        ? `<img src="${dataUri}" alt="Steg ${step.index}" />`
        : "";
      return `
      <li class="step">
        ${nav}
        <p class="instruction">${instructionHtml(step)}</p>
        ${img}
      </li>`;
    })
    .join("\n");

  const start = guide.startUrl
    ? `<p class="start">Börja på <code>${esc(guide.startUrl)}</code></p>`
    : "";

  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(guide.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 760px; margin: 40px auto; padding: 0 20px;
    font: 16px/1.6 system-ui, sans-serif; color: #1a1c20; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e6e8ec; background: #14161a; } }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta, .start { color: #6b7280; }
  .start { margin-top: 0; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.85em;
    background: rgba(127,127,127,.15); padding: 1px 5px; border-radius: 4px; }
  ol { list-style: none; counter-reset: s; padding: 0; margin: 28px 0 0; }
  .step { counter-increment: s; position: relative; padding-left: 44px; margin-bottom: 32px; }
  .step::before { content: counter(s); position: absolute; left: 0; top: 0;
    width: 30px; height: 30px; border-radius: 999px; background: #2563eb; color: #fff;
    font-weight: 600; display: flex; align-items: center; justify-content: center; }
  .instruction { font-size: 17px; margin: 3px 0 10px; }
  .nav { font-size: 13px; color: #6b7280; margin: 0 0 6px; }
  img { max-width: 100%; border: 1px solid rgba(127,127,127,.35); border-radius: 8px; display: block; }
</style>
</head>
<body>
  <h1>${esc(guide.title)}</h1>
  <p class="meta">${guide.steps.length} steg · ${esc(new Date(guide.createdAt).toLocaleString())}</p>
  ${start}
  <ol>${stepsHtml}
  </ol>
</body>
</html>
`;
}

function instructionHtml(step: GuideStep): string {
  const override = step.instructionOverride?.trim();
  if (override) return esc(override);
  if (!step.target) return esc(step.action);
  const target = step.targetIsCode
    ? `<code>${esc(step.target)}</code>`
    : `<strong>${esc(step.target)}</strong>`;
  return `${esc(step.action)} ${target}`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
