/*
 * Pinged — embed builder.
 * Build a webhook message with one embed, preview it the way Discord draws it,
 * check it against Discord's limits, copy the JSON or send it to your own webhook.
 * The pure parts (limits, payload, preview) work in Node for tests.
 */
(function (root) {
  "use strict";

  // Discord's documented embed limits.
  const LIMITS = { content: 2000, title: 256, description: 4096, embeds: 10, fields: 25, fieldName: 256, fieldValue: 1024, footer: 2048, author: 256, username: 80, total: 6000 };
  const WEBHOOK_RE = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{5,25}\/[\w-]{20,100}$/;

  const isHttpUrl = (s) => /^https?:\/\/[^\s"<>]+$/.test(s || "");

  // A message is text from the bot plus up to ten embeds, each with its own author, body, images, fields and footer.
  function blankEmbed() {
    return {
      authorName: "", authorUrl: "", authorIcon: "",
      title: "", url: "", description: "", color: "#5865f2",
      fields: [], image: "", thumbnail: "", footer: "", footerIcon: "", timestamp: false,
    };
  }

  function blankState() {
    return { username: "", avatarUrl: "", content: "", embeds: [blankEmbed()] };
  }

  function exampleState() {
    return Object.assign(blankState(), {
      username: "Server Bot",
      content: "New event posted!",
      embeds: [Object.assign(blankEmbed(), {
        authorName: "Events team",
        title: "Game night this Friday",
        description: "Bring friends. **Prizes** for the top three.\n\nReact below if you're coming.",
        color: "#3ba55d",
        fields: [
          { name: "When", value: "Friday, 8 PM", inline: true },
          { name: "Where", value: "#game-night", inline: true },
          { name: "Games", value: "- Among Us\n- Jackbox", inline: false },
        ],
        footer: "Hosted by the mod team",
        timestamp: true,
      })],
    });
  }

  // Copies the keys of `blank` from `src`, keeping only values of the right type.
  const fill = (blank, src) => {
    const out = blank;
    Object.keys(blank).forEach((k) => { if (src && typeof src[k] === typeof blank[k] && !Array.isArray(blank[k])) out[k] = src[k]; });
    return out;
  };

  // Reads a saved draft. Older drafts kept a single embed's fields at the top level, so those are wrapped.
  function normalizeState(saved) {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return exampleState();
    const list = (Array.isArray(saved.embeds) ? saved.embeds : [saved]).filter((e) => e && typeof e === "object").slice(0, LIMITS.embeds);
    return Object.assign(fill(blankState(), saved), {
      embeds: (list.length ? list : [{}]).map((e) => Object.assign(fill(blankEmbed(), e), {
        fields: (Array.isArray(e.fields) ? e.fields : []).filter((f) => f && typeof f === "object")
          .map((f) => ({ name: typeof f.name === "string" ? f.name : "", value: typeof f.value === "string" ? f.value : "", inline: !!f.inline })),
      })),
    });
  }

  // Every problem that would make Discord reject the message, as readable sentences.
  function validate(s) {
    const errors = [];
    const tooLong = (label, value, max) => { if ((value || "").length > max) errors.push(label + " is " + value.length + " characters; the limit is " + max + "."); };
    tooLong("Message text", s.content, LIMITS.content);
    tooLong("Bot name", s.username, LIMITS.username);
    if (s.avatarUrl && !isHttpUrl(s.avatarUrl)) errors.push("Bot avatar must be a full http(s) link.");
    if (s.embeds.length > LIMITS.embeds) errors.push("You have " + s.embeds.length + " embeds; the limit is " + LIMITS.embeds + ".");
    s.embeds.forEach((e, n) => {
      const at = s.embeds.length > 1 ? "Embed " + (n + 1) + ": " : "";
      const long = (label, value, max) => tooLong(at + label, value, max);
      long("Title", e.title, LIMITS.title);
      long("Description", e.description, LIMITS.description);
      long("Author name", e.authorName, LIMITS.author);
      long("Footer", e.footer, LIMITS.footer);
      if (e.fields.length > LIMITS.fields) errors.push(at + "You have " + e.fields.length + " fields; the limit is 25.");
      e.fields.forEach((f, i) => {
        if (!f.name.trim() || !f.value.trim()) errors.push(at + "Field " + (i + 1) + " needs both a name and a value.");
        long("Field " + (i + 1) + " name", f.name, LIMITS.fieldName);
        long("Field " + (i + 1) + " value", f.value, LIMITS.fieldValue);
      });
      [["Title link", e.url], ["Author link", e.authorUrl], ["Author icon", e.authorIcon], ["Image", e.image], ["Thumbnail", e.thumbnail], ["Footer icon", e.footerIcon]]
        .forEach(([label, v]) => { if (v && !isHttpUrl(v)) errors.push(at + label + " must be a full http(s) link."); });
    });
    // Discord counts the text of every embed in the message together.
    const total = s.embeds.reduce((sum, e) => sum + [e.title, e.description, e.authorName, e.footer].concat(e.fields.flatMap((f) => [f.name, f.value])).join("").length, 0);
    if (total > LIMITS.total) errors.push("All embed text adds up to " + total + " characters; the limit is 6000.");
    if (!s.embeds.some(hasEmbed) && !s.content.trim()) errors.push("Add some message text or embed content.");
    return errors;
  }

  function hasEmbed(e) {
    return !!(e.title || e.description || e.authorName || e.footer || e.image || e.thumbnail || e.fields.length);
  }

  // The JSON body Discord's webhook endpoint expects. Empty parts are left out.
  function toPayload(s, now) {
    const p = {};
    if (s.username) p.username = s.username;
    if (s.avatarUrl) p.avatar_url = s.avatarUrl;
    if (s.content) p.content = s.content;
    const embeds = s.embeds.filter(hasEmbed).map((x) => {
      const e = {};
      if (x.authorName) e.author = Object.assign({ name: x.authorName }, x.authorUrl && { url: x.authorUrl }, x.authorIcon && { icon_url: x.authorIcon });
      if (x.title) e.title = x.title;
      if (x.url) e.url = x.url;
      if (x.description) e.description = x.description;
      e.color = parseInt(x.color.replace("#", ""), 16) || 0;
      if (x.fields.length) e.fields = x.fields.map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
      if (x.image) e.image = { url: x.image };
      if (x.thumbnail) e.thumbnail = { url: x.thumbnail };
      if (x.footer) e.footer = Object.assign({ text: x.footer }, x.footerIcon && { icon_url: x.footerIcon });
      if (x.timestamp) e.timestamp = (now || new Date()).toISOString();
      return e;
    });
    if (embeds.length) p.embeds = embeds;
    return p;
  }

  // The reverse of toPayload: reads a webhook body (or a bare embed) back into builder state. Throws a readable Error.
  function fromPayload(input) {
    let p;
    try { p = typeof input === "string" ? JSON.parse(input) : input; } catch (e) { throw new Error("That isn't valid JSON."); }
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Expected a JSON object.");
    const isBody = ["embeds", "content", "username", "avatar_url"].some((k) => k in p);
    const list = (isBody ? (Array.isArray(p.embeds) ? p.embeds : []) : [p]).filter((e) => e && typeof e === "object").slice(0, LIMITS.embeds);
    const str = (v) => (typeof v === "string" ? v : "");
    const url = (o) => str(o && o.url);
    const embed = (e) => Object.assign(blankEmbed(), {
      authorName: str(e.author && e.author.name), authorUrl: url(e.author), authorIcon: str(e.author && e.author.icon_url),
      title: str(e.title), url: str(e.url), description: str(e.description),
      color: typeof e.color === "number" ? "#" + (e.color & 0xffffff).toString(16).padStart(6, "0") : "#5865f2",
      fields: (Array.isArray(e.fields) ? e.fields : []).filter((f) => f && typeof f === "object")
        .map((f) => ({ name: str(f.name), value: str(f.value), inline: !!f.inline })),
      image: url(e.image), thumbnail: url(e.thumbnail), footer: str(e.footer && e.footer.text), footerIcon: str(e.footer && e.footer.icon_url),
      timestamp: !!e.timestamp,
    });
    return Object.assign(blankState(), {
      username: isBody ? str(p.username) : "", avatarUrl: isBody ? str(p.avatar_url) : "", content: isBody ? str(p.content) : "",
      embeds: list.length ? list.map(embed) : [blankEmbed()],
    });
  }

  // Every picture link in the message. Showing a preview loads them, which tells those sites the page was opened.
  function pictureUrls(s) {
    const urls = [s.avatarUrl];
    s.embeds.forEach((e) => urls.push(e.authorIcon, e.image, e.thumbnail, e.footerIcon));
    return urls.filter(isHttpUrl);
  }

  // Share links carry the payload as base64url JSON, so a link reopens the builder exactly as it was.
  function toShare(s) {
    const bytes = new TextEncoder().encode(JSON.stringify(toPayload(s)));
    return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromShare(text) {
    let json;
    try {
      const raw = atob(String(text).replace(/-/g, "+").replace(/_/g, "/"));
      json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
    } catch (e) { throw new Error("That share link is damaged."); }
    return fromPayload(json);
  }

  const CODE_LANGS = [["json", "JSON"], ["curl", "curl"], ["javascript", "JavaScript"], ["python", "Python"]];
  const HOOK = "https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN";

  // The payload as something you can paste and run. Every version just POSTs the same JSON to a webhook.
  function toCode(payload, lang) {
    const json = JSON.stringify(payload, null, 2);
    if (lang === "curl") return "curl -X POST '" + HOOK + "' \\\n  -H 'Content-Type: application/json' \\\n  -d '" + json.replace(/'/g, "'\\''") + "'";
    if (lang === "javascript") return "const payload = " + json + ";\n\nawait fetch(\"" + HOOK + "\", {\n  method: \"POST\",\n  headers: { \"Content-Type\": \"application/json\" },\n  body: JSON.stringify(payload),\n});";
    if (lang === "python") return "import json\nimport requests\n\npayload = json.loads(r\"\"\"" + json + "\"\"\")\n\nrequests.post(\"" + HOOK + "\", json=payload).raise_for_status()";
    return json;
  }

  // Discord-looking preview. `md` renders markdown to safe HTML; `esc` escapes plain text.
  // With opts.blockImages, no picture is requested.
  function preview(s, md, esc, opts) {
    const block = !!(opts && opts.blockImages);
    const img = (url, cls) => (!block && isHttpUrl(url) ? '<img class="' + cls + '" src="' + esc(url) + '" alt="" referrerpolicy="no-referrer">' : "");
    const name = s.username || "Captain Hook";
    const embedHtml = (e) => {
      const author = e.authorName ? '<div class="em-author">' + img(e.authorIcon, "em-author-icon") +
        (isHttpUrl(e.authorUrl) ? '<a href="' + esc(e.authorUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(e.authorName) + "</a>" : esc(e.authorName)) + "</div>" : "";
      const title = e.title ? '<div class="em-title">' + (isHttpUrl(e.url) ? '<a href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' + md(e.title) + "</a>" : md(e.title)) + "</div>" : "";
      const desc = e.description ? '<div class="em-desc md">' + md(e.description) + "</div>" : "";
      const fields = e.fields.length ? '<div class="em-fields">' + e.fields.map((f) =>
        '<div class="em-field' + (f.inline ? " inline" : "") + '"><div class="em-field-name">' + md(f.name) + '</div><div class="em-field-value md">' + md(f.value) + "</div></div>").join("") + "</div>" : "";
      const footerText = [e.footer && esc(e.footer), e.timestamp && "Today at 4:20 PM"].filter(Boolean).join(" • ");
      const footer = footerText ? '<div class="em-footer">' + img(e.footerIcon, "em-footer-icon") + footerText + "</div>" : "";
      return '<div class="em" style="border-left-color:' + esc(/^#[0-9a-f]{6}$/i.test(e.color) ? e.color : "#1e1f22") + '"><div class="em-grid"><div class="em-main">' +
        author + title + desc + fields + "</div>" + img(e.thumbnail, "em-thumb") + "</div>" + img(e.image, "em-image") + footer + "</div>";
    };
    const avatar = !block && isHttpUrl(s.avatarUrl) ? '<img class="dc-avatar" src="' + esc(s.avatarUrl) + '" alt="" referrerpolicy="no-referrer">'
      : '<div class="dc-avatar" style="background:#5865f2" aria-hidden="true">' + esc(Array.from(name)[0].toUpperCase()) + "</div>";
    return '<div class="dc-msg">' + avatar + '<div class="dc-body"><div class="dc-head"><span class="dc-name">' + esc(name) +
      '</span><span class="dc-app">APP</span><span class="dc-stamp">Today at 4:20 PM</span></div>' +
      (s.content ? '<div class="dc-content md">' + md(s.content) + "</div>" : "") + s.embeds.filter(hasEmbed).map(embedHtml).join("") + "</div></div>";
  }

  function isWebhookUrl(url) {
    return WEBHOOK_RE.test((url || "").trim());
  }

  // Sends the message. The webhook URL is only used for this request and never saved.
  function send(url, payload) {
    if (!isWebhookUrl(url)) return Promise.reject(new Error("That doesn't look like a Discord webhook link."));
    return fetch(url.trim() + "?wait=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then((r) => {
        if (r.ok) return "Sent!";
        return r.json().catch(() => ({})).then((body) => {
          throw new Error("Discord said " + r.status + (body.message ? ": " + body.message : "") + ".");
        });
      });
  }

  const api = { LIMITS, CODE_LANGS, blankEmbed, blankState, exampleState, normalizeState, pictureUrls, validate, toPayload, fromPayload, toShare, fromShare, toCode, preview, isWebhookUrl, send };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedEmbed = api;
})(typeof window !== "undefined" ? window : globalThis);
