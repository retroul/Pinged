/* Pinged — runs in <head> before the page draws, so it never flashes the wrong colours. */
(function () {
  "use strict";
  var t = null;
  try { t = localStorage.getItem("pinged.theme"); } catch (e) { /* storage blocked */ }
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  // Code colours follow the theme too.
  window.setCodeTheme = function (theme) {
    var dark = document.getElementById("hl-dark"), light = document.getElementById("hl-light");
    if (dark) dark.disabled = theme === "light";
    if (light) light.disabled = theme !== "light";
    // The browser's own bar matches the page background.
    var bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = theme === "light" ? "#f6f3ee" : "#1a1715";
  };
  window.setCodeTheme(t);
})();
