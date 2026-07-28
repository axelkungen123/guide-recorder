import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import {
  createRecording,
  getDetail,
  getStepScreenshotPath,
  listAll,
  remove,
} from "./repository.ts";
import { screenshotAbsPath } from "./storage.ts";
import { buildGuide, guideToMarkdown } from "./guide.ts";
import type { IncomingRecording, IncomingStep } from "./types.ts";

export const app = new Hono();

// Allow calls from the extension (chrome-extension://…) and a future web app.
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

// --- Ingest ---
app.post("/recordings", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const validation = validateRecording(body);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const summary = createRecording(validation.value);
  return c.json(summary, 201);
});

// --- List ---
app.get("/recordings", (c) => {
  return c.json({ recordings: listAll() });
});

// --- Detail ---
app.get("/recordings/:id", (c) => {
  const detail = getDetail(c.req.param("id"));
  if (!detail) return c.json({ error: "Not found" }, 404);
  return c.json(detail);
});

// --- Generated guide (structured) ---
app.get("/recordings/:id/guide", (c) => {
  const detail = getDetail(c.req.param("id"));
  if (!detail) return c.json({ error: "Not found" }, 404);
  return c.json(buildGuide(detail));
});

// --- Generated guide (Markdown download) ---
app.get("/recordings/:id/guide.md", (c) => {
  const id = c.req.param("id");
  const detail = getDetail(id);
  if (!detail) return c.json({ error: "Not found" }, 404);
  const origin = new URL(c.req.url).origin;
  const markdown = guideToMarkdown(buildGuide(detail), origin);
  return c.body(markdown, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="guide-${id}.md"`,
  });
});

// --- Screenshot bytes ---
app.get("/recordings/:id/screenshots/:index", (c) => {
  const id = c.req.param("id");
  const index = Number(c.req.param("index"));
  if (!Number.isInteger(index)) return c.json({ error: "Bad index" }, 400);

  const relPath = getStepScreenshotPath(id, index);
  if (!relPath) return c.json({ error: "No screenshot" }, 404);

  let bytes: Buffer;
  try {
    bytes = readFileSync(screenshotAbsPath(relPath));
  } catch {
    return c.json({ error: "Screenshot file missing" }, 404);
  }
  const contentType = relPath.endsWith(".jpg") ? "image/jpeg" : "image/png";
  // Hono's c.body wants an ArrayBuffer, not a Node Buffer — hand it the exact
  // byte range this Buffer views.
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return c.body(arrayBuffer, 200, { "Content-Type": contentType });
});

// --- Delete ---
app.delete("/recordings/:id", (c) => {
  const removed = remove(c.req.param("id"));
  if (!removed) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

// Minimal hand-rolled validation (no schema lib for the spike).
type ValidationResult =
  | { ok: true; value: IncomingRecording }
  | { ok: false; error: string };

function validateRecording(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be an object" };
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.steps)) {
    return { ok: false, error: "`steps` must be an array" };
  }
  for (const [i, step] of record.steps.entries()) {
    if (!isStep(step)) {
      return { ok: false, error: `Step ${i} is malformed` };
    }
  }
  const value: IncomingRecording = { steps: record.steps as IncomingStep[] };
  if (typeof record.title === "string") value.title = record.title;
  return { ok: true, value };
}

function isStep(step: unknown): step is IncomingStep {
  if (typeof step !== "object" || step === null) return false;
  const s = step as Record<string, unknown>;
  return (
    typeof s.index === "number" &&
    typeof s.timestamp === "number" &&
    typeof s.url === "string" &&
    typeof s.elementContext === "object" &&
    s.elementContext !== null
  );
}
