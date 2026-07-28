import { useCallback, useEffect, useState } from "react";
import type { RecordingSummary } from "@guide-recorder/shared";
import { fetchRecordings } from "./api";
import { RecordingList } from "./components/RecordingList";
import { RecordingDetailView } from "./components/RecordingDetail";

export function App() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRecordings(await fetchRecordings());
      setError(null);
    } catch (err) {
      setError(
        `Kunde inte nå API:t (${String(err)}). Kör \`npm run api:dev\`?`,
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-head">
          <h1>Guide Recorder</h1>
          <button onClick={() => void reload()}>Uppdatera</button>
        </header>
        {error && <p className="error">{error}</p>}
        <RecordingList
          recordings={recordings}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>
      <main className="main">
        {selectedId ? (
          <RecordingDetailView
            id={selectedId}
            onDeleted={() => {
              setSelectedId(null);
              void reload();
            }}
          />
        ) : (
          <p className="empty">Välj en inspelning till vänster.</p>
        )}
      </main>
    </div>
  );
}
