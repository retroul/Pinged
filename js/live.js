/*
 * Pinged — live data.
 * 1. Discord status, from Discord's official status page API (discordstatus.com).
 * 2. New experiments found in each Discord app update, from comments on the
 *    Discord-Datamining GitHub repo.
 * Both are cached in the browser for a few minutes so we stay well under rate limits.
 * Parsing functions are pure so they can be tested in Node.
 */
(function (root) {
  "use strict";

  const STATUS_API = "https://discordstatus.com/api/v2/";
  const DATAMINE_REPO = "Discord-Datamining/Discord-Datamining";
  const COMMENTS_API = "https://api.github.com/repos/" + DATAMINE_REPO + "/comments";

  /* ---------- Small cache (memory + localStorage) ---------- */

  const memory = {};
  function cached(key, maxAgeMs, load) {
    const hit = memory[key] || readCache(key);
    if (hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.data);
    return load().then((data) => {
      memory[key] = { at: Date.now(), data };
      try { localStorage.setItem("pinged.cache." + key, JSON.stringify(memory[key])); } catch (e) { /* storage full or blocked */ }
      return data;
    }, (err) => {
      if (hit) return hit.data; // Serve stale data if the network fails.
      throw err;
    });
  }
  function readCache(key) {
    try { return JSON.parse(localStorage.getItem("pinged.cache." + key)); } catch (e) { return null; }
  }

  function getJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
      if (!r.ok) throw new Error(url + " answered " + r.status);
      return r.json();
    });
  }

  /* ---------- Discord status ---------- */

  // Turns the status page summary into groups of components, in the page's order.
  function groupComponents(components) {
    const groups = [];
    const byId = {};
    components.slice().sort((a, b) => a.position - b.position).forEach((c) => {
      if (c.group) {
        byId[c.id] = { name: c.name, status: c.status, items: [] };
        groups.push(byId[c.id]);
      }
    });
    components.slice().sort((a, b) => a.position - b.position).forEach((c) => {
      if (c.group) return;
      if (c.group_id && byId[c.group_id]) byId[c.group_id].items.push({ name: c.name, status: c.status });
      else groups.push({ name: c.name, status: c.status, items: [] });
    });
    return groups;
  }

  function loadStatus() {
    return cached("status", 60 * 1000, () =>
      Promise.all([getJson(STATUS_API + "summary.json"), getJson(STATUS_API + "incidents.json")]).then(([summary, inc]) => ({
        overall: summary.status, // { indicator: none|minor|major|critical|maintenance, description }
        groups: groupComponents(summary.components || []),
        active: summary.incidents || [],
        maintenance: summary.scheduled_maintenances || [],
        recent: (inc.incidents || []).slice(0, 15),
        fetchedAt: Date.now(),
      })));
  }

  /* ---------- Experiment feed ---------- */

  // Reads "## New Apex Experiments" / "## Removed Apex Experiments" blocks from a datamining comment.
  function parseExperimentComment(comment) {
    const out = [];
    const re = /^## (New|Removed) Apex Experiments\s*```diff\n([\s\S]*?)```/gm;
    let m;
    while ((m = re.exec(comment.body || ""))) {
      const change = m[1] === "New" ? "added" : "removed";
      let current = null;
      m[2].split("\n").forEach((line) => {
        const head = line.match(/^[+-] ([\w.-]+)(?: \((\w+)\))?\s*$/);
        if (head) {
          current = { id: head[1], kind: head[2] || "", change, variants: [], date: comment.created_at, url: comment.html_url };
          out.push(current);
        } else if (current && /^\s*\* /.test(line)) {
          current.variants.push(line.replace(/^\s*\* /, "").trim());
        }
      });
    }
    return out;
  }

  // "2026-10-user-profile-widget-suggestions" → "User profile widget suggestions"
  function readableName(id) {
    const words = id.replace(/^\d{4}-\d{2}[-_]/, "").replace(/[-_]+/g, " ").trim();
    return words ? words[0].toUpperCase() + words.slice(1) : id;
  }

  function lastPageFromLink(link) {
    const m = /[?&]page=(\d+)>; rel="last"/.exec(link || "");
    return m ? Number(m[1]) : 1;
  }

  // Newest comments live on the last pages, so read the page count first, then the last two pages.
  function loadExperimentFeed() {
    return cached("experiments", 15 * 60 * 1000, () =>
      fetch(COMMENTS_API + "?per_page=100", { method: "HEAD" }).then((r) => {
        if (!r.ok) throw new Error("GitHub answered " + r.status);
        const last = lastPageFromLink(r.headers.get("Link"));
        const pages = last > 1 ? [last - 1, last] : [last];
        return Promise.all(pages.map((p) => getJson(COMMENTS_API + "?per_page=100&page=" + p)));
      }).then((pages) => {
        const items = [].concat(...pages).flatMap(parseExperimentComment);
        return items.sort((a, b) => (a.date < b.date ? 1 : -1));
      }));
  }

  const api = {
    loadStatus, loadExperimentFeed, parseExperimentComment, groupComponents, readableName, lastPageFromLink,
    repoUrl: "https://github.com/" + DATAMINE_REPO,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedLive = api;
})(typeof window !== "undefined" ? window : globalThis);
