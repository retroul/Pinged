/*
 * Pinged — Discord numbers: permission flags, invite links and ID (snowflake) decoding.
 * Permission bits come from Discord's developer docs (docs.discord.com/developers/topics/permissions).
 * They go past 2^53, so everything here uses BigInt and passes values around as decimal strings.
 */
(function (root) {
  "use strict";

  // [flag, bit, label, group]. Bit 47 is unused by Discord.
  const PERMISSIONS = [
    ["ADMINISTRATOR", 3, "Administrator (all permissions)", "General"],
    ["VIEW_CHANNEL", 10, "View channels", "General"],
    ["MANAGE_CHANNELS", 4, "Manage channels", "General"],
    ["MANAGE_ROLES", 28, "Manage roles", "General"],
    ["MANAGE_GUILD_EXPRESSIONS", 30, "Manage emoji, stickers and sounds", "General"],
    ["CREATE_GUILD_EXPRESSIONS", 43, "Create emoji, stickers and sounds", "General"],
    ["VIEW_AUDIT_LOG", 7, "View audit log", "General"],
    ["VIEW_GUILD_INSIGHTS", 19, "View server insights", "General"],
    ["MANAGE_WEBHOOKS", 29, "Manage webhooks", "General"],
    ["MANAGE_GUILD", 5, "Manage server", "General"],
    ["VIEW_CREATOR_MONETIZATION_ANALYTICS", 41, "View role subscription insights", "General"],

    ["CREATE_INSTANT_INVITE", 0, "Create invite", "Members"],
    ["CHANGE_NICKNAME", 26, "Change nickname", "Members"],
    ["MANAGE_NICKNAMES", 27, "Manage nicknames", "Members"],
    ["KICK_MEMBERS", 1, "Kick members", "Members"],
    ["BAN_MEMBERS", 2, "Ban members", "Members"],
    ["MODERATE_MEMBERS", 40, "Time out members", "Members"],

    ["SEND_MESSAGES", 11, "Send messages and create posts", "Text"],
    ["SEND_MESSAGES_IN_THREADS", 38, "Send messages in threads", "Text"],
    ["CREATE_PUBLIC_THREADS", 35, "Create public threads", "Text"],
    ["CREATE_PRIVATE_THREADS", 36, "Create private threads", "Text"],
    ["EMBED_LINKS", 14, "Embed links", "Text"],
    ["ATTACH_FILES", 15, "Attach files", "Text"],
    ["ADD_REACTIONS", 6, "Add reactions", "Text"],
    ["USE_EXTERNAL_EMOJIS", 18, "Use external emoji", "Text"],
    ["USE_EXTERNAL_STICKERS", 37, "Use external stickers", "Text"],
    ["MENTION_EVERYONE", 17, "Mention @everyone, @here and all roles", "Text"],
    ["MANAGE_MESSAGES", 13, "Manage messages", "Text"],
    ["PIN_MESSAGES", 51, "Pin messages", "Text"],
    ["BYPASS_SLOWMODE", 52, "Bypass slowmode", "Text"],
    ["MANAGE_THREADS", 34, "Manage threads", "Text"],
    ["READ_MESSAGE_HISTORY", 16, "Read message history", "Text"],
    ["SEND_TTS_MESSAGES", 12, "Send text-to-speech messages", "Text"],
    ["SEND_VOICE_MESSAGES", 46, "Send voice messages", "Text"],
    ["SEND_POLLS", 49, "Create polls", "Text"],
    ["USE_APPLICATION_COMMANDS", 31, "Use slash commands", "Text"],
    ["USE_EXTERNAL_APPS", 50, "Use external apps", "Text"],

    ["CONNECT", 20, "Connect", "Voice"],
    ["SPEAK", 21, "Speak", "Voice"],
    ["STREAM", 9, "Video and screen share", "Voice"],
    ["USE_EMBEDDED_ACTIVITIES", 39, "Use activities", "Voice"],
    ["USE_SOUNDBOARD", 42, "Use soundboard", "Voice"],
    ["USE_EXTERNAL_SOUNDS", 45, "Use external sounds", "Voice"],
    ["USE_VAD", 25, "Use voice activity", "Voice"],
    ["PRIORITY_SPEAKER", 8, "Priority speaker", "Voice"],
    ["MUTE_MEMBERS", 22, "Mute members", "Voice"],
    ["DEAFEN_MEMBERS", 23, "Deafen members", "Voice"],
    ["MOVE_MEMBERS", 24, "Move members", "Voice"],
    ["SET_VOICE_CHANNEL_STATUS", 48, "Set voice channel status", "Voice"],
    ["REQUEST_TO_SPEAK", 32, "Request to speak (Stage)", "Voice"],

    ["CREATE_EVENTS", 44, "Create events", "Events"],
    ["MANAGE_EVENTS", 33, "Manage events", "Events"],
  ];

  const BIT = Object.fromEntries(PERMISSIONS.map(([flag, bit]) => [flag, BigInt(bit)]));
  const ALL_BITS = PERMISSIONS.reduce((sum, [, bit]) => sum | (1n << BigInt(bit)), 0n);

  // ["SEND_MESSAGES", ...] → "2048"
  function flagsToInt(flags) {
    return flags.reduce((sum, f) => (f in BIT ? sum | (1n << BIT[f]) : sum), 0n).toString();
  }

  // "2048" → { flags: ["SEND_MESSAGES"], unknown: "0" }. Returns null when the text isn't a whole number.
  function intToFlags(text) {
    const t = String(text).trim();
    if (!/^\d{1,20}$/.test(t)) return null;
    const n = BigInt(t);
    return {
      flags: PERMISSIONS.filter(([, bit]) => n & (1n << BigInt(bit))).map(([flag]) => flag),
      unknown: (n & ~ALL_BITS).toString(),
    };
  }

  const isSnowflake = (s) => /^\d{17,20}$/.test(String(s).trim()) && BigInt(String(s).trim()) < 1n << 64n;

  // The OAuth link that adds a bot (and its slash commands) to a server. `perms` is a decimal string.
  function inviteUrl(clientId, perms) {
    return "https://discord.com/oauth2/authorize?client_id=" + String(clientId).trim() +
      "&scope=bot%20applications.commands&permissions=" + (perms || "0");
  }

  const DISCORD_EPOCH = 1420070400000n;

  // Every Discord ID packs in the moment it was made: 42 bits of milliseconds since 2015-01-01, then worker, process and a counter.
  function decodeSnowflake(text) {
    if (!isSnowflake(text)) return null;
    const id = BigInt(String(text).trim());
    const ms = Number((id >> 22n) + DISCORD_EPOCH);
    return {
      ms,
      unix: Math.floor(ms / 1000),
      iso: new Date(ms).toISOString(),
      worker: Number((id & 0x3E0000n) >> 17n),
      process: Number((id & 0x1F000n) >> 12n),
      increment: Number(id & 0xFFFn),
    };
  }

  const api = { PERMISSIONS, flagsToInt, intToFlags, isSnowflake, inviteUrl, decodeSnowflake };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PingedDiscord = api;
})(typeof window !== "undefined" ? window : globalThis);
