import type { RecordingDetail, RecordingSummary } from "@guide-recorder/shared";

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

/** Turn a relative screenshot path from the api into an absolute URL. */
export function screenshotUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
