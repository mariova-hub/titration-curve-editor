import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "/titration-curve-editor/";
const distUrl = new URL("../dist/", import.meta.url);
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "app-icon-192.png",
  "app-icon-512.png",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
];

function assert(condition, message) {
  if (!condition) throw new Error(`PWA build verification failed: ${message}`);
}

for (const relativePath of requiredFiles) {
  await access(new URL(relativePath, distUrl), constants.R_OK);
}

const assetNames = await readdir(new URL("assets/", distUrl));
assert(assetNames.some((name) => name.endsWith(".js")), "JavaScript asset is missing");
assert(assetNames.some((name) => name.endsWith(".css")), "CSS asset is missing");

const indexHtml = await readFile(new URL("index.html", distUrl), "utf8");
assert(indexHtml.includes('name="theme-color" content="#17365f"'), "theme-color metadata is missing");
for (const assetName of [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "manifest.webmanifest",
]) {
  assert(indexHtml.includes(`${BASE}${assetName}`), `${assetName} does not use the Pages base path`);
}
assert(indexHtml.includes(`${BASE}assets/`), "bundled assets do not use the Pages base path");
assert(!/(?:href|src)="\/(?!titration-curve-editor\/)/u.test(indexHtml), "root-only asset URL remains in index.html");

const manifest = JSON.parse(await readFile(new URL("manifest.webmanifest", distUrl), "utf8"));
assert(manifest.start_url === BASE, "manifest start_url is incorrect");
assert(manifest.scope === BASE, "manifest scope is incorrect");
assert(manifest.display === "standalone", "manifest display is not standalone");
assert(manifest.icons?.some((icon) => icon.src === "app-icon-192.png" && icon.sizes === "192x192"), "192px manifest icon is missing");
assert(manifest.icons?.some((icon) => icon.src === "app-icon-512.png" && icon.sizes === "512x512"), "512px manifest icon is missing");

const serviceWorker = await readFile(new URL("sw.js", distUrl), "utf8");
for (const precachedPath of [
  "index.html",
  "manifest.webmanifest",
  "app-icon-192.png",
  "app-icon-512.png",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
]) {
  assert(serviceWorker.includes(precachedPath), `${precachedPath} is not present in the precache manifest`);
}

console.log(`Verified GitHub Pages/PWA build at ${fileURLToPath(distUrl)}`);
