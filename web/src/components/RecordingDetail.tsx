import { useEffect, useState } from "react";
import type { RecordingDetail } from "@guide-recorder/shared";
import { deleteRecording, fetchRecording } from "../api";
import { StepView } from "./StepView";

interface Props {
  id: string;
  onDeleted: () => void;
}

export function RecordingDetailView({ id, onDeleted }: Props) {
  const [detail, setDetail] = useState<RecordingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    fetchRecording(id)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="empty">Laddar…</p>;

  return (
    <div className="detail">
      <header className="detail-head">
        <div>
          <h2>{detail.title ?? detail.id}</h2>
          <p className="rec-meta">
            {detail.stepCount} steg · {new Date(detail.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          className="danger"
          onClick={() => {
            void deleteRecording(id).then(onDeleted);
          }}
        >
          Ta bort
        </button>
      </header>
      <ol className="steps">
        {detail.steps.map((step) => (
          <li key={step.index}>
            <StepView step={step} />
          </li>
        ))}
      </ol>
    </div>
  );
}
