/*
 * Pinged — embed builder.
 * Build a webhook message (text, up to ten embeds, a poll), preview it the way Discord draws it,
 * check it against Discord's limits, copy the JSON, send it to your own webhook or edit a message it sent.
 * The pure parts (limits, payload, preview) work in Node for tests.
 */
(function (root) {
  "use strict";

  // Discord's documented embed limits.
  const LIMITS = { content: 2000, title: 256, description: 4096, embeds: 10, fields: 25, fieldName: 256, fieldValue: 1024, footer: 2048, author: 256, username: 80, total: 6000,
    pollQuestion: 300, pollAnswer: 55, pollAnswers: 10, pollHours: 768 };
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
    return { username: "", avatarUrl: "", content: "", embeds: [blankEmbed()], poll: null };
  }

  // A poll is off (null) until added. `duration` is in hours; Discord allows 1 to 768 (32 days).
  function blankPoll() {
    return { question: "", answers: [{ text: "", emoji: "" }, { text: "", emoji: "" }], duration: 24, multi: false };
  }

  function normalizePoll(p) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const str = (v) => (typeof v === "string" ? v : "");
    const hours = Math.round(Number(p.duration));
    return {
      question: str(p.question),
      answers: (Array.isArray(p.answers) ? p.answers : []).filter((a) => a && typeof a === "object").slice(0, LIMITS.pollAnswers)
        .map((a) => ({ text: str(a.text), emoji: str(a.emoji) })),
      duration: hours >= 1 && hours <= LIMITS.pollHours ? hours : 24,
      multi: !!p.multi,
    };
  }

  // "<:party:123>" → { id: "123" }; "🎉" → { name: "🎉" }; "" → null.
  function pollEmoji(text) {
    const t = (text || "").trim();
    const custom = /^<a?:\w+:(\d{1,20})>$/.exec(t);
    return custom ? { id: custom[1] } : t ? { name: t } : null;
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
      poll: normalizePoll(saved.poll),
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
    const total = embedTextLength(s);
    if (total > LIMITS.total) errors.push("All embed text adds up to " + total + " characters; the limit is 6000.");
    if (s.poll) {
      const p = s.poll;
      if (!p.question.trim()) errors.push("Poll: add a question.");
      tooLong("Poll question", p.question, LIMITS.pollQuestion);
      if (!p.answers.length) errors.push("Poll: add at least one answer.");
      if (p.answers.length > LIMITS.pollAnswers) errors.push("Poll: you have " + p.answers.length + " answers; the limit is 10.");
      p.answers.forEach((a, i) => {
        if (!a.text.trim()) errors.push("Poll answer " + (i + 1) + " needs text.");
        tooLong("Poll answer " + (i + 1), a.text, LIMITS.pollAnswer);
      });
      if (!(p.duration >= 1 && p.duration <= LIMITS.pollHours)) errors.push("Poll length must be 1 to 768 hours (32 days).");
    }
    if (!s.embeds.some(hasEmbed) && !s.content.trim() && !s.poll) errors.push("Add some message text, embed content or a poll.");
    return errors;
  }

  // Discord counts the text of every embed in the message together, against a 6000 limit.
  function embedTextLength(s) {
    return s.embeds.reduce((sum, e) => sum + [e.title, e.description, e.authorName, e.footer].concat(e.fields.flatMap((f) => [f.name, f.value])).join("").length, 0);
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
    if (s.poll) {
      p.poll = {
        question: { text: s.poll.question },
        answers: s.poll.answers.map((a) => ({ poll_media: Object.assign({ text: a.text }, pollEmoji(a.emoji) && { emoji: pollEmoji(a.emoji) }) })),
        duration: s.poll.duration,
      };
      if (s.poll.multi) p.poll.allow_multiselect = true;
    }
    return p;
  }

  // The reverse of toPayload: reads a webhook body (or a bare embed) back into builder state. Throws a readable Error.
  function fromPayload(input) {
    let p;
    try { p = typeof input === "string" ? JSON.parse(input) : input; } catch (e) { throw new Error("That isn't valid JSON."); }
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Expected a JSON object.");
    const isBody = ["embeds", "content", "username", "avatar_url", "poll"].some((k) => k in p);
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
      poll: isBody && p.poll && typeof p.poll === "object" ? normalizePoll({
        question: str(p.poll.question && p.poll.question.text),
        answers: (Array.isArray(p.poll.answers) ? p.poll.answers : []).map((a) => {
          const m = (a && a.poll_media) || {}, e = m.emoji || {};
          return { text: str(m.text), emoji: e.id ? "<:emoji:" + String(e.id).replace(/\D/g, "") + ">" : str(e.name) };
        }),
        duration: typeof p.poll.duration === "number" ? p.poll.duration : 24,
        multi: !!p.poll.allow_multiselect,
      }) : null,
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
      (s.content ? '<div class="dc-content md">' + md(s.content) + "</div>" : "") + s.embeds.filter(hasEmbed).map(embedHtml).join("") +
      (s.poll ? pollHtml(s.poll, esc) : "") + "</div></div>";
  }

  // Poll questions and answers are plain text in Discord, so they are escaped, not rendered as markdown.
  function pollHtml(p, esc) {
    const hours = p.duration;
    const left = hours % 24 ? hours + (hours === 1 ? " hour" : " hours") : hours / 24 + (hours === 24 ? " day" : " days");
    return '<div class="poll"><div class="poll-q">' + esc(p.question || "Your question") + '</div><div class="poll-hint">Select ' +
      (p.multi ? "one or more answers" : "one answer") + "</div>" + p.answers.map((a) =>
        '<div class="poll-a">' + (a.emoji.trim() && !pollEmoji(a.emoji).id ? '<span class="poll-emoji">' + esc(a.emoji.trim()) + "</span>" : "") +
        "<span>" + esc(a.text) + '</span><span class="poll-box' + (p.multi ? " multi" : "") + '" aria-hidden="true"></span></div>').join("") +
      '<div class="poll-foot">0 votes · ' + esc(left) + " left</div></div>";
  }

  function isWebhookUrl(url) {
    return WEBHOOK_RE.test((url || "").trim());
  }

  // A message link (discord.com/channels/server/channel/message) or a bare message ID → { messageId, channelId }.
  function parseMessageRef(text) {
    const t = (text || "").trim();
    const link = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(?:\d{1,20}|@me)\/(\d{1,20})\/(\d{1,20})\/?$/.exec(t);
    if (link) return { channelId: link[1], messageId: link[2] };
    return /^\d{17,20}$/.test(t) ? { channelId: null, messageId: t } : null;
  }

  // What an edit sends: the text and embeds replace the old ones. Name, avatar and polls can't be changed by editing.
  function toEditPayload(s, now) {
    const p = toPayload(s, now);
    return { content: p.content || "", embeds: p.embeds || [] };
  }

  // Posts the message, or edits one the webhook sent when `ref` (from parseMessageRef) is given.
  // The webhook URL is only used for this request and never saved.
  function send(url, s, ref) {
    if (!isWebhookUrl(url)) return Promise.reject(new Error("That doesn't look like a Discord webhook link."));
    const base = url.trim();
    const failed = (r) => r.json().catch(() => ({})).then((body) => {
      throw new Error("Discord said " + r.status + (body.message ? ": " + body.message : "") + ".");
    });
    if (!ref) {
      return fetch(base + "?wait=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(s)) })
        .then((r) => (r.ok ? "Sent!" : failed(r)));
    }
    if (s.poll) return Promise.reject(new Error("Discord doesn't let an edit add a poll. Clear the message link to post it as a new message."));
    const body = JSON.stringify(toEditPayload(s));
    const patch = (thread) => fetch(base + "/messages/" + ref.messageId + (thread ? "?thread_id=" + thread : ""),
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    // A message inside a thread needs the thread's ID, which is the channel part of its link. Try that if the plain edit can't find it.
    // If that fails too, report the first answer: it's the one about the message itself.
    return patch(null).then((r) => (r.status === 404 && ref.channelId ? patch(ref.channelId).then((again) => (again.ok ? again : r)) : r))
      .then((r) => (r.ok ? "Updated!" : failed(r)));
  }

  const api = { LIMITS, CODE_LANGS, blankEmbed, blankState, blankPoll, exampleState, normalizeState, pictureUrls, validate, embedTextLength, toPayload, toEditPayload,
    fromPayload, toShare, fromShare, toCode, preview, isWebhookUrl, parseMessageRef, send };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedEmbed = api;
})(typeof window !== "undefined" ? window : globalThis);
