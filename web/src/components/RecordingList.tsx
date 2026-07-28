import type { RecordingSummary } from "@guide-recorder/shared";

interface Props {
  recordings: RecordingSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RecordingList({ recordings, selectedId, onSelect }: Props) {
  if (recordings.length === 0) {
    return <p className="empty">Inga inspelningar än.</p>;
  }
  return (
    <ul className="rec-list">
      {recordings.map((r) => (
        <li key={r.id}>
          <button
            className={r.id === selectedId ? "rec-item active" : "rec-item"}
            onClick={() => onSelect(r.id)}
          >
            <span className="rec-title">{r.title ?? r.firstUrl ?? r.id}</span>
            <span className="rec-meta">
              {r.stepCount} steg · {new Date(r.createdAt).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
