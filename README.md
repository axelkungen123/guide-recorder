# guide-recorder (monorepo)

Technical spike: a Chrome extension that records a user's clicks and captures
structured **step context** for later generating step-by-step guides. The goal
is only to prove capture works reliably — no backend, AI, editing, or extra UI.

```
shared/      # Shared TypeScript types (capture types + api DTOs) — single source of truth
extension/   # Chrome MV3 extension (TypeScript) — records clicks, captures steps
api/         # Backend (Hono + node:sqlite) — ingests and serves recordings
web/         # Viewer (Vite + React) — lists recordings, shows steps with a bbox overlay
```

All packages are npm workspaces. Types live once in `@guide-recorder/shared` and
are imported (type-only) by the other three, so they can't drift.

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
| `GET` | `/recordings/:id/guide` | guide — saved edits if any, else generated (JSON) |
| `PUT` | `/recordings/:id/guide` | save an edited guide |
| `POST` | `/recordings/:id/guide/reset` | discard edits, regenerate |
| `GET` | `/recordings/:id/guide.md` | the current guide as a downloadable Markdown file |
| `GET` | `/recordings/:id/guide.html` | self-contained HTML guide (screenshots inlined as data URIs) |
| `DELETE` | `/recordings/:id` | remove recording + its screenshots |

**Guides** are generated deterministically from each step's primary locator +
text (`api/src/guide.ts`) — no AI. A `role=link[name="Shorts"]` step becomes
"Klicka på länken **Shorts**"; page changes are noted between steps.

The viewer's **Guide** tab is **editable**: rename the guide, reorder / delete
steps, and rewrite any instruction. Edits are saved as an overlay (the recording
stays immutable as the ground-truth capture) and are reflected in the `.md`
download; "Återställ till genererad" discards them. (A later pass could send the
steps to an LLM for nicer prose.)

The extension still downloads JSON locally; wiring it to POST here is the next
step (not done yet).

> Note: `api/src/types.ts` is an independent copy of the extension's step types.
> Unify into a shared workspace package if they start to drift.

## Web viewer (`web/`)

Vite + React + TypeScript. Reads only from the api.

```bash
npm run api:dev      # terminal 1 — http://localhost:8787
npm run web:dev      # terminal 2 — http://localhost:5173
```

Lists recordings; clicking one shows each step with the screenshot, a **bounding-box
overlay**, and the captured selector / text / url_pattern / flags. The overlay maps
the CSS-px bbox onto the screenshot using the captured `viewport` (scale =
renderedWidth / viewport.width, DPR-independent); it's skipped for iframe clicks
where the full-tab screenshot doesn't match the frame-relative bbox. Override the
api URL with `VITE_API_BASE_URL`.

## Design notes

- **Locators, not just CSS** — each step carries a ranked `locators[]` list
  (best first): `testid` → `role`+accessible-name → `text` → `css` fallback
  (Playwright-ish). Role/name come from a pragmatic ARIA subset
  (`src/selector/aria.ts`); the CSS fallback comes from the swappable strategy.
  `selectorQuality.robustness` grades the **primary** locator, and the viewer
  shows the whole ranked chain. This gives downstream replay/guide-generation
  several ways to re-find an element.
- **Selector generation is pluggable** — `src/selector/index.ts` exposes a
  `SelectorStrategy` interface; the default `css-path-v1` lives in
  `cssPathStrategy.ts` and can be swapped via `setSelectorStrategy(...)`. It
  prefers stable anchors (`data-testid`, `aria-label`, `name`, non-generated
  `id`) before falling back to a `:nth-of-type` path.
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
