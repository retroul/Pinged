/*
 * Pinged — save a preview as a PNG.
 * An SVG image can't see the page's stylesheets, so the preview is cloned with its
 * computed styles written inline, drawn through <foreignObject>, and painted to a canvas.
 * Pictures from other sites are fetched into the file when the site allows it.
 * Pictures it can't fetch are left out and counted, so the caller can say so.
 */
(function (root) {
  "use strict";

  function inlineStyles(src, dst) {
    const cs = getComputedStyle(src);
    let css = "";
    for (const prop of cs) css += prop + ":" + cs.getPropertyValue(prop) + ";";
    dst.setAttribute("style", css);
    for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
  }

  function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function embedPictures(clone) {
    let skipped = 0;
    await Promise.all(Array.from(clone.querySelectorAll("img")).map(async (img) => {
      try {
        const res = await fetch(img.src, { mode: "cors" });
        if (!res.ok) throw new Error(res.status);
        img.src = await dataUrl(await res.blob());
      } catch (e) {
        skipped++;
        img.remove();
      }
    }));
    return skipped;
  }

  // Resolves to { blob, skipped }. `scale` 2 keeps text sharp on high-density screens.
  async function toPng(el, scale) {
    scale = scale || 2;
    const { width, height } = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    inlineStyles(el, clone);
    clone.style.margin = "0";
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    const skipped = await embedPictures(clone);

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%">' +
      new XMLSerializer().serializeToString(clone) + "</foreignObject></svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The browser couldn't make the image.");
    return { blob, skipped };
  }

  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  root.PingedSnapshot = { toPng, download };
})(window);
