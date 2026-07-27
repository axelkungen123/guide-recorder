import type {
  RuntimeMessage,
  StateResponse,
  StepsResponse,
} from "../shared/messages";
import type { Step } from "../shared/types";

const startBtn = document.getElementById("start") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const uploadEl = document.getElementById("upload") as HTMLParagraphElement;

function send<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function refresh(): Promise<void> {
  const res = await send<StateResponse>({ type: "GET_STATE" });
  const { isRecording, stepCount } = res.state;
  startBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
  statusEl.classList.toggle("recording", isRecording);
  statusEl.textContent = isRecording
    ? `Spelar in… ${stepCount} steg`
    : "Inte igång";
}

function downloadJson(steps: Step[]): void {
  const blob = new Blob([JSON.stringify(steps, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recording-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

startBtn.addEventListener("click", async () => {
  await send({ type: "START_RECORDING" });
  await refresh();
});

stopBtn.addEventListener("click", async () => {
  const res = await send<StepsResponse>({ type: "STOP_RECORDING" });
  console.log("[guide-recorder] steps:", res.steps);
  downloadJson(res.steps);
  showUpload(res);
  await refresh();
});

function showUpload(res: StepsResponse): void {
  if (res.upload.ok) {
    uploadEl.className = "ok";
    uploadEl.textContent = `Uppladdad till API (id ${res.upload.id ?? "?"})`;
  } else {
    uploadEl.className = "err";
    uploadEl.textContent = `API-uppladdning misslyckades: ${res.upload.error ?? "okänt fel"} (JSON nedladdad som fallback)`;
  }
}

// Keep the live step counter fresh while the popup is open.
const timer = window.setInterval(() => {
  void refresh();
}, 700);
window.addEventListener("unload", () => window.clearInterval(timer));

void refresh();
