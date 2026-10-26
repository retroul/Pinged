// Run with: node --test test/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const local = (url) => !/^(https?:)?\/\//.test(url);

test("service worker caches every local file the page loads, and each one exists", () => {
  const shell = JSON.parse(/const SHELL = (\[[\s\S]*?\]);/.exec(read("sw.js"))[1].replace(/,\s*\]$/, "]"));
  const html = read("index.html");
  const loaded = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter(local)
    .filter((u) => /\.(js|css|webmanifest|svg)$/.test(u));
  for (const f of loaded) assert.ok(shell.includes(f), f + " is loaded by index.html but not cached by sw.js");
  for (const f of shell) assert.ok(f === "./" || fs.existsSync(path.join(root, f)), f + " is cached by sw.js but missing");
});

test("manifest icons exist", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.ok(manifest.icons.some((i) => i.sizes === "192x192") && manifest.icons.some((i) => i.sizes === "512x512"), "installable apps need 192 and 512 icons");
  for (const i of manifest.icons) assert.ok(fs.existsSync(path.join(root, i.src)), i.src + " is missing");
});

test("freshness check counts whole days since the content was last checked", () => {
  const { daysSince, MAX_DAYS } = require("../scripts/check-fresh.js");
  const now = new Date("2026-10-25T12:00:00Z");
  assert.strictEqual(daysSince("2026-10-25", now), 0);
  assert.strictEqual(daysSince("2026-10-21", now), 4);
  assert.ok(daysSince("2026-09-01", now) > MAX_DAYS);
});

test("files from other sites carry an integrity hash, and the page has a script policy", () => {
  const html = read("index.html");
  for (const tag of html.match(/<(?:script|link)\b[^>]*(?:src|href)="https:\/\/[^"]*\.(?:js|css)"[^>]*>/g) || []) {
    assert.match(tag, /integrity="sha(256|384|512)-/, "missing integrity: " + tag);
    assert.match(tag, /crossorigin="anonymous"/, "missing crossorigin: " + tag);
  }
  assert.match(html, /http-equiv="Content-Security-Policy" content="[^"]*script-src 'self' https:\/\/cdnjs.cloudflare.com;/);
  assert.doesNotMatch(html, /<script>/, "inline scripts are blocked by the policy; put them in a file");
});
