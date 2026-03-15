const esbuild = require("esbuild");

const isDev = process.env.NODE_ENV !== "production";

async function build() {
  // Content script — IIFE so it runs immediately in page context
  await esbuild.build({
    entryPoints: ["src/content/index.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: "dist/content.js",
    sourcemap: isDev,
    target: "es2020",
  });

  // Popup — IIFE for browser page
  await esbuild.build({
    entryPoints: ["src/popup/index.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: "dist/popup.js",
    sourcemap: isDev,
    target: "es2020",
  });

  // Background service worker — ESM required for MV3 service workers
  await esbuild.build({
    entryPoints: ["src/background/index.ts"],
    bundle: true,
    platform: "browser",
    format: "esm",
    outfile: "dist/background.js",
    sourcemap: isDev,
    target: "es2020",
  });

  console.log("Build complete.");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
