/** Runs inside proxied documents (sandboxed iframe). Keep it dependency-free. */
export const PAGE_BOOTSTRAP = `(function(){
  var metaEl = document.getElementById("mvm-meta");
  var meta = {};
  try { meta = JSON.parse((metaEl && metaEl.textContent) || "{}"); } catch (e) { meta = {}; }
  function currentPage(){
    try { return new URL(document.baseURI).searchParams.get("url") || meta.final || ""; }
    catch (e) { return meta.final || ""; }
  }
  function proxy(abs){
    var base = new URL(document.baseURI);
    var params = new URLSearchParams(base.search);
    params.delete("dest");
    params.set("url", abs);
    base.search = params.toString();
    return base.toString();
  }
  function report(data){
    try {
      var payload = { source: "mvm", pageUrl: meta.final || currentPage(), title: document.title };
      for (var k in data) payload[k] = data[k];
      parent.postMessage(payload, "*");
    } catch (e) {}
  }
  report({ kind: "load" });
  function absoluteFromAnchor(a){
    var raw = a.getAttribute("href") || "";
    try {
      if (raw.charAt(0) === "?") return new URL(raw, document.baseURI).searchParams.get("url") || raw;
      return new URL(raw, meta.final || currentPage() || document.baseURI).toString();
    } catch (e) { return raw; }
  }
  document.addEventListener("contextmenu", function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    report({ kind: "link", href: absoluteFromAnchor(a), text: (a.textContent || "").trim().slice(0, 140) });
  }, true);
  var hold = 0;
  document.addEventListener("touchstart", function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest("a[href]");
    if (!a) return;
    var href = absoluteFromAnchor(a);
    var text = (a.textContent || "").trim().slice(0, 140);
    hold = window.setTimeout(function(){ report({ kind: "link", href: href, text: text }); }, 520);
  }, { passive: true, capture: true });
  function cancelHold(){ window.clearTimeout(hold); }
  document.addEventListener("touchend", cancelHold, true);
  document.addEventListener("touchmove", cancelHold, true);
  document.addEventListener("submit", function(e){
    var form = e.target;
    if (!form || form.nodeName !== "FORM") return;
    e.preventDefault();
    var method = (form.getAttribute("method") || "get").toLowerCase();
    var actionAttr = form.getAttribute("action") || meta.final || currentPage();
    var action = actionAttr;
    try {
      if (actionAttr && actionAttr.charAt(0) === "?") action = new URL(actionAttr, document.baseURI).searchParams.get("url") || action;
      else action = new URL(actionAttr, meta.final || currentPage() || document.baseURI).toString();
    } catch (err) {}
    var fields = [];
    try {
      var fd = new FormData(form);
      fd.forEach(function(v, k){ if (typeof v === "string") fields.push([k, v]); });
    } catch (err2) {}
    if (method !== "post") {
      try {
        var u = new URL(action);
        for (var i = 0; i < fields.length; i++) u.searchParams.append(fields[i][0], fields[i][1]);
        location.href = proxy(u.toString());
      } catch (err3) { report({ kind: "error", code: "FORM" }); }
      return;
    }
    report({ kind: "form", action: action, fields: fields });
  }, true);
  window.open = function(u){
    var abs = String(u || "");
    try { abs = new URL(abs, meta.final || currentPage() || document.baseURI).toString(); } catch (e) {}
    report({ kind: "open", href: abs });
    return null;
  };
  var lastY = 0;
  window.addEventListener("scroll", function(){
    var y = window.scrollY || 0;
    var dir = y > lastY + 16 ? "down" : y < lastY - 16 ? "up" : "";
    lastY = y;
    if (dir) report({ kind: "scroll", dir: dir });
  }, { passive: true });
  var startY = 0;
  document.addEventListener("touchstart", function(e){
    if (e.touches && e.touches[0]) startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function(e){
    var y = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : startY;
    if ((window.scrollY || 0) <= 0 && y - startY > 78) report({ kind: "pull" });
  }, { passive: true });
  if (meta.fp) {
    try { Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: function(){ return 4; } }); } catch (e) {}
    try {
      var gid = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(){
        var img = gid.apply(this, arguments);
        if (img && img.data && img.data.length > 8) img.data[0] = img.data[0] ^ 1;
        return img;
      };
    } catch (e2) {}
  }
  if (meta.rtc) {
    var kill = function(){ throw new Error("WebRTC blocked"); };
    window.RTCPeerConnection = kill;
    window.webkitRTCPeerConnection = kill;
  }
  function tame(){
    if (meta.autoplay !== "block" && meta.autoplay !== "limit") return;
    var media = document.querySelectorAll("video,audio");
    for (var i = 0; i < media.length; i++) {
      var el = media[i];
      if (el.autoplay || el.hasAttribute("autoplay")) {
        if (meta.autoplay === "block" || !el.muted) { try { el.pause(); } catch (e) {} el.removeAttribute("autoplay"); }
      }
    }
  }
  document.addEventListener("DOMContentLoaded", tame);
  window.setTimeout(tame, 500);
  document.addEventListener("play", function(e){
    var el = e.target;
    if (!el || !el.tagName) return;
    if (el.tagName === "VIDEO" || el.tagName === "AUDIO") report({ kind: "media", state: "play" });
  }, true);
  if (meta.banner) {
    window.setTimeout(function(){
      var nodes = document.querySelectorAll("button,[role=button],a");
      var re = /reject all|decline all|disagree|only required|essential only|не принимать|отклонить|rad etish/i;
      for (var i = 0; i < nodes.length && i < 100; i++) {
        var label = ((nodes[i].innerText || nodes[i].getAttribute("aria-label") || "") + "").trim();
        if (label && label.length < 64 && re.test(label)) { try { nodes[i].click(); } catch (e) {} break; }
      }
    }, 800);
  }
  var hits = [];
  var hitIndex = -1;
  var lastQ = "";
  function clearMarks(){
    for (var i = 0; i < hits.length; i++) {
      var m = hits[i];
      if (m.parentNode) m.parentNode.replaceChild(document.createTextNode(m.textContent || ""), m);
    }
    if (document.body) document.body.normalize();
    hits = [];
    hitIndex = -1;
  }
  function doFind(q, step){
    if (!q) { clearMarks(); lastQ = ""; report({ kind: "find", count: 0, index: 0 }); return; }
    if (lastQ !== q) {
      clearMarks();
      lastQ = q;
      var root = document.body || document.documentElement;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var nodes = [];
      var node;
      var qq = q.toLowerCase();
      while ((node = walker.nextNode())) {
        if (node.parentElement && node.parentElement.closest("script,style")) continue;
        if ((node.nodeValue || "").toLowerCase().indexOf(qq) !== -1) nodes.push(node);
      }
      for (var j = 0; j < nodes.length; j++) {
        var text = nodes[j].nodeValue || "";
        var lower = text.toLowerCase();
        var frag = document.createDocumentFragment();
        var from = 0;
        var at = lower.indexOf(qq);
        while (at !== -1) {
          frag.appendChild(document.createTextNode(text.slice(from, at)));
          var mark = document.createElement("mark");
          mark.setAttribute("style", "background:#FF2E93;color:#05060A");
          mark.textContent = text.slice(at, at + q.length);
          frag.appendChild(mark);
          hits.push(mark);
          from = at + q.length;
          at = lower.indexOf(qq, from);
        }
        frag.appendChild(document.createTextNode(text.slice(from)));
        if (nodes[j].parentNode) nodes[j].parentNode.replaceChild(frag, nodes[j]);
      }
    }
    if (!hits.length) { report({ kind: "find", count: 0, index: 0 }); return; }
    var delta = step || 1;
    hitIndex = hitIndex < 0 ? 0 : (hitIndex + delta + hits.length) % hits.length;
    var cur = hits[hitIndex];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "center" });
    report({ kind: "find", count: hits.length, index: hitIndex + 1 });
  }
  function fillLogin(username, password){
    var pass = document.querySelector("input[type=password]");
    if (pass) {
      pass.value = password;
      pass.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var user = document.querySelector("input[type=email],input[name*=user i],input[name*=login i],input[type=text]");
    if (user && username) {
      user.value = username;
      user.dispatchEvent(new Event("input", { bubbles: true }));
    }
    report({ kind: "filled" });
  }
  window.addEventListener("message", function(e){
    var d = e.data;
    if (!d || d.source !== "mvm-parent") return;
    if (d.kind === "find") doFind(String(d.query || ""), Number(d.step || 0));
    if (d.kind === "zoom") document.documentElement.style.zoom = String(d.zoom || 1);
    if (d.kind === "print") { try { window.print(); } catch (err) {} }
    if (d.kind === "stop") { try { window.stop(); } catch (err2) {} }
    if (d.kind === "fill") fillLogin(String(d.username || ""), String(d.password || ""));
    if (d.kind === "css") {
      var el = document.getElementById("mvm-user");
      if (!el) { el = document.createElement("style"); el.id = "mvm-user"; document.documentElement.appendChild(el); }
      el.textContent = String(d.css || "").slice(0, 20000);
    }
  });
  if (meta.zoom && Number(meta.zoom) !== 1) document.documentElement.style.zoom = String(meta.zoom);
})();`;
