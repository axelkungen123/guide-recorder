import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const OUTDIR = "dist";
const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/popup.ts",
  },
  outdir: OUTDIR,
  bundle: true,
  // IIFE (not ESM): content scripts injected via chrome.scripting are classic
  // scripts and cannot use ES module `import`. Everything is bundled, so there
  // are no runtime imports anyway.
  format: "iife",
  platform: "browser",
  target: ["chrome110"],
  sourcemap: true,
  logLevel: "info",
};

async function copyStatic() {
  // manifest.json, popup.html, icons/ -> dist/
  await cp("public", OUTDIR, { recursive: true });
}

await rm(OUTDIR, { recursive: true, force: true });
await mkdir(OUTDIR, { recursive: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  await copyStatic();
  console.log("[build] watching… (static files are not re-copied on change)");
} else {
  await build(options);
  await copyStatic();
  console.log("[build] done -> dist/");
}
