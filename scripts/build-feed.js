// Builds feed.xml (RSS) from js/content.js, and writes the site's address into index.html's
// og:url, og:image and canonical link (link previews need absolute URLs).
// Run after editing content:  node scripts/build-feed.js
// Set SITE_URL if the site lives somewhere else:  SITE_URL=https://example.com/ node scripts/build-feed.js
const fs = require("fs");
const path = require("path");

const SITE = (process.env.SITE_URL || "https://retroul.github.io/Pinged/").replace(/\/?$/, "/");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "feed.xml");
const INDEX = path.join(ROOT, "index.html");

function loadContent() {
  global.window = {};
  delete require.cache[require.resolve("../js/content.js")];
  require("../js/content.js");
  return global.window.PingedContent;
}

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Dates without a day (YYYY-MM) count as the 1st of that month, at noon UTC.
const rssDate = (d) => new Date((d.length === 7 ? d + "-01" : d) + "T12:00:00Z").toUTCString();

function buildFeed() {
  const C = loadContent();
  const items = [];
  C.updates.forEach((u) => items.push({
    title: "Update: " + u.title, link: SITE + "#/updates/" + C.updateId(u), date: u.date,
    text: u.items.join(". ") + ".",
  }));
  C.experiments.forEach((e) => items.push({
    title: "Experiment: " + e.name, link: SITE + "#/experiments/" + C.slug(e.name), date: e.date || e.id && e.id.slice(0, 7).replace("_", "-"),
    text: e.summary + (e.points ? " " + e.points.join(". ") + "." : ""),
  }));
  const body = items.map((i) =>
    "  <item>\n" +
    "    <title>" + xml(i.title) + "</title>\n" +
    "    <link>" + xml(i.link) + "</link>\n" +
    '    <guid isPermaLink="false">' + xml(i.link) + "</guid>\n" +
    (i.date && /^\d{4}-\d{2}/.test(i.date) ? "    <pubDate>" + rssDate(i.date) + "</pubDate>\n" : "") +
    "    <description>" + xml(i.text) + "</description>\n" +
    "  </item>").join("\n");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n' +
    "  <title>Pinged: Discord updates and experiments</title>\n" +
    "  <link>" + xml(SITE) + "</link>\n" +
    "  <description>Discord changelogs and experiments, collected by Pinged, the unofficial Discord field guide.</description>\n" +
    "  <language>en</language>\n" +
    "  <lastBuildDate>" + rssDate(C.lastChecked) + "</lastBuildDate>\n" +
    body + "\n</channel>\n</rss>\n";
}

// Points index.html's absolute-URL tags at `site`.
function stampIndex(html, site) {
  return html
    .replace(/(<meta property="og:url" content=")[^"]*(")/, "$1" + site + "$2")
    .replace(/(<meta property="og:image" content=")[^"]*(")/, "$1" + site + "assets/social-preview.png$2")
    .replace(/(<link rel="canonical" href=")[^"]*(")/, "$1" + site + "$2");
}

if (require.main === module) {
  fs.writeFileSync(OUT, buildFeed());
  fs.writeFileSync(INDEX, stampIndex(fs.readFileSync(INDEX, "utf8"), SITE));
  console.log("Wrote " + path.relative(ROOT, OUT) + " and " + path.relative(ROOT, INDEX));
}
module.exports = { buildFeed, stampIndex, SITE, OUT, INDEX };
