/* Pinged — page rendering, tab routing and tools. */
(function () {
  "use strict";

  const C = window.PingedContent;
  const MD = window.PingedMarkdown;
  const LIVE = window.PingedLive;
  const EMBED = window.PingedEmbed;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = MD.escapeHtml;
  const slug = C.slug;

  const DEMO_NAMES = {
    user80351110224678912: "Nelly", role165511591545143296: "Moderators", channel103735883630395392: "general",
  };

  const fmtDate = (iso) => {
    const parts = iso.slice(0, 10).split("-").map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    return d.toLocaleDateString(undefined, parts[2] ? { year: "numeric", month: "short", day: "numeric" } : { year: "numeric", month: "short" });
  };
  const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const ext = (url, label) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";

  function readStore(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeStore(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* storage blocked: fine */ } }

  /* ---------- Shared bits ---------- */

  // A Discord-style message. `html` is already-safe HTML.
  function message(html, who) {
    who = who || { name: "You", color: "#e0a030", initial: "Y" };
    return '<div class="dc-msg"><div class="dc-avatar" style="background:' + who.color + '" aria-hidden="true">' + who.initial + "</div>" +
      '<div class="dc-body"><div class="dc-head"><span class="dc-name" style="color:' + who.color + '">' + esc(who.name) + '</span><span class="dc-stamp">Today at 4:20 PM</span></div>' +
      '<div class="dc-content md">' + html + "</div></div></div>";
  }

  function renderMd(src) {
    return MD.render(src, { names: DEMO_NAMES });
  }

  function highlight(root) {
    if (!window.hljs) return;
    root.querySelectorAll("pre.md-codeblock code[class*='language-']").forEach((el) => {
      const lang = el.className.replace("language-", "");
      if (hljs.getLanguage(lang)) hljs.highlightElement(el);
    });
  }

  function copyButton(text, label) {
    return '<button class="btn btn-ghost btn-sm copy" data-copy="' + esc(text) + '">' + (label || "Copy") + "</button>";
  }

  // "#" link next to a heading so one entry can be shared.
  function anchor(page, id) {
    return '<a class="anchor" href="#/' + page + "/" + id + '" aria-label="Link to this entry">#</a>';
  }

  /* ---------- "New since your last visit" ---------- */

  const SEEN_KEY = "pinged.seen";
  const entryKeys = {
    updates: () => C.updates.map(C.updateId),
    experiments: () => C.experiments.map((e) => slug(e.name)),
  };
  function seenSets() {
    try { return JSON.parse(readStore(SEEN_KEY)) || null; } catch (e) { return null; }
  }
  // First visit: everything counts as seen, so nothing is flagged.
  function unseen(kind) {
    const seen = seenSets();
    if (!seen) {
      writeStore(SEEN_KEY, JSON.stringify({ updates: entryKeys.updates(), experiments: entryKeys.experiments() }));
      return new Set();
    }
    const known = new Set(seen[kind] || []);
    return new Set(entryKeys[kind]().filter((k) => !known.has(k)));
  }
  function markSeen(kind) {
    const seen = seenSets() || {};
    seen[kind] = entryKeys[kind]();
    writeStore(SEEN_KEY, JSON.stringify(seen));
  }
  function drawTabBadges() {
    ["updates", "experiments"].forEach((kind) => {
      const tab = document.querySelector('.tabs a[data-page="' + kind + '"]');
      const n = unseen(kind).size;
      let badge = tab.querySelector(".badge");
      if (!n) { if (badge) badge.remove(); return; }
      if (!badge) { badge = document.createElement("span"); badge.className = "badge"; tab.appendChild(badge); }
      badge.textContent = n;
      badge.setAttribute("aria-label", n + " new");
    });
  }
  const newTag = '<span class="new-tag">New</span>';

  /* ---------- Status helpers ---------- */

  const COMPONENT_STATUS = {
    operational: ["Operational", "ok"], degraded_performance: ["Degraded", "warn"], partial_outage: ["Partial outage", "warn"],
    major_outage: ["Major outage", "bad"], under_maintenance: ["Maintenance", "info"],
  };
  const OVERALL = { none: "ok", minor: "warn", major: "bad", critical: "bad", maintenance: "info" };
  const IMPACT = { none: "info", minor: "warn", major: "bad", critical: "bad", maintenance: "info" };
  const compStatus = (s) => COMPONENT_STATUS[s] || [s, "info"];

  function duration(from, to) {
    const mins = Math.max(1, Math.round((new Date(to) - new Date(from)) / 60000));
    return mins < 60 ? mins + " min" : Math.floor(mins / 60) + " h " + (mins % 60) + " min";
  }

  function incidentHtml(inc, open) {
    const updates = (inc.incident_updates || []).map((u) =>
      '<li><b>' + esc(u.status.replace(/_/g, " ")) + "</b> · " + esc(fmtDateTime(u.display_at || u.created_at)) + "<p>" + esc(u.body || "") + "</p></li>").join("");
    const meta = inc.resolved_at ? "Resolved after " + duration(inc.created_at, inc.resolved_at) : esc(inc.status.replace(/_/g, " "));
    const when = inc.scheduled_for
      ? "Scheduled " + fmtDateTime(inc.scheduled_for) + (inc.scheduled_until ? " – " + fmtDateTime(inc.scheduled_until) : "")
      : fmtDate(inc.created_at);
    return '<details class="incident"' + (open ? " open" : "") + '><summary><span class="dot dot-' + (IMPACT[inc.impact] || "info") + '"></span><span class="inc-name">' + esc(inc.name) +
      '</span><span class="muted">' + esc(when) + " · " + meta + "</span></summary>" +
      '<ol class="inc-updates">' + updates + "</ol>" + (inc.shortlink ? '<p class="sources">' + ext(inc.shortlink, "View on discordstatus.com ↗") + "</p>" : "") + "</details>";
  }

  /* ---------- Pages ---------- */

  const pages = {
    guide() {
      const cards = C.guideCards.map((c) => "<li><b>" + esc(c.title) + ".</b> " + esc(c.body) + "</li>").join("");
      const tips = C.tips.map((t) =>
        "<section><h3>" + esc(t.title) + '</h3><table class="keys"><tbody>' +
        t.items.map(([k, v]) => "<tr><td><kbd>" + esc(k) + "</kbd></td><td>" + esc(v) + "</td></tr>").join("") +
        "</tbody></table></section>").join("");
      const latest = C.updates.slice(0, 3).map((u) =>
        '<li class="news">' + thumb(u, "sm") + '<div><time datetime="' + u.date + '">' + fmtDate(u.date) + '</time> <a href="#/updates/' + C.updateId(u) + '"><b>' + esc(u.title) + "</b></a><p>" +
        esc(u.items.slice(0, 2).join(". ")) + ".</p></div></li>").join("");
      const exp = C.experiments.slice(0, 8).map((e) => "<li>" + status(e.status) + ' <a href="#/experiments/' + slug(e.name) + '">' + esc(e.name) + "</a></li>").join("");
      const sampleTime = nextFridayUnix();

      return '<div class="intro"><div><h1>Pinged</h1>' +
        "<p class=\"lede\">An unofficial guide to Discord: how to format messages, keyboard shortcuts, what changed in the latest updates, and what Discord is testing right now.</p>" +
        '<a class="status-line" id="home-status" href="#/status"><span class="dot dot-info"></span>Checking Discord status…</a>' +
        '<p class="links-row"><a href="#/markdown">Markdown reference</a> · <a href="#/tools">Playground</a> · <a href="#/tools/embed">Embed builder</a> · <a href="#/sources">Where news comes from</a></p></div>' +
        '<div class="dc">' + message(renderMd("# Game night\n-# hosted by <@&165511591545143296>\nStarts <t:" + sampleTime + ":F> (<t:" + sampleTime + ":R>)\n> Bring snacks. **No** spoilers: ||the host always wins||"), { name: "Pinged", color: "#c4521d", initial: "P" }) +
        '<p class="caption">This message is written in Discord markdown. Click the spoiler.</p></div></div>' +
        '<div class="cols"><section><h2>Latest from Discord</h2><ul class="plain">' + latest + '</ul><a href="#/updates">All updates →</a></section>' +
        '<section><h2>Being tested</h2><ul class="plain exp-list">' + exp + '</ul><a href="#/experiments">All experiments →</a></section></div>' +
        '<h2>Quick wins</h2><ul class="wins">' + cards + "</ul>" +
        '<h2>Shortcuts & tricks</h2><div class="cols">' + tips + "</div>";
    },

    markdown() {
      const nav = C.markdown.map((s) => '<a href="#/markdown/' + s.id + '">' + esc(s.title) + "</a>").join("");
      const sections = C.markdown.map((s) => {
        const rows = s.examples.map((ex) =>
          '<div class="ex"><div class="ex-src"><span class="ex-label">' + esc(ex.label) + "</span><pre>" + esc(ex.src) + "</pre>" +
          '<div class="ex-actions">' + copyButton(ex.src) + (ex.noRender ? "" : '<button class="btn btn-ghost btn-sm try" data-src="' + esc(ex.src) + '">Try it</button>') + "</div></div>" +
          '<div class="ex-out dc">' + (ex.noRender ? '<p class="muted">Type this in Discord to see it.</p>' : '<div class="dc-content md">' + renderMd(ex.src) + "</div>") + "</div></div>").join("");
        return '<section class="md-section" id="md-' + s.id + '"><h2>' + esc(s.title) + anchor("markdown", s.id) + '</h2><p class="muted">' + esc(s.blurb) + "</p>" + rows +
          (s.tip ? '<p class="tip"><b>Tip:</b> ' + esc(s.tip) + "</p>" : "") + "</section>";
      }).join("");
      return '<div class="page-head head-open"><h1>Markdown</h1><p class="lede">Everything Discord can format, with a live preview. Hit <b>Try it</b> to edit any example.</p></div>' +
        '<div class="with-side"><nav class="side" aria-label="Markdown sections">' + nav + "</nav><div>" + sections + "</div></div>";
    },

    tools() {
      return '<div class="page-head head-open"><h1>Tools</h1><p class="lede">Write a message and see it exactly how Discord shows it. Then copy and paste.</p>' +
        '<p class="links-row"><a href="#/tools/playground">Playground</a> · <a href="#/tools/embed">Embed builder</a> · <a href="#/tools/permissions">Permissions</a> · <a href="#/tools/ids">ID decoder</a> · <a href="#/tools/timestamps">Timestamps</a> · <a href="#/tools/colors">Coloured text</a></p></div>' +
        '<section class="tool" id="playground"><h2>Playground</h2><div class="pg">' +
        '<label class="sr-only" for="pg-input">Message text</label><textarea id="pg-input" spellcheck="false"></textarea>' +
        '<div class="dc pg-out" id="pg-out" aria-live="polite"></div></div>' +
        '<ul class="lint" id="pg-lint" aria-live="polite"></ul>' +
        '<div class="row"><label class="sr-only" for="pg-template">Template</label><select id="pg-template"><option value="">Start from a template…</option>' +
        C.templates.map((t, i) => '<option value="' + i + '">' + esc(t.name) + "</option>").join("") + "</select>" +
        '<span class="muted" id="pg-count"></span><span class="grow"></span>' +
        '<button class="btn btn-ghost" id="pg-clear">Clear</button><button class="btn btn-ghost" id="pg-link">Copy link</button><button class="btn" id="pg-copy">Copy message</button></div></section>' +

        '<section class="tool" id="embed"><h2>Embed builder</h2><p class="muted">Build the rich boxes bots and webhooks post. Copy the JSON for your bot, or send it straight to a webhook in your own server.</p>' +
        '<div class="pg"><form class="em-form" id="em-form" autocomplete="off"></form><div><div class="dc em-out" id="em-out" aria-live="polite"></div>' +
        '<ul class="em-errors" id="em-errors"></ul></div></div>' +
        '<details class="em-json"><summary>Code</summary><pre id="em-json"></pre></details>' +
        '<details class="em-json"><summary>Import JSON</summary><label class="sr-only" for="em-import">JSON to import</label><textarea id="em-import" rows="6" spellcheck="false" placeholder="Paste a webhook body or an embed object"></textarea>' +
        '<div class="row"><button class="btn btn-ghost" type="button" id="em-import-go">Load into builder</button><span class="muted" id="em-import-note" role="status"></span></div></details>' +
        '<div class="row"><button class="btn btn-ghost" type="button" id="em-example">Load example</button><button class="btn btn-ghost" type="button" id="em-reset">Clear all</button><span class="grow"></span>' +
        '<span class="inline-group"><label class="sr-only" for="em-lang">Format</label><select id="em-lang">' + EMBED.CODE_LANGS.map(([id, name]) => '<option value="' + id + '">' + name + "</option>").join("") + "</select>" +
        '<button class="btn" type="button" id="em-copy">Copy</button></span></div>' +
        '<div class="row webhook-row"><label for="em-hook">Webhook link</label><input id="em-hook" type="password" placeholder="https://discord.com/api/webhooks/…" spellcheck="false">' +
        '<button class="btn" type="button" id="em-send">Send</button><span class="muted" id="em-sent" role="status"></span></div>' +
        '<p class="muted small">Server Settings → Integrations → Webhooks → Copy Webhook URL. The link is only used to send this message and is never saved. Anyone with it can post as the webhook, so keep it private.</p></section>' +

        '<section class="tool" id="permissions"><h2>Permissions & invite link</h2><p class="muted">Tick what a role or bot needs, or paste a permission number to see what it allows. Add a client ID to get the link that invites a bot.</p>' +
        '<div class="row"><label for="perm-int">Permission number</label><input id="perm-int" class="field" inputmode="numeric" spellcheck="false" autocomplete="off"><span class="muted" id="perm-note" role="status"></span></div>' +
        '<div id="perm-grid"></div>' +
        '<div class="row"><label for="perm-client">Client ID</label><input id="perm-client" class="field" inputmode="numeric" spellcheck="false" autocomplete="off" placeholder="Your application\'s ID"></div>' +
        '<div class="row"><code class="out-line" id="perm-invite"></code><button class="btn" id="perm-copy" type="button">Copy link</button></div></section>' +

        '<section class="tool" id="ids"><h2>ID decoder</h2><p class="muted">Every user, server, channel and message ID holds the moment it was made. Paste one to read it. Developer Mode (Settings → Advanced) lets you copy IDs.</p>' +
        '<div class="row"><label for="id-input">ID</label><input id="id-input" class="field" inputmode="numeric" spellcheck="false" autocomplete="off" placeholder="175928847299117063"></div>' +
        '<div class="ts-list" id="id-out"></div></section>' +

        '<section class="tool" id="timestamps"><h2>Timestamp maker</h2><p class="muted">Pick a date. Every reader sees it in their own timezone.</p>' +
        '<div class="row"><label for="ts-input">Date & time</label><input type="datetime-local" id="ts-input"><button class="btn btn-ghost" id="ts-now">Now</button></div>' +
        '<div class="ts-list" id="ts-list"></div></section>' +

        '<section class="tool" id="colors"><h2>Coloured text builder</h2><p class="muted">Click a colour to insert it at the cursor. <code>{reset}</code> goes back to normal. Copying makes a real <code>```ansi</code> block.</p>' +
        '<div class="swatches" id="ansi-swatches"></div>' +
        '<label class="sr-only" for="ansi-input">Coloured text</label><textarea id="ansi-input" spellcheck="false" rows="4"></textarea>' +
        '<div class="dc"><pre class="md-codeblock md-ansi"><code id="ansi-out"></code></pre></div>' +
        '<div class="row"><span class="grow"></span><button class="btn" id="ansi-copy">Copy for Discord</button></div></section>';
    },

    updates() {
      const fresh = unseen("updates");
      const items = C.updates.map((u) => {
        const id = C.updateId(u);
        return '<article class="entry" id="' + id + '"><header><h2>' + esc(u.title) + anchor("updates", id) + "</h2>" + (fresh.has(id) ? newTag : "") +
          '<time datetime="' + u.date + '">' + fmtDate(u.date) + "</time></header>" +
          '<div class="entry-body">' + thumb(u) + "<div><ul>" + u.items.map((i) => "<li>" + esc(i) + "</li>").join("") + "</ul>" + sourceLine(u.sources) + "</div></div></article>";
      }).join("");
      markSeen("updates");
      return '<div class="page-head head-split"><h1>Updates</h1><p class="lede">What changed in Discord, newest first. Each entry links where it came from. Last checked ' + fmtDate(C.lastChecked) + ".</p></div>" + items +
        '<p class="more-sources">Want it first? See <a href="#/sources">where Discord news comes from</a>.</p>';
    },

    experiments() {
      const fresh = unseen("experiments");
      const order = ["rolling", "canary", "testing", "building", "leak"];
      const count = (st) => C.experiments.filter((e) => e.status === st).length;
      const filters = '<div class="filters" role="group" aria-label="Filter by status"><button class="chip" aria-pressed="true" data-filter="all">All ' + C.experiments.length + "</button>" +
        order.filter(count).map((st) => '<button class="chip" aria-pressed="false" data-filter="' + st + '">' + status(st) + " " + count(st) + "</button>").join("") + "</div>";
      const kinds = C.experiments.map((e) => e.kind).filter((k, i, all) => k && all.indexOf(k) === i);
      const kindFilters = '<div class="filters" role="group" aria-label="Filter by kind"><button class="chip" aria-pressed="true" data-kind="all">Any kind</button>' +
        kinds.map((k) => '<button class="chip" aria-pressed="false" data-kind="' + esc(k) + '">' + esc(k) + " " + C.experiments.filter((e) => e.kind === k).length + "</button>").join("") + "</div>";
      const cards = C.experiments.map((e) => {
        const id = slug(e.name);
        return '<article class="entry" id="' + id + '" data-status="' + e.status + '" data-kind="' + esc(e.kind || "") + '"><header><h2>' + esc(e.name) + anchor("experiments", id) + "</h2>" + (fresh.has(id) ? newTag : "") + status(e.status) +
          '<span class="kind">' + esc(e.kind || "") + "</span>" + (e.date ? '<time datetime="' + e.date + '">' + fmtDate(e.date) + "</time>" : "") + "</header>" +
          '<div class="entry-body">' + thumb(e) + "<div><p>" + esc(e.summary) + "</p>" +
          (e.points ? "<ul>" + e.points.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
          (e.id ? '<p class="exp-id">Experiment: <code>' + esc(e.id) + "</code></p>" : "") +
          sourceLine(e.sources) + "</div></div></article>";
      }).join("");
      markSeen("experiments");
      return '<div class="page-head head-split"><h1>Experiments</h1><p class="lede">Features Discord is testing or building, newest first. Anything here can change or never ship. Most finds come from the Discord Previews community.</p>' +
        filters + kindFilters + "</div>" + '<p class="muted" id="exp-none" hidden>No experiments match both filters.</p><div id="exp-list">' + cards + "</div>" +
        '<h2 id="live-feed">Fresh from Discord\'s code' + anchor("experiments", "live-feed") + "</h2>" +
        '<p class="muted">Every time Discord ships an app update, the ' + ext(LIVE.repoUrl, "Discord-Datamining") +
        " project lists the experiments added or removed in it. This list loads live from there. Names are Discord's internal ones, so many are vague until someone writes them up.</p>" +
        '<div id="feed" class="feed"><p class="muted">Loading the latest builds…</p></div>' +
        "<h2>How experiments work</h2>" +
        "<p>Discord turns a feature on for a slice of users or servers first, watches how it goes, then widens it. That's why two friends can see different things.</p>" +
        "<p>There's no official way to opt in. Client mods that force experiments on break Discord's Terms of Service.</p>" +
        '<p>Want more? See <a href="#/sources">trackers and official channels</a>.</p>';
    },

    status() {
      return '<div class="page-head"><h1>Discord status</h1><p class="lede">Live from Discord\'s official ' + ext("https://discordstatus.com", "status page") +
        '. Refreshes every minute while this tab is open.</p></div><div id="status-root"><p class="muted">Loading…</p></div>';
    },

    sources() {
      const groups = C.sources.map((g) => "<section><h2>" + esc(g.group) + '</h2><ul class="source-list">' +
        g.links.map(([label, url, note]) => "<li>" + ext(url, esc(label) + " ↗") + '<span class="muted">' + esc(note) + "</span></li>").join("") + "</ul></section>").join("");
      return '<div class="page-head"><h1>Sources</h1><p class="lede">Where Discord news comes from, official and community. Entries on Pinged credit their own sources.</p></div>' + groups +
        "<section><h2>Follow Pinged</h2><p>New updates and experiments are in the " + '<a href="feed.xml">RSS feed</a>' +
        '. Paste that link into any feed reader. The code is on ' + ext("https://github.com/retroul/Pinged", "GitHub") + ".</p></section>";
    },

    search(q) {
      q = (q || "").trim();
      const results = q ? searchAll(q) : [];
      const list = results.map((r) => '<li><a href="' + r.href + '"><b>' + esc(r.title) + '</b></a> <span class="muted">· ' + esc(r.where) + "</span><p>" + esc(r.text.slice(0, 160)) + (r.text.length > 160 ? "…" : "") + "</p></li>").join("");
      return '<div class="page-head"><h1>Search</h1><p class="lede">' + (q ? results.length + " result" + (results.length === 1 ? "" : "s") + " for “" + esc(q) + "”" : "Type in the search box above.") + "</p></div>" +
        (q && !results.length ? '<p>Nothing found. Try a shorter word, like “spoiler” or “nitro”.</p>' : '<ul class="results">' + list + "</ul>");
    },
  };

  /* ---------- Search ---------- */

  let searchIndex = null;
  function buildIndex() {
    const idx = [];
    C.markdown.forEach((s) => idx.push({ title: s.title, where: "Markdown", href: "#/markdown/" + s.id,
      text: s.blurb + " " + s.examples.map((e) => e.label + " " + e.src).join(" ") + " " + (s.tip || "") }));
    C.tips.forEach((t) => t.items.forEach(([k, v]) => idx.push({ title: k, where: "Guide · " + t.title, href: "#/", text: v })));
    C.guideCards.forEach((c) => idx.push({ title: c.title, where: "Guide", href: "#/", text: c.body }));
    C.updates.forEach((u) => idx.push({ title: u.title + " (" + fmtDate(u.date) + ")", where: "Updates", href: "#/updates/" + C.updateId(u), text: u.items.join(". ") }));
    C.experiments.forEach((e) => idx.push({ title: e.name, where: "Experiments · " + statusLabel(e.status), href: "#/experiments/" + slug(e.name),
      text: [e.summary].concat(e.points || [], e.id || "", e.kind || "").join(" ") }));
    C.sources.forEach((g) => g.links.forEach(([label, , note]) => idx.push({ title: label, where: "Sources", href: "#/sources", text: note })));
    [["Playground", "playground", "write a message and preview it check formatting problems template share link"], ["Embed builder", "embed", "webhook embed json import bot rich message code curl javascript python"],
      ["Permissions & invite link", "permissions", "permission number integer bitfield bot invite oauth client id administrator"], ["ID decoder", "ids", "snowflake id created date user server channel message"],
      ["Timestamp maker", "timestamps", "time date timezone countdown"], ["Coloured text builder", "colors", "ansi colour color text"]]
      .forEach(([t, id, words]) => idx.push({ title: t, where: "Tools", href: "#/tools/" + id, text: words }));
    idx.push({ title: "Discord status", where: "Status", href: "#/status", text: "is discord down outage incident maintenance" });
    return idx;
  }
  function searchAll(q) {
    searchIndex = searchIndex || buildIndex();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return searchIndex
      .map((r) => {
        const title = r.title.toLowerCase(), all = (r.title + " " + r.text).toLowerCase();
        if (!words.every((w) => all.includes(w))) return null;
        return { r, score: words.filter((w) => title.includes(w)).length };
      })
      .filter(Boolean).sort((a, b) => b.score - a.score).map((x) => x.r).slice(0, 50);
  }

  /* ---------- Page pieces ---------- */

  // The source's own preview image, linked from where it lives, with credit.
  function thumb(item, size) {
    if (!item.image) return "";
    const linked = (item.sources || []).find(([, url]) => url);
    const href = linked ? linked[1] : "#";
    return '<figure class="thumb' + (size ? " thumb-" + size : "") + '"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
      '<img src="' + esc(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></a>' +
      (size ? "" : "<figcaption>Image: " + esc(item.credit) + "</figcaption>") + "</figure>";
  }

  function sourceLine(sources) {
    return '<p class="sources">Source' + (sources.length > 1 ? "s" : "") + ": " +
      sources.map(([label, url]) => url ? ext(url, esc(label)) : esc(label)).join(", ") + "</p>";
  }

  function status(s) {
    return '<span class="status status-' + s + '">' + statusLabel(s) + "</span>";
  }

  function statusLabel(s) {
    return { rolling: "Rolling out", canary: "On Canary", building: "In development", testing: "Experiment", leak: "Leak · unconfirmed" }[s] || s;
  }

  function nextFridayUnix() {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    d.setHours(20, 0, 0, 0);
    return Math.floor(d / 1000);
  }

  /* ---------- Live data on pages ---------- */

  let statusTimer = null;

  function drawHomeStatus() {
    LIVE.loadStatus().then((s) => {
      const el = $("#home-status");
      if (!el) return;
      el.innerHTML = '<span class="dot dot-' + (OVERALL[s.overall.indicator] || "info") + '"></span>Discord: ' + esc(s.overall.description) +
        (s.active.length ? " · " + s.active.length + " open incident" + (s.active.length > 1 ? "s" : "") : "");
    }, () => {
      const el = $("#home-status");
      if (el) el.innerHTML = '<span class="dot dot-info"></span>Discord status unavailable right now';
    });
  }

  function drawStatusPage() {
    const root = $("#status-root");
    if (!root) return;
    LIVE.loadStatus().then((s) => {
      if (!$("#status-root")) return;
      const banner = '<div class="status-banner banner-' + (OVERALL[s.overall.indicator] || "info") + '"><span class="dot"></span>' + esc(s.overall.description) +
        '<span class="muted">Updated ' + esc(new Date(s.fetchedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })) + "</span></div>";
      const active = s.active.length ? "<h2>Happening now</h2>" + s.active.map((i) => incidentHtml(i, true)).join("") : "";
      const maint = s.maintenance.length ? "<h2>Scheduled maintenance</h2>" + s.maintenance.map((i) => incidentHtml(i, true)).join("") : "";
      const groups = s.groups.map((g) => {
        const [label, tone] = compStatus(g.status);
        const items = g.items.map((c) => {
          const [l, t] = compStatus(c.status);
          return '<li><span class="dot dot-' + t + '"></span>' + esc(c.name) + (c.status === "operational" ? "" : ' <span class="muted">' + esc(l) + "</span>") + "</li>";
        }).join("");
        return '<div class="comp' + (items ? " comp-group" : "") + '"><div class="comp-head"><span class="dot dot-' + tone + '"></span><b>' + esc(g.name) + '</b><span class="muted">' + esc(label) + "</span></div>" +
          (items ? '<ul class="comp-items">' + items + "</ul>" : "") + "</div>";
      }).join("");
      const recent = s.recent.filter((i) => i.status === "resolved" || i.status === "postmortem" || i.status === "completed");
      root.innerHTML = banner + active + maint + '<h2>Systems</h2><div class="comps">' + groups + "</div>" +
        "<h2>Past incidents</h2>" + (recent.length ? recent.map((i) => incidentHtml(i, false)).join("") : '<p class="muted">No recent incidents.</p>') +
        '<p class="sources">Data from ' + ext("https://discordstatus.com", "discordstatus.com") + ", Discord's official status page.</p>";
    }, () => {
      root.innerHTML = '<p>Couldn\'t reach Discord\'s status page. Check ' + ext("https://discordstatus.com", "discordstatus.com") + " directly.</p>";
    });
  }

  function drawFeed() {
    const box = $("#feed");
    if (!box) return;
    const known = {};
    C.experiments.forEach((e) => { if (e.id) known[e.id] = slug(e.name); });
    LIVE.loadExperimentFeed().then((items) => {
      if (!$("#feed")) return;
      if (!items.length) { box.innerHTML = '<p class="muted">No experiment changes in the latest builds.</p>'; return; }
      box.innerHTML = '<table class="data"><thead><tr><th>Experiment</th><th>Change</th><th>Found</th></tr></thead><tbody>' +
        items.slice(0, 60).map((x) =>
          "<tr><td><b>" + esc(LIVE.readableName(x.id)) + "</b>" + (known[x.id] ? ' · <a href="#/experiments/' + known[x.id] + '">our write-up</a>' : "") +
          "<br><code>" + esc(x.id) + "</code>" + (x.kind ? ' <span class="muted">' + esc(x.kind) + "</span>" : "") +
          (x.variants.length ? ' <span class="muted">· ' + x.variants.length + " variant" + (x.variants.length > 1 ? "s" : "") + "</span>" : "") + "</td>" +
          '<td><span class="change change-' + x.change + '">' + (x.change === "added" ? "Added" : "Removed") + "</span></td>" +
          "<td>" + ext(x.url, esc(fmtDate(x.date))) + "</td></tr>").join("") +
        "</tbody></table>";
      box.classList.add("table-wrap");
    }, () => {
      box.innerHTML = '<p>Couldn\'t load the live feed (GitHub may be rate-limiting; try again later). You can browse it at ' + ext(LIVE.repoUrl, "Discord-Datamining") + ".</p>";
    });
  }

  /* ---------- Tools wiring ---------- */

  const PG_KEY = "pinged.playground";
  const PG_DEFAULT = "# Hey there 👋\n**Bold**, *italic*, __underline__, ~~strike~~ and ||spoilers||\n- lists work\n- so do `inline code`\n> and quotes\n-# Edit me!";

  function setupTools(pendingSrc) {
    const input = $("#pg-input"), out = $("#pg-out"), count = $("#pg-count");
    const update = () => {
      out.innerHTML = message(renderMd(input.value || " "));
      highlight(out);
      const n = input.value.length;
      count.textContent = n + " / 2000 characters" + (n > 2000 ? ", too long without Nitro (4000)" : "");
      count.classList.toggle("warn", n > 2000);
      const problems = MD.lint(input.value);
      $("#pg-lint").innerHTML = problems.length
        ? problems.map((p) => "<li><b>Line " + p.line + ":</b> " + esc(p.text) + "</li>").join("")
        : (input.value.trim() ? '<li class="ok">No formatting problems found.</li>' : "");
      writeStore(PG_KEY, input.value);
    };
    input.value = pendingSrc != null ? pendingSrc : (readStore(PG_KEY) ?? PG_DEFAULT);
    input.addEventListener("input", update);
    $("#pg-clear").addEventListener("click", () => { input.value = ""; update(); input.focus(); });
    $("#pg-copy").addEventListener("click", (e) => copy(input.value, e.currentTarget));
    $("#pg-link").addEventListener("click", (e) => copy(location.href.split("#")[0] + "#/tools/playground?m=" + encodeURIComponent(input.value), e.currentTarget));
    $("#pg-template").addEventListener("change", (e) => {
      const t = C.templates[e.target.value];
      e.target.value = "";
      if (!t || (input.value.trim() && !confirm("Replace what's in the playground with this template?"))) return;
      input.value = t.src;
      update();
    });
    update();

    setupEmbed();
    setupPermissions();
    setupIds();

    // Timestamps
    const ts = $("#ts-input"), list = $("#ts-list");
    const toLocalInput = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const drawTs = () => {
      const unix = Math.floor(new Date(ts.value) / 1000);
      if (isNaN(unix)) { list.innerHTML = '<p class="muted">Pick a date.</p>'; return; }
      list.innerHTML = [["t", "Short time"], ["T", "Long time"], ["d", "Short date"], ["D", "Long date"], ["f", "Date & time"], ["F", "Full"], ["R", "Relative"]].map(([s, name]) => {
        const code = "<t:" + unix + ":" + s + ">";
        return '<div class="ts-row"><span class="ts-name">' + name + "</span><code>" + esc(code) + '</code><span class="ts-out md">' + esc(MD.formatTimestamp(unix, s)) + "</span>" + copyButton(code) + "</div>";
      }).join("");
    };
    ts.value = toLocalInput(new Date());
    ts.addEventListener("input", drawTs);
    $("#ts-now").addEventListener("click", () => { ts.value = toLocalInput(new Date()); drawTs(); });
    drawTs();

    // ANSI builder
    const ai = $("#ansi-input"), ao = $("#ansi-out");
    const swatchNames = Object.keys(MD.ANSI_TOKENS);
    $("#ansi-swatches").innerHTML = swatchNames.map((n) => {
      const cls = n.startsWith("bg-") ? "ansi-bg-" + n.slice(3) : n === "bold" ? "ansi-bold" : n === "underline" ? "ansi-under" : n === "reset" ? "" : "ansi-fg-" + n;
      return '<button class="swatch ' + cls + '" data-token="' + n + '">' + n + "</button>";
    }).join("");
    const drawAnsi = () => { ao.innerHTML = MD.renderAnsi(MD.tokensToAnsi(ai.value)); };
    ai.value = "{bold}{red}Warning:{reset} {yellow}server restart{reset} at {cyan}8 PM{reset}";
    ai.addEventListener("input", drawAnsi);
    $("#ansi-swatches").addEventListener("click", (e) => {
      const b = e.target.closest("[data-token]");
      if (!b) return;
      const tok = "{" + b.dataset.token + "}", s = ai.selectionStart, end = ai.selectionEnd;
      ai.setRangeText(s === end || b.dataset.token === "reset" ? tok : tok + ai.value.slice(s, end) + "{reset}", s, end, "end");
      ai.focus();
      drawAnsi();
    });
    $("#ansi-copy").addEventListener("click", (e) => copy("```ansi\n" + MD.tokensToAnsi(ai.value) + "\n```", e.currentTarget));
    drawAnsi();
  }

  /* ---------- Permissions and ID tools ---------- */

  function setupPermissions() {
    const D = window.PingedDiscord;
    const grid = $("#perm-grid"), num = $("#perm-int"), note = $("#perm-note"), client = $("#perm-client"), invite = $("#perm-invite"), copyBtn = $("#perm-copy");
    const groups = {};
    D.PERMISSIONS.forEach((p) => (groups[p[3]] = groups[p[3]] || []).push(p));
    grid.innerHTML = Object.keys(groups).map((g) => '<fieldset class="perm-group"><legend>' + esc(g) + "</legend>" +
      groups[g].map(([flag, , label]) => '<label class="check"><input type="checkbox" data-flag="' + flag + '"> ' + esc(label) + "</label>").join("") + "</fieldset>").join("");
    const boxes = Array.from(grid.querySelectorAll("input"));
    let unknown = "0"; // bits in a pasted number that this tool has no checkbox for; kept so they aren't lost

    const total = () => (BigInt(D.flagsToInt(boxes.filter((b) => b.checked).map((b) => b.dataset.flag))) | BigInt(unknown)).toString();
    const drawInvite = () => {
      const ok = D.isSnowflake(client.value);
      invite.textContent = ok ? D.inviteUrl(client.value, total()) : "Enter a client ID to build the invite link.";
      copyBtn.disabled = !ok;
    };
    const drawNote = () => {
      const admin = boxes.some((b) => b.checked && b.dataset.flag === "ADMINISTRATOR");
      note.textContent = (admin ? "Administrator grants every permission and ignores channel settings. " : "") +
        (unknown !== "0" ? "This number also has bits the tool doesn't list (" + unknown + "). They are kept." : "");
    };

    grid.addEventListener("change", () => { num.value = total(); drawNote(); drawInvite(); });
    num.addEventListener("input", () => {
      const text = num.value.trim();
      const parsed = text ? D.intToFlags(text) : { flags: [], unknown: "0" };
      if (!parsed) { note.textContent = "Enter a whole number, like 8 or 2147483648."; return; }
      unknown = parsed.unknown;
      boxes.forEach((b) => { b.checked = parsed.flags.includes(b.dataset.flag); });
      drawNote();
      drawInvite();
    });
    client.addEventListener("input", drawInvite);
    copyBtn.addEventListener("click", (e) => copy(invite.textContent, e.currentTarget));
    num.value = "0";
    drawInvite();
  }

  function setupIds() {
    const D = window.PingedDiscord;
    const input = $("#id-input"), out = $("#id-out");
    const row = (name, value, extra, copyText) => '<div class="ts-row"><span class="ts-name">' + name + "</span><code>" + esc(value) + '</code><span class="ts-out md">' + (extra || "") + "</span>" +
      (copyText ? copyButton(copyText) : "<span></span>") + "</div>";
    const draw = () => {
      const text = input.value.trim();
      if (!text) { out.innerHTML = '<p class="muted pad">Paste an ID.</p>'; return; }
      const s = D.decodeSnowflake(text);
      if (!s) { out.innerHTML = '<p class="muted pad">That isn\'t a Discord ID. They are 17 to 20 digits.</p>'; return; }
      out.innerHTML = row("Created", new Date(s.ms).toLocaleString(), esc(MD.formatTimestamp(s.unix, "R")), "") +
        row("UTC", s.iso, "", s.iso) + row("Unix seconds", String(s.unix), "", String(s.unix)) +
        row("Timestamp code", "<t:" + s.unix + ":F>", "", "<t:" + s.unix + ":F>") +
        row("Worker · process · counter", s.worker + " · " + s.process + " · " + s.increment, "", "");
    };
    input.addEventListener("input", draw);
    draw();
  }

  /* ---------- Embed builder wiring ---------- */

  const EMBED_KEY = "pinged.embed";
  const EMBED_FIELDS = [
    ["Message", [["username", "Bot name", "text"], ["avatarUrl", "Bot avatar link", "url"], ["content", "Message text (above the embed)", "area"]]],
    ["Author", [["authorName", "Author name", "text"], ["authorUrl", "Author link", "url"], ["authorIcon", "Author icon link", "url"]]],
    ["Body", [["title", "Title", "text"], ["url", "Title link", "url"], ["description", "Description (markdown works)", "area"], ["color", "Colour", "color"]]],
    ["Images", [["thumbnail", "Thumbnail link (small, top right)", "url"], ["image", "Image link (large, bottom)", "url"]]],
    ["Footer", [["footer", "Footer text", "text"], ["footerIcon", "Footer icon link", "url"], ["timestamp", "Show current time", "check"]]],
  ];

  function setupEmbed() {
    const form = $("#em-form");
    let state;
    try { state = Object.assign(EMBED.blankState(), JSON.parse(readStore(EMBED_KEY)) || EMBED.exampleState()); } catch (e) { state = EMBED.exampleState(); }

    const input = (key, label, type) => {
      const id = "em-" + key, v = state[key];
      if (type === "check") return '<label class="check"><input type="checkbox" id="' + id + '" data-key="' + key + '"' + (v ? " checked" : "") + "> " + label + "</label>";
      const ctrl = type === "area" ? '<textarea id="' + id + '" data-key="' + key + '" rows="3">' + esc(v) + "</textarea>"
        : '<input id="' + id + '" data-key="' + key + '" type="' + (type === "color" ? "color" : type === "url" ? "url" : "text") + '" value="' + esc(v) + '">';
      return '<label for="' + id + '">' + label + "</label>" + ctrl;
    };
    const drawForm = () => {
      form.innerHTML = EMBED_FIELDS.map(([group, inputs]) => "<fieldset><legend>" + group + "</legend>" + inputs.map((i) => input.apply(null, i)).join("") + "</fieldset>").join("") +
        "<fieldset><legend>Fields (" + state.fields.length + "/25)</legend>" + state.fields.map((f, i) =>
          '<div class="em-field-edit"><input aria-label="Field ' + (i + 1) + ' name" placeholder="Name" data-field="' + i + '" data-prop="name" value="' + esc(f.name) + '">' +
          '<textarea aria-label="Field ' + (i + 1) + ' value" placeholder="Value" rows="2" data-field="' + i + '" data-prop="value">' + esc(f.value) + "</textarea>" +
          '<label class="check"><input type="checkbox" data-field="' + i + '" data-prop="inline"' + (f.inline ? " checked" : "") + '> Inline</label>' +
          '<button type="button" class="btn btn-ghost" data-remove="' + i + '">Remove</button></div>').join("") +
        '<button type="button" class="btn btn-ghost" id="em-add"' + (state.fields.length >= 25 ? " disabled" : "") + ">Add field</button></fieldset>";
    };
    const code = () => EMBED.toCode(EMBED.toPayload(state), $("#em-lang").value);
    const drawPreview = () => {
      $("#em-out").innerHTML = EMBED.preview(state, renderMd, esc);
      highlight($("#em-out"));
      const errors = EMBED.validate(state);
      $("#em-errors").innerHTML = errors.map((e) => "<li>" + esc(e) + "</li>").join("");
      $("#em-json").textContent = code();
      $("#em-send").disabled = $("#em-copy").disabled = errors.length > 0;
      writeStore(EMBED_KEY, JSON.stringify(state));
    };

    form.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.key) state[t.dataset.key] = t.type === "checkbox" ? t.checked : t.value;
      if (t.dataset.field != null) state.fields[Number(t.dataset.field)][t.dataset.prop] = t.type === "checkbox" ? t.checked : t.value;
      drawPreview();
    });
    form.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (rm) state.fields.splice(Number(rm.dataset.remove), 1);
      else if (e.target.id === "em-add") state.fields.push({ name: "", value: "", inline: false });
      else return;
      drawForm();
      drawPreview();
    });
    form.addEventListener("submit", (e) => e.preventDefault());
    $("#em-example").addEventListener("click", () => { state = EMBED.exampleState(); drawForm(); drawPreview(); });
    $("#em-reset").addEventListener("click", () => { state = EMBED.blankState(); drawForm(); drawPreview(); });
    $("#em-copy").addEventListener("click", (e) => copy(code(), e.currentTarget));
    $("#em-lang").addEventListener("change", drawPreview);
    $("#em-import-go").addEventListener("click", () => {
      const note = $("#em-import-note");
      try {
        state = EMBED.fromPayload($("#em-import").value);
        drawForm();
        drawPreview();
        note.textContent = "Loaded.";
      } catch (err) { note.textContent = err.message; }
    });
    $("#em-send").addEventListener("click", () => {
      const note = $("#em-sent"), btn = $("#em-send");
      btn.disabled = true;
      note.textContent = "Sending…";
      EMBED.send($("#em-hook").value, EMBED.toPayload(state))
        .then((msg) => { note.textContent = msg; }, (err) => { note.textContent = err.message; })
        .finally(() => { btn.disabled = EMBED.validate(state).length > 0; });
    });
    drawForm();
    drawPreview();
  }

  function copy(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => (btn.textContent = old), 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => (btn.textContent = "Copy failed"));
    else btn.textContent = "Copy not supported";
  }

  /* ---------- Router ---------- */

  let pendingPlayground = null;
  const TITLES = { guide: "", markdown: "Markdown", tools: "Tools", updates: "Updates", experiments: "Experiments", status: "Status", sources: "Sources", search: "Search" };

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function route() {
    const path = location.hash.replace(/^#\/?/, "");
    const cut = path.indexOf("/");
    const page = cut === -1 ? path : path.slice(0, cut);
    const rawSub = cut === -1 ? "" : path.slice(cut + 1);
    const name = pages[page] ? page : "guide";
    // Outside search, "?m=..." after the section carries a shared playground message.
    const qMark = name === "search" ? -1 : rawSub.indexOf("?");
    const sub = qMark === -1 ? rawSub : rawSub.slice(0, qMark);
    const shared = qMark === -1 ? null : new URLSearchParams(rawSub.slice(qMark + 1)).get("m");
    if (name === "tools" && shared != null) pendingPlayground = shared;
    const main = $("#main");

    clearInterval(statusTimer);
    main.innerHTML = name === "search" ? pages.search(safeDecode(sub)) : pages[name]();    highlight(main);
    document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.page === name ? "page" : "false"));
    document.title = (TITLES[name] ? TITLES[name] + " · " : "") + "Pinged: the unofficial Discord field guide";
    if (name !== "search") $("#search").value = "";
    drawTabBadges();

    if (name === "tools") { setupTools(pendingPlayground); pendingPlayground = null; }
    if (name === "guide") drawHomeStatus();
    if (name === "experiments") drawFeed();
    if (name === "status") { drawStatusPage(); statusTimer = setInterval(drawStatusPage, 60 * 1000); }

    const target = name !== "search" && sub && (document.getElementById("md-" + sub) || document.getElementById(sub));
    if (target) { target.scrollIntoView(); target.classList.add("flash"); } else if (name !== "search") window.scrollTo(0, 0);
    if (name !== "search") main.focus({ preventScroll: true });
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    const spoiler = t.closest(".md-spoiler");
    if (spoiler) spoiler.classList.add("shown");
    const c = t.closest(".copy");
    if (c) copy(c.dataset.copy, c);
    const chip = t.closest(".chip[data-filter], .chip[data-kind]");
    if (chip) {
      // Two independent rows of chips (status, kind); an entry shows only when it matches the pressed chip in each.
      const row = chip.dataset.filter != null ? "filter" : "kind";
      document.querySelectorAll(".chip[data-" + row + "]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      const pressed = (r) => (document.querySelector(".chip[data-" + r + '][aria-pressed="true"]') || { dataset: {} }).dataset[r] || "all";
      const wantStatus = pressed("filter"), wantKind = pressed("kind");
      document.querySelectorAll("#exp-list .entry").forEach((el) => {
        el.hidden = (wantStatus !== "all" && el.dataset.status !== wantStatus) || (wantKind !== "all" && el.dataset.kind !== wantKind);
      });
      $("#exp-none").hidden = !!document.querySelector("#exp-list .entry:not([hidden])");
    }
    const tryIt = t.closest(".try");
    if (tryIt) { pendingPlayground = tryIt.dataset.src; location.hash = "#/tools/playground"; }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("md-spoiler")) {
      e.preventDefault();
      e.target.classList.add("shown");
    }
    // "/" jumps to search, like many docs sites.
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      $("#search").focus();
    }
  });

  let searchDelay = null;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchDelay);
    const q = e.target.value;
    searchDelay = setTimeout(() => {
      const next = "#/search/" + encodeURIComponent(q.trim());
      const onSearch = location.hash.startsWith("#/search");
      if (!q.trim() && !onSearch) return;
      // While on the search page, update the address instead of adding a Back step per letter.
      if (onSearch) { history.replaceState(null, "", next); route(); } else location.hash = next;
    }, 200);
  });

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.setCodeTheme(next);
    writeStore("pinged.theme", next);
  });

  // If a source site stops serving its image, hide the empty frame.
  document.addEventListener("error", (e) => {
    const fig = e.target.tagName === "IMG" && e.target.closest(".thumb");
    if (fig) fig.remove();
  }, true);

  window.addEventListener("hashchange", route);
  route();
})();
