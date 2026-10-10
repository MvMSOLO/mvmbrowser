import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEngine, detectQuery, isPrivateHost } from "./omnibox.ts";

describe("detectQuery", () => {
  it("treats phrases as search", () => {
    assert.equal(detectQuery("how to boost fps").kind, "search");
    assert.equal(detectQuery("example.com reviews").kind, "search");
  });

  it("accepts scheme-less domains, IPs, and full URLs", () => {
    assert.equal(detectQuery("example.com").kind, "url");
    assert.equal(detectQuery("example.com").url, "https://example.com/");
    assert.equal(detectQuery("1.1.1.1").kind, "url");
    assert.equal(detectQuery("https://example.com/a").kind, "url");
    assert.equal(detectQuery("example.com:8080/x").url, "https://example.com:8080/x");
  });

  it("recognizes internal pages and blocks private or non-http schemes", () => {
    assert.equal(detectQuery("mvm://settings").kind, "internal");
    assert.equal(detectQuery("about:blank").kind, "internal");
    assert.equal(detectQuery("localhost:3000").code, "private");
    assert.equal(detectQuery("192.168.1.1").code, "private");
    assert.equal(detectQuery("file:///etc/passwd").code, "scheme");
    assert.equal(detectQuery("javascript:alert(1)").code, "scheme");
  });

  it("flags private hosts", () => {
    assert.equal(isPrivateHost("127.0.0.1"), true);
    assert.equal(isPrivateHost("10.1.2.3"), true);
    assert.equal(isPrivateHost("example.com"), false);
  });

  it("fills search templates", () => {
    assert.equal(applyEngine("https://duck.test/?q=%s", "a b"), "https://duck.test/?q=a%20b");
  });
});
