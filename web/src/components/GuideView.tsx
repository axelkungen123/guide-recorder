import { useEffect, useState } from "react";
import type { Guide, GuideStep } from "@guide-recorder/shared";
import {
  fetchGuide,
  guideMarkdownUrl,
  resetGuide,
  saveGuide,
  screenshotUrl,
} from "../api";

interface Props {
  id: string;
}

export function GuideView({ id }: Props) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setGuide(null);
    setError(null);
    setDirty(false);
    fetchGuide(id)
      .then((g) => active && setGuide(g))
      .catch((err) => active && setError(String(err)));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!guide) return <p className="empty">Genererar guide…</p>;

  // Local re-index for display so numbers stay right before saving.
  const steps = guide.steps.map((s, i) => ({ ...s, index: i + 1 }));

  function update(next: Guide) {
    setGuide(next);
    setDirty(true);
  }

  function setTitle(title: string) {
    update({ ...guide!, title });
  }

  function mutateStep(stepId: string, patch: Partial<GuideStep>) {
    update({
      ...guide!,
      steps: guide!.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    });
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    const arr = [...guide!.steps];
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    update({ ...guide!, steps: arr });
  }

  function remove(stepId: string) {
    update({ ...guide!, steps: guide!.steps.filter((s) => s.id !== stepId) });
  }

  async function onSave() {
    setBusy(true);
    try {
      const saved = await saveGuide(id, guide!);
      setGuide(saved);
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setBusy(true);
    try {
      const fresh = await resetGuide(id);
      setGuide(fresh);
      setDirty(false);
      setEditingId(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="guide">
      <input
        className="guide-title-input"
        value={guide.title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Guidens titel"
      />

      <div className="guide-actions">
        <button onClick={() => void onSave()} disabled={!dirty || busy}>
          {dirty ? "Spara ändringar" : "Sparat"}
        </button>
        <button onClick={() => void onReset()} disabled={busy}>
          Återställ till genererad
        </button>
        <a className="btn-link" href={guideMarkdownUrl(id)} download>
          Ladda ner .md
        </a>
      </div>

      {guide.startUrl && (
        <p className="guide-start">
          Börja på <code>{guide.startUrl}</code>
        </p>
      )}

      <ol className="guide-steps">
        {steps.map((step, i) => (
          <li key={step.id} className="guide-step">
            {step.navigatedTo && (
              <p className="guide-nav">
                Sidan ändras till <code>{step.navigatedTo}</code>
              </p>
            )}

            <div className="guide-step-body">
              {editingId === step.id ? (
                <input
                  className="guide-edit-input"
                  autoFocus
                  defaultValue={instructionText(step)}
                  onBlur={(e) => {
                    mutateStep(step.id, { instructionOverride: e.target.value });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <p className="guide-instruction">
                  <Instruction step={step} />
                </p>
              )}

              <div className="guide-step-controls">
                <button title="Redigera text" onClick={() => setEditingId(step.id)}>
                  ✏️
                </button>
                {step.instructionOverride !== undefined && (
                  <button
                    title="Återställ text"
                    onClick={() =>
                      mutateStep(step.id, { instructionOverride: undefined })
                    }
                  >
                    ↺
                  </button>
                )}
                <button
                  title="Flytta upp"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  title="Flytta ned"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                >
                  ↓
                </button>
                <button title="Ta bort steg" onClick={() => remove(step.id)}>
                  ✕
                </button>
              </div>
            </div>

            {step.screenshotUrl && (
              <img
                className="guide-shot"
                src={screenshotUrl(step.screenshotUrl)}
                alt={`Steg ${step.index}`}
                loading="lazy"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Plain-text instruction (for the edit field's initial value). */
function instructionText(step: GuideStep): string {
  if (step.instructionOverride?.trim()) return step.instructionOverride;
  return step.target ? `${step.action} ${step.target}` : step.action;
}

function Instruction({ step }: { step: GuideStep }) {
  if (step.instructionOverride?.trim()) return <>{step.instructionOverride}</>;
  if (!step.target) return <>{step.action}</>;
  return (
    <>
      {step.action}{" "}
      {step.targetIsCode ? (
        <code>{step.target}</code>
      ) : (
        <strong>{step.target}</strong>
      )}
    </>
  );
}
