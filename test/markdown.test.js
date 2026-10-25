// Run with: node --test test/
const test = require("node:test");
const assert = require("node:assert");
const MD = require("../js/markdown.js");
const r = (s) => MD.render(s);

test("basic styles", () => {
  assert.match(r("**b** *i* __u__ ~~s~~ ***bi***"), /<strong>b<\/strong> <em>i<\/em> <u>u<\/u> <s>s<\/s> <strong><em>bi<\/em><\/strong>/);
  assert.match(r("_under_score"), /_under_score/);   // not italic mid-word
  assert.match(r("snake_case_name"), /snake_case_name/);
});
test("html is escaped everywhere", () => {
  const out = r('<img src=x onerror=alert(1)> `<b>` ```\n<script>\n``` [x](javascript:alert(1)) "q"');
  assert.doesNotMatch(out, /<img|<script|<b>|href="javascript/);
});
test("link attribute cannot be broken out of", () => {
  assert.doesNotMatch(r('[x](https://a.com/"onmouseover="alert(1))'), /" onmouseover|"onmouseover="/);
});
test("code is not formatted", () => {
  assert.match(r("`**no**`"), /<code class="md-inline">\*\*no\*\*<\/code>/);
  assert.match(r("```js\nconst a = **b**;\n```"), /language-js">const a = \*\*b\*\*;<\/code>/);
});
test("blocks", () => {
  assert.match(r("# Big"), /<div class="md-h md-h1">Big<\/div>/);
  assert.match(r("#nospace"), /#nospace/);
  assert.match(r("-# sub"), /md-subtext">sub/);
  assert.match(r("> q\nnot"), /<blockquote class="md-quote"><div class="md-line">q<\/div><\/blockquote><div class="md-line">not/);
  assert.match(r("a\n>>> x\ny"), /<blockquote class="md-quote"><div class="md-line">x<br>y/);
  assert.match(r("- a\n  - b\n- c"), /<ul class="md-list"><li>a<ul class="md-list"><li>b<\/li><\/ul><\/li><li>c<\/li><\/ul>/);
  assert.match(r("3. x\n4. y"), /<ol class="md-list" start="3">/);
});
test("spoilers, mentions, timestamps, escapes", () => {
  assert.match(r("||s||"), /md-spoiler[^>]*>s<\/span>/);
  assert.match(r("<@123> <@&45> <#67> </ban user:1>"), /@user.*@role.*# channel.*\/ban user/);
  assert.match(r("<t:0:R>"), /md-time/);
  assert.match(r("\\*lit\\*"), /^<div class="md-line">\*lit\*<\/div>$/);
  assert.match(r("<https://a.com>"), /href="https:\/\/a.com"/);
  assert.match(r("[t](<https://a.com>)"), /href="https:\/\/a.com"[^>]*>t<\/a>/);
});
test("ansi", () => {
  const out = MD.renderAnsi(MD.tokensToAnsi("{bold}{red}hi{reset} <x>"));
  assert.match(out, /<span class="ansi-bold ansi-fg-red">hi<\/span> &lt;x&gt;/);
  assert.match(r("```ansi\n\u001b[32mg\u001b[0m\n```"), /ansi-fg-green">g</);
});
test("every content example renders", () => {
  global.window = {};
  require("../js/content.js");
  for (const s of window.PingedContent.markdown) for (const ex of s.examples) assert.ok(r(ex.src).length > 0, ex.label);
});
test("formatting can span lines, like in Discord", () => {
  assert.match(r("||line one\nline two||"), /md-spoiler[^>]*>line one<br>line two<\/span>/);
  assert.match(r("**a\nb**"), /<strong>a<br>b<\/strong>/);
});
test("links keep brackets in the URL", () => {
  assert.match(r("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))"), /href="https:\/\/en.wikipedia.org\/wiki\/Foo_\(bar\)"[^>]*>wiki<\/a><\/div>$/);
});

test("long messages split under the limit and each piece formats on its own", () => {
  const source = "**bold " + "word ".repeat(300) + "end**\n\n```js\n" + "let a = 1;\n".repeat(250) + "```\n\nand ||spoiler " + "hush ".repeat(200) + "|| done";
  assert.deepStrictEqual(MD.lint(source), [], "the fixture itself is valid");
  for (const limit of [2000, 500, 150]) {
    const pieces = MD.split(source, limit);
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((p) => p.length <= limit), "every piece fits in " + limit);
    assert.deepStrictEqual(pieces.flatMap((p) => MD.lint(p)), [], "no piece leaves bold, a spoiler or a code block open");
    assert.ok(pieces.every((p) => p === p.trim()), "no piece starts or ends with blank space");
    const words = (t) => t.replace(/```\w*|\*\*|\|\||`/g, " ").split(/\s+/).filter(Boolean);
    assert.deepStrictEqual(words(pieces.join("\n")), words(source), "nothing is lost or repeated");
  }
});

test("a cut on a blank line does not leave a blank line at the start of the next piece", () => {
  const para = "Here is a paragraph of text that goes on for a while. ".repeat(20);
  const pieces = MD.split([para, para, para].join("\n\n"), 2000);
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((p) => !/^\s|\s$/.test(p)));
});

test("a code block cut in two keeps its language on both halves", () => {
  const pieces = MD.split("intro\n```python\n" + "print(1)\n".repeat(60) + "```\noutro", 200);
  const inCode = pieces.filter((p) => p.includes("print(1)"));
  assert.ok(inCode.length > 1);
  assert.ok(inCode.slice(1).every((p) => p.startsWith("```python\n")), "later halves reopen with the language");
  assert.ok(inCode.slice(0, -1).every((p) => p.endsWith("\n```")), "earlier halves are closed");
});

test("splitting leaves short text alone and cuts a long word without breaking an emoji", () => {
  assert.deepStrictEqual(MD.split("hello", 2000), ["hello"]);
  assert.deepStrictEqual(MD.split("", 2000), []);
  const pieces = MD.split("😀".repeat(300), 200);
  assert.ok(pieces.every((p) => p.length <= 200 && !/[\ud800-\udbff]$/.test(p) && !/^[\udc00-\udfff]/.test(p)));
  assert.strictEqual(pieces.join(""), "😀".repeat(300));
});
