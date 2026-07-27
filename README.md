# guide-recorder (monorepo)

Technical spike: a Chrome extension that records a user's clicks and captures
structured **step context** for later generating step-by-step guides. The goal
is only to prove capture works reliably — no backend, AI, editing, or extra UI.

```
extension/   # Chrome MV3 extension (TypeScript) — records clicks, captures steps
api/         # Backend (Hono + node:sqlite) — ingests and serves recordings
web/         # (later)
```

## Build & load

Requires Node 18+.

```bash
npm install            # installs workspace dev deps (esbuild, typescript, @types/chrome)
npm run build          # -> extension/dist/
```

Then in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Pin the extension, open the popup, click **Starta inspelning**.
4. Click around a page. Click **Stoppa inspelning**.
5. The full step sequence is printed as JSON to the **service worker console**
   (`chrome://extensions` → the extension → "service worker" → Console) and
   downloaded as `recording-*.json`.

`npm run dev` rebuilds on change (reload the extension in Chrome afterwards).
`npm run typecheck` runs `tsc --noEmit`.

## What a step looks like

```jsonc
{
  "index": 0,
  "timestamp": 1730000000000,
  "url": "https://app.example.com/orders/4213",
  "elementContext": {
    "selector": "[data-testid=\"save\"]",
    "selectorStrategy": "css-path-v1",
    "text": "Save",
    "urlPattern": "https://app.example.com/orders/:id",
    "boundingBox": { "x": 120, "y": 340, "width": 88, "height": 36 },
    "inShadowDom": false,
    "inIframe": false,
    "frameUrl": "https://app.example.com/orders/4213"
  },
  "screenshot": "data:image/png;base64,…"
}
```

## API (`api/`)

Node + [Hono](https://hono.dev), storage in **SQLite via built-in `node:sqlite`**
(no native dependency). Runs TypeScript directly on Node 24 (native type
stripping) — no build step.

```bash
npm run api:dev      # node --watch, http://localhost:8787
# or: npm run api:start
```

Screenshots are written to `api/data/screenshots/<recordingId>/` (kept out of
SQLite, which stores only the relative path). The `api/data/` dir is gitignored.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | liveness |
| `POST` | `/recordings` | ingest `{ steps: Step[], title? }` → `{ id, stepCount, … }` |
| `GET` | `/recordings` | list summaries |
| `GET` | `/recordings/:id` | full recording (steps carry a `screenshotUrl`, not base64) |
| `GET` | `/recordings/:id/screenshots/:index` | PNG bytes |
| `DELETE` | `/recordings/:id` | remove recording + its screenshots |

The extension still downloads JSON locally; wiring it to POST here is the next
step (not done yet).

> Note: `api/src/types.ts` is an independent copy of the extension's step types.
> Unify into a shared workspace package if they start to drift.

## Design notes

- **Selector generation is pluggable** — `src/selector/index.ts` exposes a
  `SelectorStrategy` interface; the default `css-path-v1` lives in
  `cssPathStrategy.ts` and can be swapped via `setSelectorStrategy(...)`.
- **Screenshots run in the background worker** (content scripts can't call
  `captureVisibleTab`) and are **rate-limited/queued** in `screenshotQueue.ts`
  (~2/sec cap). Steps are buffered immediately; screenshots are filled in async.
- **State + buffer persist in `chrome.storage.local`** so an MV3 worker restart
  doesn't lose the recording. Mutations are serialized to avoid lost updates.
- The content script is injected on start and **re-injected after navigations**,
  so recording spans multiple pages in the recorded tab.

## Known limitations (documented pitfalls)

- **Screenshot vs. navigation:** `captureVisibleTab` is async; a click that
  navigates may produce a screenshot of the *next* page. Mitigation deferred
  (could capture on `mousedown`).
- **iframes:** the script is injected in all frames, but a bounding box from a
  cross-origin iframe is relative to *that frame's* viewport, so it won't line
  up with the full-tab screenshot; and a selector can't cross the frame
  boundary. `frameUrl` records where the click happened.
- **Shadow DOM:** the real target is resolved via `composedPath()`. Selectors
  crossing open shadow roots are emitted as `host >> inner` (a non-standard
  separator a single `querySelector` won't resolve). **Closed** shadow roots are
  inaccessible.
