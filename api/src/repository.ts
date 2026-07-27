import { randomUUID } from "node:crypto";
import { db } from "./db.ts";
import { deleteScreenshots, saveScreenshot } from "./storage.ts";
import type {
  ElementContext,
  IncomingRecording,
  RecordingDetail,
  RecordingSummary,
  StoredStep,
} from "./types.ts";

interface RecordingRow {
  id: string;
  created_at: number;
  step_count: number;
  first_url: string | null;
  title: string | null;
}

interface StepRow {
  idx: number;
  timestamp: number;
  url: string;
  element_context: string;
  screenshot_path: string | null;
  screenshot_error: string | null;
}

const insertRecording = db.prepare(
  `INSERT INTO recordings (id, created_at, step_count, first_url, title)
   VALUES (?, ?, ?, ?, ?)`,
);

const insertStep = db.prepare(
  `INSERT INTO steps
     (recording_id, idx, timestamp, url, element_context, screenshot_path, screenshot_error)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const listRecordings = db.prepare(
  `SELECT id, created_at, step_count, first_url, title
   FROM recordings ORDER BY created_at DESC`,
);

const getRecording = db.prepare(
  `SELECT id, created_at, step_count, first_url, title
   FROM recordings WHERE id = ?`,
);

const getSteps = db.prepare(
  `SELECT idx, timestamp, url, element_context, screenshot_path, screenshot_error
   FROM steps WHERE recording_id = ? ORDER BY idx ASC`,
);

const getScreenshotPath = db.prepare(
  `SELECT screenshot_path FROM steps WHERE recording_id = ? AND idx = ?`,
);

const deleteRecording = db.prepare(`DELETE FROM recordings WHERE id = ?`);

function toSummary(row: RecordingRow): RecordingSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    stepCount: row.step_count,
    firstUrl: row.first_url,
    title: row.title,
  };
}

function toStoredStep(recordingId: string, row: StepRow): StoredStep {
  const step: StoredStep = {
    index: row.idx,
    timestamp: row.timestamp,
    url: row.url,
    elementContext: JSON.parse(row.element_context) as ElementContext,
    screenshotUrl: row.screenshot_path
      ? `/recordings/${recordingId}/screenshots/${row.idx}`
      : null,
  };
  if (row.screenshot_error) step.screenshotError = row.screenshot_error;
  return step;
}

/** Persist an incoming recording (writes screenshots to disk). */
export function createRecording(payload: IncomingRecording): RecordingSummary {
  const id = randomUUID();
  const createdAt = Date.now();
  const steps = payload.steps;
  const firstUrl = steps[0]?.url ?? null;
  const title = payload.title?.trim() || null;

  // node:sqlite has no transaction() helper — drive it manually.
  db.exec("BEGIN");
  try {
    insertRecording.run(id, createdAt, steps.length, firstUrl, title);
    for (const step of steps) {
      const relPath = saveScreenshot(id, step.index, step.screenshot);
      insertStep.run(
        id,
        step.index,
        step.timestamp,
        step.url,
        JSON.stringify(step.elementContext),
        relPath,
        step.screenshotError ?? null,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    id,
    createdAt,
    stepCount: steps.length,
    firstUrl,
    title,
  };
}

export function listAll(): RecordingSummary[] {
  return (listRecordings.all() as unknown as RecordingRow[]).map(toSummary);
}

export function getDetail(id: string): RecordingDetail | null {
  const row = getRecording.get(id) as RecordingRow | undefined;
  if (!row) return null;
  const steps = (getSteps.all(id) as unknown as StepRow[]).map((s) =>
    toStoredStep(id, s),
  );
  return { ...toSummary(row), steps };
}

/** Relative screenshot path for a step, or null if none. */
export function getStepScreenshotPath(
  recordingId: string,
  index: number,
): string | null {
  const row = getScreenshotPath.get(recordingId, index) as
    | { screenshot_path: string | null }
    | undefined;
  return row?.screenshot_path ?? null;
}

/** Returns true if a recording existed and was removed. */
export function remove(id: string): boolean {
  const existed = getRecording.get(id) !== undefined;
  if (!existed) return false;
  deleteRecording.run(id); // cascades to steps
  deleteScreenshots(id);
  return true;
}
