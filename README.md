<p align="center">
  <img src="assets/social-preview.png" alt="Pinged: the unofficial Discord field guide" width="100%">
</p>

# Pinged

**The unofficial Discord field guide.** Every markdown trick with a live Discord-style preview, tips that save clicks, the latest Discord updates, and the experiments Discord is testing.

## Tabs

| Tab | What's in it |
| --- | --- |
| **Guide** | Quick wins, keyboard shortcuts, quick-switcher prefixes, search filters, chat tricks |
| **Markdown** | Every format (text, headers, subtext, lists, quotes, code, ANSI colour, spoilers, links, mentions, timestamps) with a live preview. **Try it** opens any example in the playground |
| **Tools** | Live playground (explains why a message won't format, starts from templates, copies a link to your message), embed builder (preview, Discord's limits, import JSON, copy as JSON, curl, JavaScript or Python, or send to your webhook), permissions calculator with a bot invite link, ID decoder, timestamp maker, coloured-text (ANSI) builder |
| **Updates** | Discord changelogs and patch notes, newest first, with the source's own image and links |
| **Experiments** | Write-ups of features being tested, filtered by status or kind, plus a live feed of experiments added or removed in each Discord app update |
| **Status** | Live Discord status: systems, open incidents, maintenance and past incidents |
| **Sources** | Official Discord channels, experiment trackers and community sites |

Also: search (press `/`), a `#` link on every entry for sharing, "New" markers since your last visit, and an RSS feed (`feed.xml`).

## Live data

- **Status** comes from Discord's official status page API (`discordstatus.com/api/v2`).
- **Experiment feed** comes from comments on [Discord-Datamining](https://github.com/Discord-Datamining/Discord-Datamining) through GitHub's public API. Visitors' browsers cache it for 15 minutes to stay under GitHub's limit of 60 requests an hour.

Nothing needs a server or API key.

## Run it

No build step. It's plain HTML, CSS and JavaScript.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Deploys as-is to Vercel, Netlify or GitHub Pages. Light and dark themes follow your system, with a switch in the top-right corner.

## Edit content

All guide text, updates, experiments and sources live in [`js/content.js`](js/content.js). Add an entry and refresh. Keep a source on every update and experiment.

After editing content, rebuild the RSS feed (the tests fail if you forget):

```bash
node scripts/build-feed.js
# or, once you know the site's address:
SITE_URL=https://your-site.example/ node scripts/build-feed.js
```

## Tests

```bash
node --test test/
```

## Files

```
index.html            page shell and tabs
css/style.css         styles (site + Discord-style chat previews)
js/markdown.js        Discord markdown → safe HTML renderer, plus the message checker
js/content.js         all site content, including playground templates
js/live.js            live Discord status and experiment feed
js/embed.js           embed builder (limits, JSON import, code export, preview, webhook send)
js/discord.js         permission flags, invite links, ID decoding
js/app.js             tabs, pages, search, tools, theme switch
scripts/build-feed.js builds feed.xml from content
feed.xml              RSS feed
assets/               logo and GitHub social preview (SVG + PNG)
test/                 tests
```

## GitHub social preview

Upload `assets/social-preview.png` (1280×640) in your repo under **Settings → General → Social preview**.

## License

MIT, see [LICENSE](LICENSE). The license covers Pinged's code and writing, not the images loaded from other sites or Discord's names and logos.

---

Pinged is a fan project and is not affiliated with or endorsed by Discord Inc. Images on the Updates and Experiments pages are loaded from, and belong to, the sites credited under them.
