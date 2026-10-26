// Run with: node --test test/
const test = require("node:test");
const assert = require("node:assert");
const MD = require("../js/markdown.js");
const D = require("../js/discord.js");
const EMBED = require("../js/embed.js");

const says = (src, re) => MD.lint(src).some((x) => re.test(x.text));

test("checker finds the usual formatting mistakes", () => {
  assert.ok(says("#nospace", /space after the #/));
  assert.ok(says("#### too deep", /three/));
  assert.ok(says("-#small", /Subtext/));
  assert.ok(says("a\n---\nb", /horizontal/));
  assert.ok(says("| a | b |\n| --- | --- |\n| 1 | 2 |", /tables/));
  assert.ok(says("![cat](https://x.test/cat.png)", /images/));
  assert.ok(says("[site](discord.com)", /https/));
  assert.ok(says("<b>hi</b>", /HTML/));
  assert.ok(says("hi <@nelly>", /numeric ID/));
  assert.ok(says("<t:1792598400000:R>", /milliseconds/));
  assert.ok(says("<t:soon>", /Unix seconds/));
  assert.ok(says("||secret", /spoiler/i));
  assert.ok(says("**bold", /Bold/));
  assert.ok(says("```js\nlet a", /never closes/));
});

test("checker reports the right line and stays quiet on valid messages", () => {
  assert.deepStrictEqual(MD.lint("fine\n\n#oops").map((x) => x.line), [3]);
  const good = "# Title\n-# small\n**bold** __under__ ~~gone~~ ||hidden||\n[a](https://a.test) [b](<https://b.test>)\n<@80351110224678912> <#103735883630395392> <t:1792598400:R>\n```js\n#not a header **\n```\n`**` and \\*escaped";
  assert.deepStrictEqual(MD.lint(good), []);
  assert.deepStrictEqual(MD.lint("***bold italics***"), []);
  // Role, nickname and channel mentions are valid; so are "#1" and C#.
  assert.deepStrictEqual(MD.lint("<@&165511591545143296> <@!80351110224678912> <#103735883630395392>\n#1 priority, I love C#"), []);
  assert.ok(says("<@&moderators>", /numeric ID/) && says("<#general>", /numeric ID/));
});

test("every template and content example passes the checker", () => {
  global.window = {};
  delete require.cache[require.resolve("../js/content.js")];
  require("../js/content.js");
  const C = window.PingedContent;
  (C.templates || []).forEach((t) => assert.deepStrictEqual(MD.lint(t.src), [], t.name));
  C.markdown.forEach((s) => s.examples.forEach((e) => assert.deepStrictEqual(MD.lint(e.src), [], s.id + ": " + e.label)));
});

test("permission flags convert both ways, past 2^53", () => {
  assert.strictEqual(D.flagsToInt(["VIEW_CHANNEL", "SEND_MESSAGES"]), "3072");
  assert.strictEqual(D.flagsToInt(["ADMINISTRATOR"]), "8");
  assert.strictEqual(D.flagsToInt(["BYPASS_SLOWMODE"]), String(2 ** 52));
  assert.strictEqual(D.flagsToInt(["NOT_A_FLAG"]), "0");
  const all = D.PERMISSIONS.map(([f]) => f);
  assert.deepStrictEqual(D.intToFlags(D.flagsToInt(all)).flags.sort(), all.slice().sort());
  assert.deepStrictEqual(D.intToFlags("3072"), { flags: ["VIEW_CHANNEL", "SEND_MESSAGES"], unknown: "0" });
  assert.strictEqual(D.intToFlags("2147483648").flags[0], "USE_APPLICATION_COMMANDS");
  assert.strictEqual(D.intToFlags(String(2 ** 47)).unknown, String(2 ** 47));
  assert.strictEqual(D.intToFlags("12abc"), null);
  assert.strictEqual(D.intToFlags(""), null);
});

test("permission bits are unique and in range", () => {
  const bits = D.PERMISSIONS.map(([, b]) => b);
  assert.strictEqual(new Set(bits).size, bits.length);
  assert.ok(bits.every((b) => b >= 0 && b <= 52 && b !== 47));
});

test("invite link", () => {
  assert.strictEqual(D.inviteUrl(" 123456789012345678 ", "8"),
    "https://discord.com/oauth2/authorize?client_id=123456789012345678&scope=bot%20applications.commands&permissions=8");
});

test("snowflakes decode to their creation time", () => {
  // The example from Discord's developer docs.
  const s = D.decodeSnowflake("175928847299117063");
  assert.strictEqual(s.iso, "2016-04-30T11:18:25.796Z");
  assert.deepStrictEqual([s.worker, s.process, s.increment], [1, 0, 7]);
  assert.strictEqual(s.unix, Date.UTC(2016, 3, 30, 11, 18, 25) / 1000);
  assert.strictEqual(D.decodeSnowflake("123"), null);
  assert.strictEqual(D.decodeSnowflake("99999999999999999999"), null);
  assert.strictEqual(D.decodeSnowflake("abc"), null);
});

test("embed JSON imports back into the builder", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const state = EMBED.exampleState();
  const payload = EMBED.toPayload(state, now);
  assert.deepStrictEqual(EMBED.toPayload(EMBED.fromPayload(JSON.stringify(payload)), now), payload);
  // A bare embed works too.
  assert.strictEqual(EMBED.fromPayload({ title: "Hi", color: 255 }).embeds[0].color, "#0000ff");
  assert.strictEqual(EMBED.fromPayload('{"content":"hey"}').content, "hey");
  assert.throws(() => EMBED.fromPayload("{nope"), /valid JSON/);
  assert.throws(() => EMBED.fromPayload("[1]"), /object/);
  // Wrong types are ignored, not trusted.
  const odd = EMBED.fromPayload({ embeds: [{ title: 5, fields: [null, { name: "a", value: 1 }] }] }).embeds[0];
  assert.strictEqual(odd.title, "");
  assert.deepStrictEqual(odd.fields, [{ name: "a", value: "", inline: false }]);
});

test("copy-as-code keeps the payload intact", () => {
  const payload = EMBED.toPayload(Object.assign(EMBED.blankState(), { content: "it's \"quoted\"\nline two" }));
  assert.strictEqual(EMBED.toCode(payload, "json"), JSON.stringify(payload, null, 2));
  const curl = EMBED.toCode(payload, "curl");
  assert.ok(curl.startsWith("curl -X POST 'https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN'"));
  assert.ok(curl.includes("it'\\''s"));
  assert.ok(EMBED.toCode(payload, "javascript").includes("const payload = {"));
  const py = EMBED.toCode(payload, "python");
  assert.ok(py.includes('json.loads(r"""{') && py.includes('requests.post('));
  EMBED.CODE_LANGS.forEach(([id]) => assert.ok(EMBED.toCode(payload, id).length > 0));
});

test("embed share links round-trip, including non-ASCII text", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const state = EMBED.exampleState();
  Object.assign(state.embeds[0], { title: "Café ☕ 日本語 👋", footer: "a+b/c=d?" });
  const code = EMBED.toShare(state);
  assert.match(code, /^[\w-]+$/, "safe to put in a URL without escaping");
  assert.deepStrictEqual(EMBED.toPayload(EMBED.fromShare(code), now), EMBED.toPayload(state, now));
  assert.throws(() => EMBED.fromShare("%%%"), /damaged/);
  assert.throws(() => EMBED.fromShare("bm9wZQ"), /valid JSON/);
});

const embedWith = (embed) => Object.assign(EMBED.blankEmbed(), embed);

test("a message can carry several embeds, with Discord's limits across all of them", () => {
  const state = Object.assign(EMBED.blankState(), { embeds: [embedWith({ title: "One" }), embedWith({ title: "Two", color: "#ff0000" }), EMBED.blankEmbed()] });
  const payload = EMBED.toPayload(state);
  assert.deepStrictEqual(payload.embeds.map((e) => e.title), ["One", "Two"], "empty embeds are left out");
  assert.deepStrictEqual(EMBED.toPayload(EMBED.fromShare(EMBED.toShare(state))), payload);
  assert.deepStrictEqual(EMBED.validate(state), []);

  const eleven = Object.assign(EMBED.blankState(), { embeds: Array.from({ length: 11 }, (_, i) => embedWith({ title: "e" + i })) });
  assert.ok(EMBED.validate(eleven).some((e) => /11 embeds/.test(e)));
  assert.strictEqual(EMBED.fromPayload({ embeds: eleven.embeds }).embeds.length, 10, "import stops at ten");

  // 4 x 2000 = 8000 characters: each embed is fine alone, the message as a whole is not.
  const big = Object.assign(EMBED.blankState(), { embeds: Array.from({ length: 4 }, () => embedWith({ description: "x".repeat(2000) })) });
  assert.ok(EMBED.validate(big).some((e) => /8000 characters/.test(e)));
  const twoBad = Object.assign(EMBED.blankState(), { embeds: [embedWith({ title: "ok" }), embedWith({ image: "nope" })] });
  assert.ok(EMBED.validate(twoBad).some((e) => /^Embed 2: Image/.test(e)), "errors say which embed");
});

test("drafts saved before multi-embed still load", () => {
  const old = { username: "Bot", content: "hi", title: "Old title", color: "#ff0000", fields: [{ name: "a", value: "b", inline: true }], footer: "f", timestamp: true };
  const s = EMBED.normalizeState(old);
  assert.strictEqual(s.username, "Bot");
  assert.strictEqual(s.embeds.length, 1);
  assert.deepStrictEqual([s.embeds[0].title, s.embeds[0].color, s.embeds[0].fields.length, s.embeds[0].timestamp], ["Old title", "#ff0000", 1, true]);
  assert.strictEqual(EMBED.normalizeState(null).embeds[0].title, "Game night this Friday");
  assert.strictEqual(EMBED.normalizeState({ embeds: [] }).embeds.length, 1);
  assert.strictEqual(EMBED.normalizeState({ username: 5, embeds: [{ title: 7 }] }).embeds[0].title, "", "wrong types are dropped");
});

test("pictures from a shared link can be held back until the visitor agrees", () => {
  const state = Object.assign(EMBED.blankState(), { avatarUrl: "https://tracker.test/a.png", embeds: [embedWith({ title: "t", image: "https://tracker.test/i.png", thumbnail: "javascript:x" })] });
  assert.deepStrictEqual(EMBED.pictureUrls(state), ["https://tracker.test/a.png", "https://tracker.test/i.png"]);
  const render = (opts) => EMBED.preview(state, (t) => MD.render(t), MD.escapeHtml, opts);
  assert.match(render(), /<img[^>]+tracker\.test\/i\.png/);
  const held = render({ blockImages: true });
  assert.doesNotMatch(held, /<img|tracker\.test/);
  assert.match(held, /Title|>t</, "the text still shows");
});

test("polls build Discord's poll object, survive import and share links, and respect the limits", () => {
  const state = Object.assign(EMBED.blankState(), { content: "Vote!", poll: {
    question: "Movie night?", answers: [{ text: "Yes", emoji: "🍿" }, { text: "No", emoji: "<:nope:123456789012345678>" }], duration: 72, multi: true } });
  assert.deepStrictEqual(EMBED.validate(state), []);
  const p = EMBED.toPayload(state);
  assert.deepStrictEqual(p.poll, {
    question: { text: "Movie night?" }, duration: 72, allow_multiselect: true,
    answers: [{ poll_media: { text: "Yes", emoji: { name: "🍿" } } }, { poll_media: { text: "No", emoji: { id: "123456789012345678" } } }],
  });
  assert.deepStrictEqual(EMBED.toPayload(EMBED.fromPayload(JSON.stringify(p))), p);
  assert.deepStrictEqual(EMBED.toPayload(EMBED.fromShare(EMBED.toShare(state))), p);
  assert.ok(EMBED.validate(Object.assign(EMBED.blankState(), { poll: EMBED.blankPoll() })).some((e) => /question/.test(e)), "an empty poll is invalid");
  const long = Object.assign(EMBED.blankState(), { poll: { question: "q".repeat(301), answers: [{ text: "a".repeat(56), emoji: "" }], duration: 24, multi: false } });
  const errs = EMBED.validate(long).join(" ");
  assert.match(errs, /Poll question is 301/);
  assert.match(errs, /Poll answer 1 is 56/);
  assert.strictEqual(EMBED.normalizeState({ poll: { question: "x", answers: [], duration: 9999 } }).poll.duration, 24, "bad lengths fall back to a day");
  const html = EMBED.preview(state, (t) => MD.render(t), MD.escapeHtml);
  assert.match(html, /class="poll"/);
  assert.match(EMBED.preview(Object.assign(EMBED.blankState(), { poll: { question: "<b>x</b>", answers: [], duration: 1, multi: false } }), MD.render, MD.escapeHtml), /&lt;b&gt;x/);
});

test("message links and IDs are read for editing", () => {
  assert.deepStrictEqual(EMBED.parseMessageRef("https://discord.com/channels/1/22/333333333333333333"), { channelId: "22", messageId: "333333333333333333" });
  assert.deepStrictEqual(EMBED.parseMessageRef(" 333333333333333333 "), { channelId: null, messageId: "333333333333333333" });
  assert.strictEqual(EMBED.parseMessageRef("https://evil.test/channels/1/2/3"), null);
  assert.strictEqual(EMBED.parseMessageRef("12/../webhooks"), null);
  const edit = EMBED.toEditPayload(Object.assign(EMBED.blankState(), { username: "Bot", embeds: [EMBED.blankEmbed()] }));
  assert.deepStrictEqual(edit, { content: "", embeds: [] }, "an edit clears what's gone and leaves out name and avatar");
});

test("editing PATCHes the webhook message, and retries as a thread message when Discord can't find it", async () => {
  const hook = "https://discord.com/api/webhooks/123456/" + "t".repeat(60);
  const calls = [];
  global.fetch = (url, opts) => {
    calls.push([opts.method, url]);
    const ok = url.includes("thread_id=22");
    return Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve({ message: "Unknown Message" }) });
  };
  const state = Object.assign(EMBED.blankState(), { content: "new text" });
  assert.strictEqual(await EMBED.send(hook, state, { channelId: "22", messageId: "333333333333333333" }), "Updated!");
  assert.deepStrictEqual(calls, [["PATCH", hook + "/messages/333333333333333333"], ["PATCH", hook + "/messages/333333333333333333?thread_id=22"]]);
  await assert.rejects(EMBED.send(hook, state, { channelId: null, messageId: "333333333333333333" }), /404: Unknown Message/);
  await assert.rejects(EMBED.send(hook, Object.assign(state, { poll: EMBED.blankPoll() }), { channelId: null, messageId: "1" }), /edit add a poll/);
  delete global.fetch;
});
