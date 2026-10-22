// Run with: node --test test/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const LIVE = require("../js/live.js");
const EMBED = require("../js/embed.js");
const MD = require("../js/markdown.js");
const { buildFeed, OUT } = require("../scripts/build-feed.js");

test("experiment comments are parsed", () => {
  const body = "## Strings\n```diff\n+ a: \"b\"\n```\n## New Apex Experiments\n```diff\n+ 2026-10-user-profile-widget-suggestions (user)\n * Variant 1\n * Variant 2\n+ 2026-10-other (guild)\n```\n" +
    "## Removed Apex Experiments\n```diff\n- 2025-01-old-thing (user)\n```";
  const items = LIVE.parseExperimentComment({ body, created_at: "2026-10-21T19:01:16Z", html_url: "https://github.com/x" });
  assert.deepStrictEqual(items.map((i) => [i.id, i.kind, i.change, i.variants.length]), [
    ["2026-10-user-profile-widget-suggestions", "user", "added", 2],
    ["2026-10-other", "guild", "added", 0],
    ["2025-01-old-thing", "user", "removed", 0],
  ]);
  assert.strictEqual(LIVE.readableName("2026-10-user-profile-widget-suggestions"), "User profile widget suggestions");
  assert.strictEqual(LIVE.readableName("2026-06_guild_space"), "Guild space");
  assert.strictEqual(LIVE.lastPageFromLink('<https://api.github.com/x?per_page=100&page=2>; rel="next", <https://api.github.com/x?per_page=100&page=210>; rel="last"'), 210);
});

test("status components are grouped in page order", () => {
  const groups = LIVE.groupComponents([
    { id: "g", name: "Voice", status: "operational", group: true, position: 2 },
    { id: "a", name: "API", status: "operational", position: 1 },
    { id: "r", name: "Rotterdam", status: "major_outage", group_id: "g", position: 1 },
  ]);
  assert.deepStrictEqual(groups.map((g) => [g.name, g.items.map((i) => i.name)]), [["Voice", ["Rotterdam"]], ["API", []]]);
});

test("embed payload and limits", () => {
  const s = EMBED.exampleState();
  assert.deepStrictEqual(EMBED.validate(s), []);
  const p = EMBED.toPayload(s, new Date("2026-10-21T00:00:00Z"));
  assert.strictEqual(p.embeds[0].color, 0x3ba55d);
  assert.strictEqual(p.embeds[0].fields.length, 3);
  assert.strictEqual(p.embeds[0].timestamp, "2026-10-21T00:00:00.000Z");
  assert.ok(!("image" in p.embeds[0]));
  assert.ok(EMBED.validate(Object.assign(EMBED.blankState(), { title: "x".repeat(257) })).some((e) => /Title/.test(e)));
  assert.ok(EMBED.validate(Object.assign(EMBED.blankState(), { content: "hi", image: "javascript:alert(1)" })).some((e) => /Image/.test(e)));
  assert.ok(EMBED.validate(EMBED.blankState()).length > 0); // empty message
});

test("embed preview escapes everything", () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const s = Object.assign(EMBED.blankState(), { username: evil, authorName: evil, footer: evil, color: evil, thumbnail: 'https://a.com/"onerror="x', fields: [{ name: evil, value: evil, inline: true }] });
  const html = EMBED.preview(s, (t) => MD.render(t), MD.escapeHtml);
  assert.doesNotMatch(html, /<img src=x|" onerror=|"onerror="/);
});

test("only Discord webhook links are accepted", () => {
  assert.ok(EMBED.isWebhookUrl("https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_-0123"));
  assert.ok(!EMBED.isWebhookUrl("https://evil.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"));
  assert.ok(!EMBED.isWebhookUrl("https://discord.com.evil.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"));
});

test("feed.xml is up to date with content (run: node scripts/build-feed.js)", () => {
  assert.strictEqual(fs.readFileSync(OUT, "utf8"), buildFeed());
});

test("every entry has a unique link id", () => {
  global.window = {};
  delete require.cache[require.resolve("../js/content.js")];
  require("../js/content.js");
  const C = window.PingedContent;
  const ids = C.updates.map(C.updateId).concat(C.experiments.map((e) => C.slug(e.name)));
  assert.strictEqual(new Set(ids).size, ids.length);
});
