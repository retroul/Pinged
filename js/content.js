/*
 * Pinged — site content.
 * Edit this file to add updates, experiments, tips or markdown examples.
 * Every update/experiment should keep a `source` link so readers can check it.
 */
// Credit for posts from the Discord Previews server (no public link).
const DP = ["Discord Previews (Discord server)", null];

// Turns a title into a link-friendly id: "Game Mode" → "game-mode". Used for shareable links and the RSS feed.
const slug = (text) => String(text).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");

window.PingedContent = {
  slug,
  updateId: (u) => u.date + "-" + slug(u.title),

  lastChecked: "2026-10-21",

  /* ---------- Markdown reference ---------- */
  markdown: [
    {
      id: "text",
      title: "Text formatting",
      blurb: "The basics. You can stack them, like bold + italic + underline.",
      examples: [
        { label: "Italics", src: "*italics* or _italics_" },
        { label: "Bold", src: "**bold**" },
        { label: "Bold italics", src: "***bold italics***" },
        { label: "Underline", src: "__underline__" },
        { label: "Strikethrough", src: "~~strikethrough~~" },
        { label: "Mix them", src: "__***underlined bold italics***__ and ~~**bold strike**~~" },
      ],
    },
    {
      id: "headers",
      title: "Headers & subtext",
      blurb: "Start a line with # and a space. Great for rules channels and announcements.",
      examples: [
        { label: "Big header", src: "# Welcome to the server" },
        { label: "Medium header", src: "## Rules" },
        { label: "Small header", src: "### Section three" },
        { label: "Subtext", src: "-# small grey text, nice for footnotes" },
      ],
      tip: "Headers need a space after the #. `#nospace` stays normal text.",
    },
    {
      id: "lists",
      title: "Lists",
      blurb: "Use - or * for bullets, or numbers for an ordered list. Indent with two spaces to nest.",
      examples: [
        { label: "Bullets", src: "- First thing\n- Second thing\n  - Nested thing" },
        { label: "Numbered", src: "1. Read the rules\n2. Pick your roles\n3. Say hi" },
      ],
    },
    {
      id: "quotes",
      title: "Block quotes",
      blurb: "Quote one line with >, or everything after it with >>>.",
      examples: [
        { label: "Single line", src: "> This is a quote\nThis is not" },
        { label: "Multi line", src: ">>> Everything after this\nis quoted\neven this line" },
      ],
    },
    {
      id: "code",
      title: "Code & syntax highlighting",
      blurb: "One backtick for inline code, three for a block. Put a language name after the opening backticks for colour.",
      examples: [
        { label: "Inline", src: "Run `npm install` first" },
        { label: "Block", src: "```\nno highlighting here\n```" },
        { label: "Highlighted", src: "```js\nconst greet = (name) => `hi ${name}`;\nconsole.log(greet(\"there\"));\n```" },
        { label: "Python", src: "```py\ndef add(a, b):\n    return a + b\n```" },
      ],
      tip: "Common language tags: js, ts, py, java, cs, cpp, rust, go, lua, json, yaml, css, html, sql, bash, diff.",
    },
    {
      id: "color",
      title: "Coloured text (ANSI)",
      blurb: "Discord has no colour syntax, but ```ansi code blocks understand terminal colour codes. Use the builder in Tools to make them.",
      examples: [
        { label: "ANSI block", src: "```ansi\n\u001b[1;31mRed bold\u001b[0m \u001b[32mgreen\u001b[0m \u001b[34;47mblue on white\u001b[0m\n```" },
        { label: "Diff trick", src: "```diff\n+ added line shows green\n- removed line shows red\n```" },
      ],
      tip: "ANSI colours show on desktop and web. Some mobile versions show plain text.",
    },
    {
      id: "spoilers",
      title: "Spoilers",
      blurb: "Wrap text in || to hide it until someone clicks. Click the previews to reveal.",
      examples: [
        { label: "Spoiler", src: "The ending: ||they were friends all along||" },
        { label: "Slash command", src: "/spoiler your hidden text" , noRender: true },
      ],
      tip: "Images can be spoilered too: tick \"Mark as spoiler\" when uploading, or add it after sending (added Sept 2026).",
    },
    {
      id: "links",
      title: "Links",
      blurb: "Masked links hide the URL behind text. Angle brackets stop the preview embed.",
      examples: [
        { label: "Masked link", src: "Read the [support article](https://support.discord.com/hc/en-us/articles/210298617)" },
        { label: "No embed", src: "<https://discord.com>" },
        { label: "Masked, no embed", src: "[Discord](<https://discord.com>)" },
      ],
    },
    {
      id: "mentions",
      title: "Mentions & IDs",
      blurb: "Turn on Developer Mode (Settings → Advanced) to copy IDs, then mention anything by ID.",
      examples: [
        { label: "User", src: "<@80351110224678912>" },
        { label: "Role", src: "<@&165511591545143296>" },
        { label: "Channel", src: "<#103735883630395392>" },
        { label: "Slash command", src: "</giveaway start:1023456789012345678>" },
        { label: "Server pages", src: "<id:customize> <id:browse> <id:guide> <id:linked-roles>" },
        { label: "Everyone", src: "@everyone @here" },
      ],
      tip: "Names in these previews are placeholders. In Discord they show the real user, role or channel.",
    },
    {
      id: "timestamps",
      title: "Timestamps",
      blurb: "<t:UNIX:STYLE> shows a time in each reader's own timezone. Make one in Tools → Timestamps.",
      examples: [
        { label: "Short time (t)", src: "<t:1792598400:t>" },
        { label: "Long time (T)", src: "<t:1792598400:T>" },
        { label: "Short date (d)", src: "<t:1792598400:d>" },
        { label: "Long date (D)", src: "<t:1792598400:D>" },
        { label: "Date + time (f, default)", src: "<t:1792598400>" },
        { label: "Full (F)", src: "<t:1792598400:F>" },
        { label: "Relative (R)", src: "<t:1792598400:R>" },
      ],
    },
    {
      id: "misc",
      title: "Emoji, escaping & extras",
      blurb: "Escape characters, custom emoji and line breaks.",
      examples: [
        { label: "Escape a character", src: "\\*not italic\\* and \\_\\_not underlined\\_\\_" },
        { label: "Custom emoji", src: "<:name:EMOJI_ID> or animated <a:name:EMOJI_ID>", noRender: true },
        { label: "Line break", src: "Shift + Enter makes\na new line" },
      ],
      tip: "Not supported in messages: tables, images by URL markdown, HTML, and horizontal rules.",
    },
  ],

  /* ---------- Guide tips ---------- */
  tips: [
    {
      title: "Keyboard shortcuts (desktop)",
      items: [
        ["Ctrl/⌘ + K", "Quick switcher: jump to any server, channel or DM"],
        ["Ctrl/⌘ + /", "Show every shortcut"],
        ["Esc", "Mark the current channel as read"],
        ["Shift + Esc", "Mark the whole server as read"],
        ["Alt + ↑ / ↓", "Previous / next channel"],
        ["Ctrl/⌘ + Shift + M", "Toggle mute"],
        ["Ctrl/⌘ + Shift + D", "Toggle deafen"],
        ["↑ (empty box)", "Edit your last message"],
        ["Ctrl/⌘ + E / G / S", "Emoji / GIF / sticker picker"],
      ],
    },
    {
      title: "Quick switcher prefixes",
      items: [
        ["@name", "Users only"],
        ["#name", "Text channels only"],
        ["!name", "Voice channels only"],
        ["*name", "Servers only"],
        ["@@name", "Users in all your servers (Discord Canary only, for now)"],
      ],
    },
    {
      title: "Search filters",
      items: [
        ["from: user", "Messages from someone"],
        ["mentions: user", "Messages that ping someone"],
        ["has: link / file / image / video / embed / poll", "Messages with that content"],
        ["in: #channel", "Only one channel"],
        ["before: / after: / during: date", "Limit by date"],
        ["pinned: true", "Pinned messages only"],
      ],
    },
    {
      title: "Chat tricks",
      items: [
        ["+:emoji:", "React to the last message with that emoji"],
        ["s/old/new", "Fix a typo in your last message (desktop)"],
        ["/shrug  /tableflip  /unflip", "Classic text faces"],
        ["/spoiler  /me  /nick", "Hide text, action text, change nickname"],
        ["Alt + click a message", "Mark unread from that point"],
        ["Shift + click delete", "Delete without the confirm box"],
      ],
    },
  ],

  guideCards: [
    { title: "Make your server readable", body: "Use # headers and -# subtext in rules channels, lists for steps, and masked links instead of long URLs." },
    { title: "Times in everyone's timezone", body: "Post events with <t:…:F> and <t:…:R>. Everyone sees their own timezone, plus a live countdown." },
    { title: "Stop link spam", body: "Wrap links in <angle brackets> to skip the big preview embed. Your channel stays tidy." },
    { title: "Turn on Developer Mode", body: "Settings → Advanced → Developer Mode lets you copy IDs for mentions, bots and support tickets." },
    { title: "Pin what matters", body: "Since Sept 2026 you can pin DMs on desktop and pin channels in any server, not just Community ones." },
    { title: "Know what's testing", body: "Discord tests features on small groups first. The Experiments tab tracks what's been spotted and where it came from." },
  ],

  /* ---------- Playground templates ----------
   * Each src must pass the checker (a test runs it). IDs are the placeholder ones used across the site.
   */
  templates: [
    {
      name: "Server rules",
      src: "# Server rules\n-# Ask a mod if anything is unclear\n\n1. Be kind. No harassment, hate or slurs.\n2. Keep each topic in its own channel.\n3. No spam, self-promo or unsolicited DMs.\n4. Hide big spoilers: ||like this||\n5. Mods have the final say. Questions go in <#103735883630395392>.",
    },
    {
      name: "Event announcement",
      src: "# Game night\n-# hosted by <@80351110224678912>\n**When:** <t:1792598400:F> (<t:1792598400:R>)\n**Where:** <#103735883630395392>\n> Bring snacks. Late joiners are fine.\n\nReact if you're coming.",
    },
    {
      name: "Welcome message",
      src: "# Welcome\nGlad you're here. Start with these:\n\n1. Read <#103735883630395392>\n2. Pick your roles in <id:customize>\n3. Say hi",
    },
    {
      name: "Patch notes",
      src: "## Patch notes\n-# <t:1792598400:D>\n\n**Added**\n- A channel for art\n\n**Fixed**\n- The bot no longer replies twice\n\n**Removed**\n- The old `!help` command, use `/help`",
    },
  ],

  /* ---------- Updates (newest first) ----------
   * image: the source article's own preview image, linked (not copied). credit: who owns it.
   */
  updates: [
    {
      date: "2026-10-06", title: "Patch notes",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/683a385e31ae16bd173ee8d9_image2.png", credit: "Discord",
      sources: [["Discord blog", "https://discord.com/blog/discord-patch-notes-october-6-2026"]],
      items: [
        "Images and videos now go through a media engine rewritten in Rust: faster resizing, better colour",
        "\"Show spoiler content\" setting now on mobile",
        "Stage channels: Picture-in-Picture and Text-in-Voice at the same time",
        "Shift-click a GIF to put its link in your message without sending; right-click to copy it",
        "Desktop DM privacy settings show which servers override \"All Servers\"",
        "Screen readers announce a friend's voice or activity status in DM headers (mobile)",
      ],
    },
    {
      date: "2026-10-01", title: "Halloween: Cauldron Chaos",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/6abd7a1923e7e893b8cecd7d_image4.png", credit: "Discord",
      sources: [["Discord blog", "https://discord.com/blog/halloween-2026"]],
      items: [
        "Collect four Cauldron Chaos Shop items by Oct 14 to unlock a fifth exclusive one",
        "Gift Nitro by Nov 3 to get a Hex, Crowseph or Umbra avatar decoration",
        "Limited app icon, loading animation and ringtone",
      ],
    },
    {
      date: "2026-09-25", title: "September changelog",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/66ecb1eaa5561774cf2c00d5_650233ad5dcf4b6825522e09_Fall_September.png", credit: "Discord",
      sources: [
        ["Discord blog", "https://discord.com/blog/discord-update-september-25-2026"],
        ["Outlook Respawn", "https://respawn.outlookindia.com/gaming/gaming-news/discord-september-2026-changelog-adds-new-features-and-fixes"],
        ["Discords.ai", "https://www.discords.ai/blog/discord-september-25-2026-update-new-features-news"],
      ],
      items: [
        "System-wide echo cancellation on Windows (removes game and music audio from your mic)",
        "New Nitro display-name fonts and the Gummy and Prism name effects",
        "Trending Games genre filters, and @game mentions on mobile",
        "Discord Town Hall server revamped as the home for product news",
        "Edit server tags on mobile; bulk-leave inactive group DMs",
        "Controls for friend-online notifications",
        "Mobile visual refresh: classic dark theme is back, circular avatars",
      ],
    },
    {
      date: "2026-09-16", title: "Community-requested features",
      image: "https://images.hothardware.com/contentimages/newsitem/71738/content/16x9_2133x1200_highres-discord-whatsnew-sept.jpg", credit: "HotHardware",
      sources: [["Dexerto", "https://www.dexerto.com/entertainment/discord-rolls-out-huge-batch-of-highly-requested-features-after-asking-users-for-ideas-3410116/"]],
      items: [
        "Pin DMs on desktop; pin channels in any server",
        "Open profile pictures full size; \"Friends Since\" on profiles",
        "Profile bios go from 190 to 300 characters",
        "Edit image alt text and add a spoiler after sending",
        "Mod View works for members who left or were banned; duplicate roles",
        "Copy links straight from the GIF picker",
      ],
    },
    {
      date: "2026-09-08", title: "Patch notes",
      sources: [["Releasebot", "https://releasebot.io/updates/discord"]],
      items: [
        "Free upload limit raised from 10 MB to 20 MB",
        "Desktop moves to Electron 42 for lower CPU use",
        "React Native upgrade makes mobile faster to launch",
      ],
    },
    {
      date: "2026-08-11", title: "August changelog",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/6360419dba12275999ef0eee_Summer_August.png", credit: "Discord",
      sources: [["Discord blog", "https://discord.com/blog/discord-update-august-11-2026-changelog"]],
      items: [
        "Formatting toolbar for profile bios on desktop (no markdown needed)",
        "Private profiles: everyone, smaller servers only, or friends only",
        "Add a note to friend requests",
        "Spoiler channels: members confirm before viewing",
        "@game mentions on desktop; Discord on Meta Quest; profile Frames",
        "User Settings reorganised (\"Activity\" is now \"Games & Apps\")",
      ],
    },
    {
      date: "2026-06-25", title: "June changelog",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/6494b1e02e40699d67a766e6_Summer_June.png", credit: "Discord",
      sources: [["Discord blog", "https://discord.com/blog/discord-update-june-25-2026-changelog"]],
      items: [
        "Trending Games page",
        "Tap to React: double-tap a message to react with a preset emoji",
        "New mobile \"You\" bar",
      ],
    },
    {
      date: "2026-03-24", title: "March changelog",
      image: "https://cdn.prod.website-files.com/5f9072399b2640f14d6a2bf4/65e0d5d41a1beac596a12aaa_March%20Changelog%20Headers.png", credit: "Discord",
      sources: [["Discord blog", "https://discord.com/blog/discord-update-march-24-2026-changelog"]],
      items: [
        "Zoom and pan on screen-share streams with the scroll wheel or trackpad (desktop)",
        "\"Invite to Voice\" option",
        "Game Stats profile widget supports a second game",
      ],
    },
  ],

  /* ---------- Experiments (newest first) ----------
   * status: "rolling" (rolling out or released), "canary" (live on Discord Canary),
   *         "testing" (live experiment for some users), "building" (found in code, not live yet),
   *         "leak" (datamined, not confirmed).
   * kind:   Feature, Nitro, Promotion, Safety, Developers or Event.
   * id:     Discord's internal experiment name, when known. Its YYYY-MM prefix is when it was created.
   * date:   when it was reported (YYYY-MM-DD or YYYY-MM). Leave out if unknown.
   * A source with a null URL is shown as plain text (for posts in Discord servers).
   */
  experiments: [
    {
      name: "Voice messages on desktop", status: "building", kind: "Feature",
      id: "2026-09-desktop-voice-message-recording", date: "2026-10-20",
      summary: "Recording voice messages, currently a mobile-only feature, is coming to the desktop app.",
      sources: [DP],
    },
    {
      name: "Letterboxd connection", status: "building", kind: "Feature",
      summary: "Letterboxd is being added to the list of accounts you can connect to your profile.",
      sources: [DP],
    },
    {
      name: "Nitro Emoji Packs", status: "building", kind: "Nitro",
      id: "2026-09-default-emojis",
      summary: "A planned Nitro perk: ready-made emoji packs you can use everywhere without joining the server they come from. The pack shown in early previews is a placeholder.",
      sources: [DP],
    },
    {
      name: "Best Buy promotion", status: "building", kind: "Promotion",
      id: "2026-10-macaron",
      summary: "A Nitro perk in the works: eligible subscribers get one year of My Best Buy Plus free.",
      sources: [DP],
    },
    {
      name: "Friends sidebar", status: "testing", kind: "Feature",
      id: "2026-09-friends-sidebar",
      summary: "A sidebar that shows what your friends are playing without opening the Friends tab.",
      points: [
        "Sort alphabetically, by activity, or by game; friends in voice with you get their own section",
        "Create a Friend Invite link straight from the sidebar so people can add you in one click",
        "Two versions are being tested, one of them pinned to the right side all the time. Which ships likely depends on how people use them",
      ],
      sources: [DP],
    },
    {
      name: "Riot Games promotion", status: "building", kind: "Promotion",
      summary: "Nitro users will be able to claim a $10 credit for VALORANT or League of Legends items from the Nitro home tab.",
      sources: [DP],
    },
    {
      name: "Checkpoint 2026", status: "building", kind: "Event",
      summary: "Discord's end-of-year recap returns, this time with a randomly built custom character. Each character has 7 layers with items of different rarity, for over 600 million possible combinations.",
      sources: [DP],
    },
    {
      name: "Voice activity colours", status: "building", kind: "Nitro",
      summary: "A Nitro perk that changes the colour of the ring that lights up around your avatar while you talk.",
      sources: [DP],
    },
    {
      name: "Game Mode", status: "rolling", kind: "Feature",
      id: "2026-08-game-mode", date: "2026-09-28",
      summary: "Detects when a game is running and turns off animations and some effects to lower CPU and GPU use. Discord confirmed it as an early experiment on Sept 28. No performance numbers have been published yet.",
      image: "https://www.digitalcitizen.life/wp-content/uploads/2026/10/discord-game-mode-toggle-found-in-desktop-client-with-no-figures-behind-it.jpg", credit: "Digital Citizen",
      sources: [
        DP,
        ["Discord on X", "https://x.com/discord/status/2104644717350986132"],
        ["Dexerto", "https://www.dexerto.com/entertainment/discord-testing-new-game-mode-feature-to-help-your-pc-run-better-3412955/"],
        ["HotHardware", "https://hothardware.com/news/discord-is-testing-a-leaner-game-mode-for-smoother-pc-gaming"],
      ],
    },
    {
      name: "Global age assurance", status: "rolling", kind: "Safety",
      id: "2026-08-tiny-bronco",
      summary: "Every account is placed in an age group, estimated automatically where possible (account age, payment info and similar). You can see yours in Account Settings. You only need to verify if Discord can't estimate it.",
      points: [
        "Accounts estimated as teens can't open age-restricted servers and channels, speak in Stage channels, unblur sensitive media, or turn off message requests",
        "Not verifying doesn't lock your account; only those features stay restricted",
        "New ways to verify are coming, including signals from iOS/Android and payment providers",
      ],
      sources: [
        DP,
        ["Discord blog: Safer for teens", "https://discord.com/blog/safer-for-teens-same-discord-for-adults"],
        ["Discord blog: What we got wrong", "https://discord.com/blog/getting-global-age-assurance-right-what-we-got-wrong-and-whats-changing"],
      ],
    },
    {
      name: "Badge hiding", status: "rolling", kind: "Feature",
      id: "2026-08-badge-management",
      summary: "Now rolling out on desktop and mobile: choose which badges show on your profile in profile settings. Nitro users can also reorder them.",
      points: ["During testing there were two versions: hide any badge, or hide any badge except the Nitro level badge"],
      sources: [DP, ["Happy Gamer", "https://happygamer.com/discord-experimental-badges-badge-hiding-coming-soon-162143/"]],
    },
    {
      name: "Link component embeds", status: "rolling", kind: "Developers",
      summary: "Released: websites and apps can now show message components as their link preview, so shared links can display much richer information than a normal embed.",
      sources: [DP],
    },
    {
      name: "AutoMod rules from apps", status: "building", kind: "Developers",
      id: "2026-09-automod-application-rules",
      summary: "Bots that admins approve will be able to plug into AutoMod, checking messages for rule-breaking content AutoMod can't catch on its own and acting on it automatically.",
      sources: [DP],
    },
    {
      name: "YouTube Premium promotion", status: "building", kind: "Promotion",
      id: "2026-09-youtube-3p",
      summary: "Eligible Nitro subscribers will get 20% off a 6-month YouTube Premium membership.",
      sources: [DP],
    },
    {
      name: "GTA VI campaign (\"Hexagon\")", status: "leak", kind: "Promotion",
      date: "2026-08",
      summary: "A dataminer reported code for a GTA VI promotion with a themed app icon and a reported Nov 17 start. Not confirmed by Discord or Rockstar.",
      image: "https://rockstarintel.com/wp-content/uploads/2026/08/mega-4-1787856672032-1280.webp", credit: "RockstarINTEL",
      sources: [["RockstarINTEL", "https://rockstarintel.com/gta-6-leak-reveals-new-collaboration-with-discord/"]],
    },
    {
      name: "Application channels", status: "building", kind: "Developers",
      id: "2026-07-app-channels",
      summary: "A new channel type that opens an app or Activity right inside the channel, so it feels built into the server. One app per channel, and developers will be able to opt in later.",
      points: ["Discord is also testing upgrades to the Activities SDK, such as native right-click menus and tooltips. None of this is final"],
      sources: [DP],
    },
    {
      name: "1 GB uploads for Nitro", status: "building", kind: "Nitro",
      summary: "New text in the app suggests the Nitro upload limit will rise to 1 GB. Nothing else is visible yet.",
      sources: [DP],
    },
    {
      name: "25-person Group DMs with Nitro", status: "building", kind: "Nitro",
      id: "2026-06-nitro-gdm-cap-increase",
      summary: "Nitro users will be able to add up to 25 people to a Group DM, even if they don't own it. The free limit stays at 10.",
      sources: [DP, ["Dexerto", "https://www.dexerto.com/entertainment/discord-rolls-out-huge-batch-of-highly-requested-features-after-asking-users-for-ideas-3410116/"]],
    },
    {
      name: "Orb Challenges", status: "building", kind: "Feature",
      summary: "Earn Orbs by completing tasks (internally called \"achievements\"), separate from Quests. It sits in a new \"Orbs Wallet\" that will likely replace the menu that opens when you click your Orbs count in the Shop. What the tasks are isn't known yet.",
      sources: [DP],
    },
    {
      name: "Search everyone with @@", status: "canary", kind: "Feature",
      summary: "Type @@ in the Quick Switcher (Ctrl/⌘ + K) to search users across all your servers. A single @ only searches friends and the current server.",
      sources: [DP],
    },
    {
      name: "Channel tabs", status: "testing", kind: "Feature",
      id: "2026-07-desktop-channel-tabs",
      summary: "Open channels and DMs as tabs across the top of the desktop app and switch between them quickly. Tabs show unread messages and can be pinned so they stay open.",
      sources: [DP],
    },
    {
      name: "Custom typing indicators", status: "building", kind: "Nitro",
      id: "2026-07-custom-typing-indicator",
      summary: "A Nitro perk that swaps the three typing dots for any 3 emoji you pick, plus one of several preset messages. Others see it in DMs and servers.",
      sources: [DP],
    },
    {
      name: "Server Hub", status: "building", kind: "Feature",
      id: "2026-06_guild_space",
      summary: "A customisable board inside your server made of panels that admins arrange freely. Extra panels cost boosts (1 each for now, which may change).",
      points: [
        "Information: your own image and text",
        "Leaderboard: the most active members",
        "Whiteboard: members draw together, using the Whiteboard activity",
        "Popular music: what members are listening to on Spotify",
        "Activity: what members are playing right now",
      ],
      sources: [DP],
    },
    {
      name: "Profile embeds", status: "building", kind: "Feature",
      id: "2026-08-profile-embed-rendering",
      summary: "Links like discord.com/users/<your ID> will show a preview of the profile in chat, so sharing your profile is one click.",
      sources: [DP],
    },
    {
      name: "Video & screen share blocked in Brazil", status: "testing", kind: "Safety",
      id: "2026-08-video-guard",
      summary: "To follow a Brazilian court order, this experiment stops users in Brazil from starting or watching video and screen shares in voice channels. It's built so Discord could turn it on in other regions too.",
      sources: [DP, ["BBC News", "https://www.bbc.com/news/articles/cgewpqxyrddo"]],
    },
    {
      name: "Living Room voice layout", status: "testing", kind: "Feature",
      date: "2026-06-22",
      summary: "An optional voice-call view that seats everyone's avatar in a room instead of a grid of tiles. Seats can be swapped. No spatial audio for now.",
      image: "https://www.dexerto.com/cdn-image/wp-content/uploads/2026/06/23/Discord-is-getting-a-new-feature-that-puts-your-group-chat-in-a-living-room.jpg", credit: "Dexerto",
      sources: [["Dexerto", "https://www.dexerto.com/entertainment/discord-is-getting-a-new-feature-that-puts-your-group-chat-in-a-living-room-3378565/"]],
    },
  ],

  /* ---------- Sources tab ---------- */
  sources: [
    {
      group: "Official from Discord",
      links: [
        ["Discord blog", "https://discord.com/blog", "Changelogs, patch notes and announcements"],
        ["Changelog posts", "https://discord.com/tags/changelog", "Just the monthly what's-new posts"],
        ["Discord status", "https://discordstatus.com", "Outages and maintenance (also on our Status tab)"],
        ["Help Center", "https://support.discord.com/hc/en-us", "Official how-to articles"],
        ["Markdown article", "https://support.discord.com/hc/en-us/articles/210298617", "Discord's own formatting guide"],
        ["Developer changelog", "https://docs.discord.com/developers/change-log", "API and bot changes"],
        ["@discord on X", "https://x.com/discord", "Quick announcements and replies"],
        ["Discord on YouTube", "https://www.youtube.com/@discord", "Feature videos and events"],
        ["Discord on TikTok", "https://www.tiktok.com/@discord", "Short clips"],
        ["Discord on Instagram", "https://www.instagram.com/discord/", "Short clips and art"],
      ],
    },
    {
      group: "Experiment trackers",
      links: [
        ["Discord Previews on X", "https://x.com/DiscordPreviews", "Write-ups of new experiments, often with screenshots. Most of our Experiments tab comes from them"],
        ["Discord-Datamining", "https://github.com/Discord-Datamining/Discord-Datamining", "Every Discord app update, with new strings and experiments. Powers our live feed"],
        ["xhyrom/discord-datamining", "https://github.com/xhyrom/discord-datamining", "Tracks Discord's builds, blog posts, help articles and domains"],
        ["Wumpus Central", "https://wumpus-central.github.io/", "News, leaks and beta previews, with its own Discord server"],
        ["giga.tools experiment rollouts", "https://giga.tools/discord/experiment-rollouts", "List of experiments and their rollouts"],
      ],
    },
    {
      group: "Community and news",
      links: [
        ["r/discordapp", "https://www.reddit.com/r/discordapp/", "The biggest Discord subreddit"],
        ["Releasebot", "https://releasebot.io/updates/discord", "Every Discord release note in one list"],
        ["Dexerto: Discord news", "https://www.dexerto.com/entertainment/discord-rolls-out-huge-batch-of-highly-requested-features-after-asking-users-for-ideas-3410116/", "Gaming site that regularly covers Discord changes"],
      ],
    },
  ],
};
