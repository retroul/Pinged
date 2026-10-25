// Fails when the site's content hasn't been re-checked against Discord's own sources lately.
// After you've gone through the Sources page and updated js/content.js, bump `lastChecked` there
// and run:  node scripts/build-feed.js
const MAX_DAYS = 14;

function daysSince(isoDate, now) {
  return Math.floor((now - new Date(isoDate + "T00:00:00Z")) / 86400000);
}

if (require.main === module) {
  global.window = {};
  require("../js/content.js");
  const checked = global.window.PingedContent.lastChecked;
  const age = daysSince(checked, new Date());
  if (age > MAX_DAYS) {
    console.error("Content was last checked " + age + " days ago (" + checked + "). Re-check the Sources page, update js/content.js and bump lastChecked.");
    process.exit(1);
  }
  console.log("Content checked " + age + " day" + (age === 1 ? "" : "s") + " ago.");
}
module.exports = { daysSince, MAX_DAYS };
