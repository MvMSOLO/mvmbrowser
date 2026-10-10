import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteCss, rewriteHtml, resolveHttpUrl } from "./rewrite.ts";

describe("rewrite", () => {
  it("resolves relative URLs and skips dangerous schemes", () => {
    assert.equal(resolveHttpUrl("/a", "https://ex.com/b/"), "https://ex.com/a");
    assert.equal(resolveHttpUrl("javascript:alert(1)", "https://ex.com/"), null);
    assert.equal(resolveHttpUrl("https://user:pw@ex.com/", "https://ex.com/"), null);
  });

  it("rewrites anchors, srcset, and css to proxy query refs", () => {
    const html = `<head><link href="/app.css"></head><a href="/next">n</a><img srcset="/a.png 1x, /b.png 2x"><div style="background:url('/c.png')"></div>`;
    const out = rewriteHtml(html, "https://ex.com/dir/page", "block=standard");
    assert.match(out, /href="\?url=https%3A%2F%2Fex\.com%2Fnext&block=standard"|href="\?url=https%3A%2F%2Fex\.com%2Fnext&block=standard"/);
    assert.match(out, /block=standard/);
    assert.match(out, /ex\.com%2Fapp\.css|ex\.com\/app\.css/);
    assert.match(out, /ex\.com%2Fa\.png|ex\.com\/a\.png/);
    const css = rewriteCss("body{background:url(/bg.png)}", "https://ex.com/", "block=off");
    assert.match(css, /\?url=/);
  });
});
