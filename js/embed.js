/*
 * Pinged — embed builder.
 * Build a webhook message with one embed, preview it the way Discord draws it,
 * check it against Discord's limits, copy the JSON or send it to your own webhook.
 * The pure parts (limits, payload, preview) work in Node for tests.
 */
(function (root) {
  "use strict";

  // Discord's documented embed limits.
  const LIMITS = { content: 2000, title: 256, description: 4096, fields: 25, fieldName: 256, fieldValue: 1024, footer: 2048, author: 256, username: 80, total: 6000 };
  const WEBHOOK_RE = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{5,25}\/[\w-]{20,100}$/;

  const isHttpUrl = (s) => /^https?:\/\/[^\s"<>]+$/.test(s || "");

  function blankState() {
    return {
      username: "", avatarUrl: "", content: "",
      authorName: "", authorUrl: "", authorIcon: "",
      title: "", url: "", description: "", color: "#5865f2",
      fields: [], image: "", thumbnail: "", footer: "", footerIcon: "", timestamp: false,
    };
  }

  function exampleState() {
    return Object.assign(blankState(), {
      username: "Server Bot",
      content: "New event posted!",
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
    });
  }

  // Every problem that would make Discord reject the message, as readable sentences.
  function validate(s) {
    const errors = [];
    const tooLong = (label, value, max) => { if ((value || "").length > max) errors.push(label + " is " + value.length + " characters; the limit is " + max + "."); };
    tooLong("Message text", s.content, LIMITS.content);
    tooLong("Bot name", s.username, LIMITS.username);
    tooLong("Title", s.title, LIMITS.title);
    tooLong("Description", s.description, LIMITS.description);
    tooLong("Author name", s.authorName, LIMITS.author);
    tooLong("Footer", s.footer, LIMITS.footer);
    if (s.fields.length > LIMITS.fields) errors.push("You have " + s.fields.length + " fields; the limit is 25.");
    s.fields.forEach((f, i) => {
      if (!f.name.trim() || !f.value.trim()) errors.push("Field " + (i + 1) + " needs both a name and a value.");
      tooLong("Field " + (i + 1) + " name", f.name, LIMITS.fieldName);
      tooLong("Field " + (i + 1) + " value", f.value, LIMITS.fieldValue);
    });
    [["Title link", s.url], ["Author link", s.authorUrl], ["Author icon", s.authorIcon], ["Image", s.image], ["Thumbnail", s.thumbnail], ["Footer icon", s.footerIcon], ["Bot avatar", s.avatarUrl]]
      .forEach(([label, v]) => { if (v && !isHttpUrl(v)) errors.push(label + " must be a full http(s) link."); });
    const total = [s.title, s.description, s.authorName, s.footer].concat(s.fields.flatMap((f) => [f.name, f.value])).join("").length;
    if (total > LIMITS.total) errors.push("All embed text adds up to " + total + " characters; the limit is 6000.");
    if (!hasEmbed(s) && !s.content.trim()) errors.push("Add some message text or embed content.");
    return errors;
  }

  function hasEmbed(s) {
    return !!(s.title || s.description || s.authorName || s.footer || s.image || s.thumbnail || s.fields.length);
  }

  // The JSON body Discord's webhook endpoint expects. Empty parts are left out.
  function toPayload(s, now) {
    const p = {};
    if (s.username) p.username = s.username;
    if (s.avatarUrl) p.avatar_url = s.avatarUrl;
    if (s.content) p.content = s.content;
    if (hasEmbed(s)) {
      const e = {};
      if (s.authorName) e.author = Object.assign({ name: s.authorName }, s.authorUrl && { url: s.authorUrl }, s.authorIcon && { icon_url: s.authorIcon });
      if (s.title) e.title = s.title;
      if (s.url) e.url = s.url;
      if (s.description) e.description = s.description;
      e.color = parseInt(s.color.replace("#", ""), 16) || 0;
      if (s.fields.length) e.fields = s.fields.map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
      if (s.image) e.image = { url: s.image };
      if (s.thumbnail) e.thumbnail = { url: s.thumbnail };
      if (s.footer) e.footer = Object.assign({ text: s.footer }, s.footerIcon && { icon_url: s.footerIcon });
      if (s.timestamp) e.timestamp = (now || new Date()).toISOString();
      p.embeds = [e];
    }
    return p;
  }

  // The reverse of toPayload: reads a webhook body (or a bare embed) back into builder state. Throws a readable Error.
  function fromPayload(input) {
    let p;
    try { p = typeof input === "string" ? JSON.parse(input) : input; } catch (e) { throw new Error("That isn't valid JSON."); }
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Expected a JSON object.");
    const isBody = ["embeds", "content", "username", "avatar_url"].some((k) => k in p);
    const e = (isBody ? (Array.isArray(p.embeds) && p.embeds[0]) : p) || {};
    const str = (v) => (typeof v === "string" ? v : "");
    const url = (o) => str(o && o.url);
    return Object.assign(blankState(), {
      username: str(p.username), avatarUrl: str(p.avatar_url), content: str(p.content),
      authorName: str(e.author && e.author.name), authorUrl: url(e.author), authorIcon: str(e.author && e.author.icon_url),
      title: str(e.title), url: str(e.url), description: str(e.description),
      color: typeof e.color === "number" ? "#" + (e.color & 0xffffff).toString(16).padStart(6, "0") : "#5865f2",
      fields: (Array.isArray(e.fields) ? e.fields : []).filter((f) => f && typeof f === "object")
        .map((f) => ({ name: str(f.name), value: str(f.value), inline: !!f.inline })),
      image: url(e.image), thumbnail: url(e.thumbnail), footer: str(e.footer && e.footer.text), footerIcon: str(e.footer && e.footer.icon_url),
      timestamp: !!e.timestamp,
    });
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
  function preview(s, md, esc) {
    const img = (url, cls) => (isHttpUrl(url) ? '<img class="' + cls + '" src="' + esc(url) + '" alt="" referrerpolicy="no-referrer">' : "");
    const name = s.username || "Captain Hook";
    let embed = "";
    if (hasEmbed(s)) {
      const author = s.authorName ? '<div class="em-author">' + img(s.authorIcon, "em-author-icon") +
        (isHttpUrl(s.authorUrl) ? '<a href="' + esc(s.authorUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(s.authorName) + "</a>" : esc(s.authorName)) + "</div>" : "";
      const title = s.title ? '<div class="em-title">' + (isHttpUrl(s.url) ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + md(s.title) + "</a>" : md(s.title)) + "</div>" : "";
      const desc = s.description ? '<div class="em-desc md">' + md(s.description) + "</div>" : "";
      const fields = s.fields.length ? '<div class="em-fields">' + s.fields.map((f) =>
        '<div class="em-field' + (f.inline ? " inline" : "") + '"><div class="em-field-name">' + md(f.name) + '</div><div class="em-field-value md">' + md(f.value) + "</div></div>").join("") + "</div>" : "";
      const footerText = [s.footer && esc(s.footer), s.timestamp && "Today at 4:20 PM"].filter(Boolean).join(" • ");
      const footer = footerText ? '<div class="em-footer">' + img(s.footerIcon, "em-footer-icon") + footerText + "</div>" : "";
      embed = '<div class="em" style="border-left-color:' + esc(/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#1e1f22") + '"><div class="em-grid"><div class="em-main">' +
        author + title + desc + fields + "</div>" + img(s.thumbnail, "em-thumb") + "</div>" + img(s.image, "em-image") + footer + "</div>";
    }
    const avatar = isHttpUrl(s.avatarUrl) ? '<img class="dc-avatar" src="' + esc(s.avatarUrl) + '" alt="" referrerpolicy="no-referrer">'
      : '<div class="dc-avatar" style="background:#5865f2" aria-hidden="true">' + esc(name[0].toUpperCase()) + "</div>";
    return '<div class="dc-msg">' + avatar + '<div class="dc-body"><div class="dc-head"><span class="dc-name">' + esc(name) +
      '</span><span class="dc-app">APP</span><span class="dc-stamp">Today at 4:20 PM</span></div>' +
      (s.content ? '<div class="dc-content md">' + md(s.content) + "</div>" : "") + embed + "</div></div>";
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

  const api = { LIMITS, CODE_LANGS, blankState, exampleState, validate, toPayload, fromPayload, toCode, preview, isWebhookUrl, send };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedEmbed = api;
})(typeof window !== "undefined" ? window : globalThis);
