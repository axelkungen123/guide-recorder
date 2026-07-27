import { API_BASE_URL } from "../shared/config";
import type { UploadResult } from "../shared/messages";
import type { Step } from "../shared/types";

/**
 * POST a finished recording to the api. Best-effort: any failure (api down,
 * network, non-2xx) is returned as { ok: false } so the popup can surface it
 * while the local JSON download still serves as a fallback.
 */
export async function uploadRecording(steps: Step[]): Promise<UploadResult> {
  if (steps.length === 0) {
    return { ok: false, error: "No steps to upload" };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/recordings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps,
        title: `Recording ${new Date().toISOString()}`,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `API responded ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
