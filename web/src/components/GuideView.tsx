import { useEffect, useState } from "react";
import type { Guide, GuideStep } from "@guide-recorder/shared";
import { fetchGuide, guideMarkdownUrl, screenshotUrl } from "../api";

interface Props {
  id: string;
}

export function GuideView({ id }: Props) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setGuide(null);
    setError(null);
    fetchGuide(id)
      .then((g) => active && setGuide(g))
      .catch((err) => active && setError(String(err)));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!guide) return <p className="empty">Genererar guide…</p>;

  return (
    <div className="guide">
      <div className="guide-actions">
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
        {guide.steps.map((step) => (
          <li key={step.index} className="guide-step">
            {step.navigatedTo && (
              <p className="guide-nav">
                Sidan ändras till <code>{step.navigatedTo}</code>
              </p>
            )}
            <p className="guide-instruction">
              {step.action}
              <Target step={step} />
            </p>
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

function Target({ step }: { step: GuideStep }) {
  if (!step.target) return null;
  return step.targetIsCode ? (
    <>
      {" "}
      <code>{step.target}</code>
    </>
  ) : (
    <>
      {" "}
      <strong>{step.target}</strong>
    </>
  );
}
