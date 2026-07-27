/**
 * Serializes chrome.tabs.captureVisibleTab calls and spaces them out to respect
 * the API rate limit (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND, ~2/sec). Callers
 * enqueue and await; jobs run one at a time with a minimum gap between them.
 *
 * Note: the queue lives in the service worker's memory. Rapid clicks keep the
 * worker alive, but if it is terminated mid-recording the pending queue is lost
 * (the already-buffered steps are safe in storage). Acceptable for the spike.
 */

const MIN_GAP_MS = 600; // > 500ms keeps us under ~2 captures/sec

let chain: Promise<unknown> = Promise.resolve();
let lastCaptureAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Queue a capture of the visible area of `windowId`. Resolves to a PNG data URL. */
export function enqueueCapture(windowId: number): Promise<string> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCaptureAt);
    if (wait > 0) await delay(wait);
    lastCaptureAt = Date.now();
    return chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
