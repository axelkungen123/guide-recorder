import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * SQLite via the built-in node:sqlite (no native dependency). Screenshots are
 * NOT stored here — only a relative file path (see storage.ts) — so the DB stays
 * small.
 */

export const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
);

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, "recordings.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS recordings (
    id          TEXT PRIMARY KEY,
    created_at  INTEGER NOT NULL,
    step_count  INTEGER NOT NULL,
    first_url   TEXT,
    title       TEXT
  );

  CREATE TABLE IF NOT EXISTS steps (
    recording_id    TEXT NOT NULL,
    idx             INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    url             TEXT NOT NULL,
    element_context TEXT NOT NULL,           -- JSON-encoded ElementContext
    screenshot_path TEXT,                    -- relative to DATA_DIR, or NULL
    screenshot_error TEXT,
    PRIMARY KEY (recording_id, idx),
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_recordings_created_at
    ON recordings (created_at DESC);
`);
