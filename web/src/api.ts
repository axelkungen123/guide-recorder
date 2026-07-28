import type {
  Guide,
  RecordingDetail,
  RecordingSummary,
} from "@guide-recorder/shared";

/** api base URL (override with VITE_API_BASE_URL). */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

export async function fetchRecordings(): Promise<RecordingSummary[]> {
  const res = await fetch(`${API_BASE_URL}/recordings`);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const data = (await res.json()) as { recordings: RecordingSummary[] };
  return data.recordings;
}

export async function fetchRecording(id: string): Promise<RecordingDetail> {
  const res = await fetch(`${API_BASE_URL}/recordings/${id}`);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return (await res.json()) as RecordingDetail;
}

export async function deleteRecording(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/recordings/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`API responded ${res.status}`);
  }
}

export async function fetchGuide(id: string): Promise<Guide> {
  const res = await fetch(`${API_BASE_URL}/recordings/${id}/guide`);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return (await res.json()) as Guide;
}

/** Persist an edited guide; returns the normalized (re-indexed) guide. */
export async function saveGuide(id: string, guide: Guide): Promise<Guide> {
  const res = await fetch(`${API_BASE_URL}/recordings/${id}/guide`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guide),
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return (await res.json()) as Guide;
}

/** Discard edits and return the freshly generated guide. */
export async function resetGuide(id: string): Promise<Guide> {
  const res = await fetch(`${API_BASE_URL}/recordings/${id}/guide/reset`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return (await res.json()) as Guide;
}

/** URL of the downloadable Markdown guide. */
export function guideMarkdownUrl(id: string): string {
  return `${API_BASE_URL}/recordings/${id}/guide.md`;
}

/** Turn a relative screenshot path from the api into an absolute URL. */
export function screenshotUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
