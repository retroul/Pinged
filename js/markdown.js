/*
 * Pinged — Discord-flavoured markdown renderer.
 * Turns message text into safe HTML that looks like Discord's output.
 * All user text is HTML-escaped before any formatting is applied.
 * Works in the browser (window.PingedMarkdown) and in Node (module.exports).
 */
(function (root) {
  "use strict";

  const ESC = String.fromCharCode(27);
  const HOLD = "\u0000"; // marks a protected placeholder: \u0000<index>\u0000

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- Timestamps: <t:unix:style> ---------- */

  function formatTimestamp(unix, style, now) {
    const d = new Date(unix * 1000);
    if (isNaN(d.getTime())) return null;
    const date = (o) => d.toLocaleDateString(undefined, o);
    const time = (o) => d.toLocaleTimeString(undefined, o);
    switch (style) {
      case "t": return time({ hour: "numeric", minute: "2-digit" });
      case "T": return time({ hour: "numeric", minute: "2-digit", second: "2-digit" });
      case "d": return date({ year: "numeric", month: "2-digit", day: "2-digit" });
      case "D": return date({ year: "numeric", month: "long", day: "numeric" });
      case "F": return date({ weekday: "long", year: "numeric", month: "long", day: "numeric" }) + " " + time({ hour: "numeric", minute: "2-digit" });
      case "R": return relativeTime(d, now || new Date());
      default: return date({ year: "numeric", month: "long", day: "numeric" }) + " " + time({ hour: "numeric", minute: "2-digit" });
    }
  }

  function relativeTime(d, now) {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const secs = Math.round((d - now) / 1000);
    const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
    for (const [unit, size] of units) {
      if (Math.abs(secs) >= size || unit === "second") return rtf.format(Math.round(secs / size), unit);
    }
  }

  /* ---------- ANSI colour code blocks (```ansi) ---------- */

  const ANSI_FG = { 30: "gray", 31: "red", 32: "green", 33: "yellow", 34: "blue", 35: "pink", 36: "cyan", 37: "white" };
  const ANSI_BG = { 40: "firefly", 41: "orange", 42: "marble", 43: "greyish", 44: "gray", 45: "indigo", 46: "light-gray", 47: "white" };

  function renderAnsi(text) {
    const state = { bold: false, under: false, fg: null, bg: null };
    let out = "";
    const parts = text.split(new RegExp(ESC + "\\[([\\d;]*)m"));
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        (part === "" ? ["0"] : part.split(";")).forEach((c) => {
          const n = Number(c);
          if (n === 0) Object.assign(state, { bold: false, under: false, fg: null, bg: null });
          else if (n === 1) state.bold = true;
          else if (n === 4) state.under = true;
          else if (ANSI_FG[n]) state.fg = ANSI_FG[n];
          else if (ANSI_BG[n]) state.bg = ANSI_BG[n];
        });
        return;
      }
      if (!part) return;
      const cls = [];
      if (state.bold) cls.push("ansi-bold");
      if (state.under) cls.push("ansi-under");
      if (state.fg) cls.push("ansi-fg-" + state.fg);
      if (state.bg) cls.push("ansi-bg-" + state.bg);
      const safe = escapeHtml(part);
      out += cls.length ? '<span class="' + cls.join(" ") + '">' + safe + "</span>" : safe;
    });
    return out;
  }

  /* ---------- Main renderer ---------- */

  function render(source, opts) {
    opts = opts || {};
    const names = opts.names || {};
    const held = [];
    const hold = (html) => HOLD + (held.push(html) - 1) + HOLD;

    let text = String(source).replace(/\r\n?/g, "\n");

    // 1. Code blocks and inline code are taken out first so nothing inside them is formatted.
    text = text.replace(/```(?:([\w+#.-]+)\n)?([\s\S]*?)```/g, (_, lang, code) => {
      code = code.replace(/^\n/, "").replace(/\n$/, "");
      const l = (lang || "").toLowerCase();
      const body = l === "ansi" ? renderAnsi(code) : escapeHtml(code);
      const cls = l && l !== "ansi" ? ' class="language-' + escapeHtml(l) + '"' : "";
      return hold('<pre class="md-codeblock' + (l === "ansi" ? " md-ansi" : "") + '"><code' + cls + ">" + body + "</code></pre>");
    });
    text = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, __, code) =>
      hold('<code class="md-inline">' + escapeHtml(code.trim() || code) + "</code>"));

    // 2. Backslash escapes: \*not italic\*
    text = text.replace(/\\([*_~|`>#\-\\<:\[\]()])/g, (_, ch) => hold(escapeHtml(ch)));

    // 3. Everything left is escaped, then formatted.
    text = escapeHtml(text);

    const inline = (s) => formatInline(s, hold, names, opts.now);
    let html = renderBlocks(text, inline);

    // 4. Put protected pieces back (they can nest, so repeat until none remain).
    const restore = new RegExp(HOLD + "(\\d+)" + HOLD, "g");
    for (let i = 0; i < 5 && html.indexOf(HOLD) !== -1; i++) {
      html = html.replace(restore, (_, n) => held[Number(n)]);
    }
    return html;
  }

  function renderBlocks(text, inline) {
    // ">>> " quotes everything after it.
    const multi = text.match(/^([\s\S]*?)(?:^|\n)&gt;&gt;&gt; ([\s\S]*)$/);
    if (multi) {
      return renderBlocks(multi[1], inline) + '<blockquote class="md-quote">' + renderBlocks(multi[2], inline) + "</blockquote>";
    }

    const lines = text.split("\n");
    let out = "";
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^&gt; /.test(line) || line === "&gt;") {
        const quoted = [];
        while (i < lines.length && (/^&gt; /.test(lines[i]) || lines[i] === "&gt;")) {
          quoted.push(lines[i].replace(/^&gt; ?/, ""));
          i++;
        }
        out += '<blockquote class="md-quote">' + renderBlocks(quoted.join("\n"), inline) + "</blockquote>";
        continue;
      }

      const h = line.match(/^(#{1,3}) (.+)$/);
      if (h) {
        out += "<h" + h[1].length + ' class="md-h">' + inline(h[2]) + "</h" + h[1].length + ">";
        i++;
        continue;
      }

      const sub = line.match(/^-# (.+)$/);
      if (sub) {
        out += '<div class="md-subtext">' + inline(sub[1]) + "</div>";
        i++;
        continue;
      }

      if (/^ *([-*]|\d{1,9}\.) /.test(line)) {
        const items = [];
        while (i < lines.length && /^ *([-*]|\d{1,9}\.) /.test(lines[i])) {
          const m = lines[i].match(/^( *)([-*]|\d{1,9}\.) (.*)$/);
          items.push({ depth: Math.min(Math.floor(m[1].length / 2), 10), ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), body: m[3] });
          i++;
        }
        out += renderList(items, 0, inline);
        continue;
      }

      // Plain paragraph lines up to the next block.
      const para = [];
      while (i < lines.length && !/^(&gt; |&gt;$|#{1,3} |-# | *([-*]|\d{1,9}\.) )/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) out += '<div class="md-line">' + inline(para.join("\n")).replace(/\n/g, "<br>") + "</div>";
    }
    return out;
  }

  function renderList(items, depth, inline) {
    let out = "";
    let i = 0;
    while (i < items.length) {
      const ordered = items[i].ordered;
      const tag = ordered ? "ol" : "ul";
      const start = ordered && items[i].start !== 1 ? ' start="' + items[i].start + '"' : "";
      out += "<" + tag + ' class="md-list"' + start + ">";
      while (i < items.length && items[i].ordered === ordered) {
        const item = items[i];
        i++;
        const kids = [];
        while (i < items.length && items[i].depth > item.depth) kids.push(items[i++]);
        out += "<li>" + inline(item.body) + (kids.length ? renderList(kids, depth + 1, inline) : "") + "</li>";
      }
      out += "</" + tag + ">";
    }
    return out;
  }

  function formatInline(s, hold, names, now) {
    const nameFor = (kind, id) => names[kind + id] || null;

    // Links first, so formatting characters inside URLs are left alone.
    s = s.replace(/\[([^\]\n]+)\]\(&lt;(https?:\/\/[^\s]+?)&gt;\)|\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g, (_, t1, u1, t2, u2) =>
      hold('<a class="md-link" href="' + (u1 || u2) + '" target="_blank" rel="noopener noreferrer" title="' + (u1 || u2) + '">') +
      (t1 || t2) + hold("</a>"));
    s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, u) =>
      hold('<a class="md-link" href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>"));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g, (_, pre, u) =>
      pre + hold('<a class="md-link" href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>"));

    // Timestamps, mentions and custom emoji.
    s = s.replace(/&lt;t:(-?\d{1,13})(?::([tTdDfFR]))?&gt;/g, (m, unix, style) => {
      const label = formatTimestamp(Number(unix), style, now);
      return label ? hold('<span class="md-time" title="' + escapeHtml(formatTimestamp(Number(unix), "F")) + '">' + escapeHtml(label) + "</span>") : m;
    });
    s = s.replace(/&lt;@&amp;(\d{1,20})&gt;/g, (_, id) =>
      hold('<span class="md-mention md-role">@' + escapeHtml(nameFor("role", id) || "role") + "</span>"));
    s = s.replace(/&lt;@!?(\d{1,20})&gt;/g, (_, id) =>
      hold('<span class="md-mention">@' + escapeHtml(nameFor("user", id) || "user") + "</span>"));
    s = s.replace(/&lt;#(\d{1,20})&gt;/g, (_, id) =>
      hold('<span class="md-mention"># ' + escapeHtml(nameFor("channel", id) || "channel") + "</span>"));
    s = s.replace(/&lt;\/([\w-]{1,32}(?: [\w-]{1,32}){0,2}):(\d{1,20})&gt;/g, (_, cmd) =>
      hold('<span class="md-mention md-slash">/' + cmd + "</span>"));
    s = s.replace(/&lt;id:(customize|browse|guide|linked-roles)&gt;/g, (_, page) => {
      const label = { customize: "Channels & Roles", browse: "Browse Channels", guide: "Server Guide", "linked-roles": "Linked Roles" }[page];
      return hold('<span class="md-mention"># ' + label + "</span>");
    });
    s = s.replace(/&lt;(a?):(\w{2,32}):(\d{1,20})&gt;/g, (_, anim, name, id) =>
      hold('<img class="md-emoji" alt=":' + name + ':" title=":' + name + ':" loading="lazy" src="https://cdn.discordapp.com/emojis/' + id + (anim ? ".gif" : ".webp") + '?size=48">'));
    s = s.replace(/(^|[^\w])@(everyone|here)\b/g, (_, pre, who) => pre + hold('<span class="md-mention">@' + who + "</span>"));

    // Text styles. Order matters: longest markers first.
    const rules = [
      [/\|\|([\s\S]+?)\|\|/g, '<span class="md-spoiler" tabindex="0" role="button" aria-label="Spoiler, press to reveal">$1</span>'],
      [/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, "<strong><em>$1</em></strong>"],
      [/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>"],
      [/__(?=\S)([\s\S]*?\S)__/g, "<u>$1</u>"],
      [/\*(?=[^\s*])([^*]*?[^\s*])\*/g, "<em>$1</em>"],
      [/\*(?=[^\s*])([^*])\*/g, "<em>$1</em>"],
      [/(^|[^\w])_(?=\S)([^_]*?\S)_(?![\w])/g, "$1<em>$2</em>"],
      [/~~(?=\S)([\s\S]*?\S)~~/g, "<s>$1</s>"],
    ];
    for (const [re, rep] of rules) s = s.replace(re, rep);
    return s;
  }

  /* ---------- Colour-text builder helpers ---------- */

  // "{red}hi{reset}" → real ANSI escape codes Discord understands.
  const ANSI_TOKENS = {
    reset: 0, bold: 1, underline: 4,
    gray: 30, red: 31, green: 32, yellow: 33, blue: 34, pink: 35, cyan: 36, white: 37,
    "bg-firefly": 40, "bg-orange": 41, "bg-marble": 42, "bg-greyish": 43, "bg-gray": 44, "bg-indigo": 45, "bg-light-gray": 46, "bg-white": 47,
  };

  function tokensToAnsi(text) {
    return text.replace(/\{([a-z-]+)\}/g, (m, name) => (name in ANSI_TOKENS ? ESC + "[" + ANSI_TOKENS[name] + "m" : m));
  }

  /* ---------- Message checker ---------- */

  // Reasons a message won't format the way its author expects, as [{ line, text }] (line starts at 1).
  function lint(src) {
    const out = [];
    const blank = (m) => m.replace(/[^\n]/g, " ");
    const lineAt = (s, i) => s.slice(0, i).split("\n").length;
    const add = (line, text) => out.push({ line, text });

    // Code is never formatted, so blank it out (keeping newlines, so line numbers hold) before judging the rest.
    let s = String(src).replace(/```[\s\S]*?```/g, blank);
    const open = s.indexOf("```");
    if (open !== -1) {
      add(lineAt(s, open), "This code block never closes. End it with ``` on its own line.");
      s = s.slice(0, open) + blank(s.slice(open));
    }
    s = s.replace(/`[^`\n]*`/g, blank).replace(/\\[^\n]/g, "  ");

    const lines = s.split("\n");
    lines.forEach((l, i) => {
      const n = i + 1;
      if (/^\s*#{1,3}(?![#\s\d])\S/.test(l)) add(n, "Headers need a space after the #, or Discord shows plain text.");
      if (/^\s*#{4,}\s/.test(l)) add(n, "Discord headers stop at three # characters.");
      if (/^\s*-#(?!\s)\S/.test(l)) add(n, "Subtext needs a space after -#.");
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l)) add(n, "Discord has no horizontal rules.");
      if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(l)) add(n, "Discord doesn't render tables. Put the rows in a code block to line them up.");
      if (/!\[[^\]]*\]\([^)]*\)/.test(l)) add(n, "Markdown images don't work. Upload the image or paste its link.");
      if (/\[[^\]\n]+\]\((?!<?https?:\/\/)[^)\n]*\)/.test(l)) add(n, "A masked link needs the full address, starting with https://.");
      if (/<\/?(?:b|i|u|s|em|strong|br|p|a|div|span|h[1-6]|img|ul|ol|li|code|pre)(?:\s[^>]*)?\/?>/i.test(l)) add(n, "Discord ignores HTML tags. Use markdown instead.");
      if ((l.match(/<[@#][^>\s]*>/g) || []).some((m) => !/^<(?:@[&!]?|#)\d+>$/.test(m))) add(n,"Mentions need a numeric ID, like <@80351110224678912>. Names don't work.");
      if (/<t:\d{12,}/.test(l)) add(n, "That timestamp looks like milliseconds. Discord wants seconds, so drop the last three digits.");
      else if (/<t:(?!-?\d+(?::[tTdDfFR])?>)[^>\s]*>/.test(l)) add(n, "Timestamps need Unix seconds, like <t:1792598400:R>.");
    });

    const unclosed = (token, label) => {
      const hits = [];
      for (let i = s.indexOf(token); i !== -1; i = s.indexOf(token, i + token.length)) hits.push(i);
      if (hits.length % 2) add(lineAt(s, hits[hits.length - 1]), label + " is opened but never closed.");
    };
    unclosed("||", "A spoiler (||)");
    unclosed("**", "Bold (**)");
    unclosed("__", "Underline (__)");
    unclosed("~~", "Strikethrough (~~)");

    return out.sort((a, b) => a.line - b.line);
  }

  const api = { render, renderAnsi, formatTimestamp, tokensToAnsi, escapeHtml, lint, ANSI_TOKENS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
