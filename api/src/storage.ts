import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./db.ts";

/**
 * Screenshots are stored as files under data/screenshots/<recordingId>/ and the
 * DB keeps only the relative path. Keeps the base64 blobs out of SQLite.
 */

const SCREENSHOTS_ROOT = "screenshots";
const DATA_URL_RE = /^data:image\/(png|jpeg);base64,(.+)$/s;

/**
 * Decode a data URL and write it to disk. Returns the path relative to DATA_DIR,
 * or null if there was nothing valid to store.
 */
export function saveScreenshot(
  recordingId: string,
  index: number,
  dataUrl: string | null,
): string | null {
  if (!dataUrl) return null;
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;

  const ext = match[1] === "jpeg" ? "jpg" : "png";
  const dir = join(DATA_DIR, SCREENSHOTS_ROOT, recordingId);
  mkdirSync(dir, { recursive: true });

  const relPath = join(SCREENSHOTS_ROOT, recordingId, `${index}.${ext}`);
  writeFileSync(join(DATA_DIR, relPath), Buffer.from(match[2], "base64"));
  return relPath;
}

/** Absolute path for a stored screenshot's relative path. */
export function screenshotAbsPath(relPath: string): string {
  return join(DATA_DIR, relPath);
}

/** Remove all screenshots for a recording. */
export function deleteScreenshots(recordingId: string): void {
  rmSync(join(DATA_DIR, SCREENSHOTS_ROOT, recordingId), {
    recursive: true,
    force: true,
  });
}
