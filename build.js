const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Load .env manually (no extra dependency needed)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Generate manifest.json from manifest.template.json
// ---------------------------------------------------------------------------
function generateManifest() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is not set. Add it to your .env file:\n  GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com"
    );
  }
  const template = fs.readFileSync(
    path.resolve(__dirname, "manifest.template.json"),
    "utf8"
  );
  const manifest = template.replace("__GOOGLE_CLIENT_ID__", clientId);
  fs.writeFileSync(path.resolve(__dirname, "manifest.json"), manifest, "utf8");
  console.log("manifest.json generated.");
}

async function build() {
  loadEnv();
  generateManifest();
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
