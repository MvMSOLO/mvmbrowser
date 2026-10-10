import { shouldBlock, type BlockLevel } from "./blocklist.ts";
import { assertPublicUrl, bumpBlocked, extraHosts } from "./filters.server.ts";
import { PAGE_BOOTSTRAP } from "./page-bootstrap.ts";
import { rewriteCss, rewriteHtml } from "./rewrite.ts";

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; MVM Browser) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const PIXEL = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0,
  44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

type Flags = {
  block: BlockLevel;
  dnt: boolean;
  gpc: boolean;
  desktop: boolean;
  sid: string;
  fp: boolean;
  rtc: boolean;
  autoplay: string;
  banner: boolean;
  dark: boolean;
  cosmetic: boolean;
  lang: string;
  data: boolean;
  mode: string;
  download: boolean;
  document: boolean;
};

function flagsOf(url: URL): Flags {
  const block = url.searchParams.get("block");
  return {
    block: block === "off" || block === "strict" ? block : "standard",
    dnt: url.searchParams.get("dnt") === "1",
    gpc: url.searchParams.get("gpc") === "1",
    desktop: url.searchParams.get("ua") === "desktop",
    sid: (url.searchParams.get("sid") || "").replace(/[^\w-]/g, "").slice(0, 40),
    fp: url.searchParams.get("fp") === "1",
    rtc: url.searchParams.get("rtc") === "1",
    autoplay: url.searchParams.get("autoplay") === "block" || url.searchParams.get("autoplay") === "allow"
      ? (url.searchParams.get("autoplay") as string)
      : "limit",
    banner: url.searchParams.get("banner") === "1",
    dark: url.searchParams.get("dark") === "1",
    cosmetic: url.searchParams.get("cosmetic") !== "0",
    lang: (url.searchParams.get("lang") || "en").replace(/[^\w-,;=.]/g, "").slice(0, 80) || "en",
    data: url.searchParams.get("data") === "1",
    mode: url.searchParams.get("mode") === "reader" || url.searchParams.get("mode") === "translate"
      ? (url.searchParams.get("mode") as string)
      : "",
    download: url.searchParams.get("download") === "1",
    document: url.searchParams.get("dest") === "document",
  };
}

function flagQuery(url: URL): string {
  const p = new URLSearchParams(url.search);
  p.delete("url");
  p.delete("download");
  p.delete("dest");
  return p.toString();
}

function errorDoc(code: string, status = 400): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>MVM</title><body style="margin:0;background:#05060A;color:#00F0FF;font-family:sans-serif;padding:24px"><p>${code}</p><script type="application/json" id="mvm-meta">{"final":"","code":${JSON.stringify(code)}}</script><script>${PAGE_BOOTSTRAP}parent.postMessage({source:"mvm",kind:"error",code:${JSON.stringify(code)}},"*");</script>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const COSMETIC = `iframe[src*="doubleclick"],iframe[id^="google_ads"],ins.adsbygoogle,.adsbygoogle,[id^="div-gpt-ad"],[class*="ad-banner"],[class*="advertisement"]{display:none!important}`;
const DARK = `html{filter:invert(1) hue-rotate(180deg);background:#111}img,video,picture,canvas{filter:invert(1) hue-rotate(180deg)}`;

function injectFor(finalUrl: string, flags: Flags): string {
  const meta = safeJson({
    final: finalUrl,
    fp: flags.fp,
    rtc: flags.rtc,
    autoplay: flags.autoplay,
    banner: flags.banner,
    zoom: 1,
  });
  const style = `${flags.cosmetic && flags.block !== "off" ? COSMETIC : ""}${flags.dark ? DARK : ""}`;
  return `<meta charset="utf-8"><script type="application/json" id="mvm-meta">${meta}</script><style id="mvm-base">${style}</style><script>${PAGE_BOOTSTRAP}</script>`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&" : c === "<" ? "<" : ">"));
}

export function readerHtml(html: string, pageUrl: string): string {
  const titleRaw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? pageUrl;
  const title = decodeEntities(titleRaw.replace(/<[^>]+>/g, "")).trim() || pageUrl;
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");
  const article = /<article\b[\s\S]*?<\/article>/i.exec(stripped)?.[0] ?? stripped;
  const paras = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40)
    .slice(0, 80);
  const body = paras.length
    ? paras
    : [decodeEntities(article.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 6000)].filter(Boolean);
  const blocks = body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{margin:0;padding:28px 20px 80px;background:#0B0E17;color:#E8F7FF;font:18px/1.55 "Exo 2",sans-serif}h1{font-size:28px;line-height:1.2}p{max-width:40rem}a{color:#00F0FF}</style></head><body><p><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></p><h1>${escapeHtml(title)}</h1>${blocks}</body></html>`;
}

async function translateHtml(html: string, pageUrl: string, to: string): Promise<string> {
  const reader = readerHtml(html, pageUrl);
  const paras = [...reader.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, "")),
  );
  const text = paras.slice(1).join("\n\n").slice(0, 3500);
  if (!text) return reader;
  const from = /[А-Яа-яЁё]/.test(text) ? "ru" : /\b(va|uchun|bilan|bu|ham)\b/i.test(text) ? "uz" : "en";
  const target = to === "ru" || to === "uz" || to === "en" ? to : "en";
  if (from === target) return reader;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 450) chunks.push(text.slice(i, i + 450));
  const out: string[] = [];
  for (const chunk of chunks.slice(0, 6)) {
    try {
      const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${target}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      const json = (await res.json()) as { responseData?: { translatedText?: string } };
      out.push(json.responseData?.translatedText || chunk);
    } catch {
      out.push(chunk);
    }
  }
  const title = /<h1>([\s\S]*?)<\/h1>/i.exec(reader)?.[1] ?? "";
  const blocks = out
    .join("\n\n")
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:28px 20px 80px;background:#0B0E17;color:#E8F7FF;font:18px/1.55 "Exo 2",sans-serif}h1{font-size:28px}p{max-width:40rem}</style></head><body><h1>${title}</h1><p>${escapeHtml(from)} → ${escapeHtml(target)}</p>${blocks}</body></html>`;
}

function blockedBody(kind: "script" | "css" | "image" | "other"): Response {
  const headers = new Headers({ "x-mvm-blocked": "1", "cache-control": "private, max-age=300" });
  if (kind === "script") {
    headers.set("content-type", "text/javascript; charset=utf-8");
    return new Response("/* mvm blocked */", { status: 200, headers });
  }
  if (kind === "css") {
    headers.set("content-type", "text/css; charset=utf-8");
    return new Response("", { status: 200, headers });
  }
  if (kind === "image") {
    headers.set("content-type", "image/gif");
    return new Response(PIXEL, { status: 200, headers });
  }
  return new Response("", { status: 204, headers });
}

function kindOf(target: URL, accept: string): "script" | "css" | "image" | "other" {
  const path = target.pathname.toLowerCase();
  if (path.endsWith(".js") || accept.includes("javascript")) return "script";
  if (path.endsWith(".css") || accept.includes("text/css")) return "css";
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)$/.test(path) || accept.startsWith("image/")) return "image";
  return "other";
}

async function fetchUpstream(
  target: URL,
  method: "GET" | "POST",
  body: string | undefined,
  flags: Flags,
  accept: string,
  range: string | null,
): Promise<{ res: Response; finalUrl: URL }> {
  let current = target;
  let verb: "GET" | "POST" = method;
  let payload: string | undefined = body;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(current);
    const headers = new Headers();
    headers.set("user-agent", flags.desktop ? DESKTOP_UA : MOBILE_UA);
    headers.set("accept", accept || "*/*");
    headers.set("accept-language", flags.lang);
    if (flags.dnt) headers.set("dnt", "1");
    if (flags.gpc) headers.set("sec-gpc", "1");
    if (flags.data) headers.set("save-data", "on");
    if (range && verb === "GET" && range.length < 80) headers.set("range", range);
    if (verb === "POST" && payload !== undefined) headers.set("content-type", "application/x-www-form-urlencoded");
    const res = await fetch(current, {
      method: verb,
      headers,
      body: verb === "POST" ? payload : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) return { res, finalUrl: current };
      current = new URL(loc, current);
      verb = "GET";
      payload = undefined;
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error("REDIRECTS");
}

function filenameOf(target: URL, res: Response): string {
  const cd = res.headers.get("content-disposition") || "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]).slice(0, 180);
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  if (plain?.[1]) return plain[1].slice(0, 180);
  const base = target.pathname.split("/").pop() || "download";
  return decodeURIComponent(base).slice(0, 180) || "download";
}

export async function handleBrowse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST" },
    });
  }
  let targetRaw = url.searchParams.get("url");
  let postBody: string | null = null;
  if (request.method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
    try {
      const body = (await request.json()) as { url?: string; fields?: [string, string][]; method?: string };
      if (body.url) targetRaw = body.url;
      if (Array.isArray(body.fields)) {
        const form = new URLSearchParams();
        for (const pair of body.fields.slice(0, 40)) {
          if (!Array.isArray(pair)) continue;
          form.append(String(pair[0]).slice(0, 80), String(pair[1]).slice(0, 2000));
        }
        postBody = form.toString();
      }
    } catch {
      return errorDoc("BAD_URL");
    }
  }
  let target: URL;
  try {
    if (!targetRaw) throw new Error("BAD_URL");
    target = new URL(targetRaw);
  } catch {
    return errorDoc("BAD_URL");
  }
  const flags = flagsOf(url);
  if (flags.block !== "off") {
    const blocked = shouldBlock(
      target.hostname,
      `${target.pathname}${target.search}`,
      flags.block,
      extraHosts(),
      flags.document && !flags.download,
    );
    if (blocked) {
      bumpBlocked(flags.sid);
      if (flags.document && !flags.download) return errorDoc("BLOCKED", 403);
      return blockedBody(kindOf(target, request.headers.get("accept") || ""));
    }
  }
  try {
    const upstreamReqMethod = postBody !== null ? "POST" : "GET";
    const { res, finalUrl } = await fetchUpstream(
      target,
      upstreamReqMethod,
      postBody ?? undefined,
      flags,
      request.headers.get("accept") || "*/*",
      request.headers.get("range"),
    );
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (flags.download) {
      const headers = new Headers();
      if (ctype) headers.set("content-type", ctype);
      headers.set("content-disposition", `attachment; filename="${filenameOf(finalUrl, res).replace(/"/g, "")}"`);
      headers.set("cache-control", "no-store");
      const cr = res.headers.get("content-range");
      if (cr) headers.set("content-range", cr);
      const ar = res.headers.get("accept-ranges");
      if (ar) headers.set("accept-ranges", ar);
      const cl = res.headers.get("content-length");
      if (cl) headers.set("content-length", cl);
      return new Response(res.body, { status: res.status, headers });
    }
    if (ctype.includes("text/html") || (flags.document && !ctype) || flags.mode) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > 3_000_000) return errorDoc("TOO_LARGE", 413);
      const charset = /charset=["']?([^"';\s]+)/i.exec(ctype)?.[1]?.trim() || "utf-8";
      let html: string;
      try {
        html = new TextDecoder(charset).decode(buf);
      } catch {
        html = new TextDecoder().decode(buf);
      }
      const flagsQuery = flagQuery(url);
      let doc = html;
      if (flags.mode === "reader") doc = readerHtml(html, finalUrl.toString());
      else if (flags.mode === "translate") {
        const to = url.searchParams.get("to") || "en";
        doc = await translateHtml(html, finalUrl.toString(), to);
      }
      const rewritten = rewriteHtml(doc, finalUrl.toString(), flagsQuery, injectFor(finalUrl.toString(), flags));
      return new Response(rewritten, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (ctype.includes("text/css")) {
      const css = await res.text();
      if (css.length > 2_000_000) return errorDoc("TOO_LARGE", 413);
      const rewritten = rewriteCss(css, finalUrl.toString(), flagQuery(url));
      return new Response(rewritten, {
        status: 200,
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": "private, max-age=120" },
      });
    }
    const headers = new Headers();
    if (ctype) headers.set("content-type", res.headers.get("content-type") || ctype);
    const cr = res.headers.get("content-range");
    if (cr) headers.set("content-range", cr);
    if (res.headers.get("accept-ranges")) headers.set("accept-ranges", res.headers.get("accept-ranges") || "bytes");
    if (res.headers.get("content-length")) headers.set("content-length", res.headers.get("content-length") || "");
    headers.set("cache-control", "private, max-age=300");
    headers.set("x-content-type-options", "nosniff");
    return new Response(res.body, { status: res.status, headers });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "FETCH";
    if (!flags.document) return new Response("", { status: 502 });
    return errorDoc(code, code === "PRIVATE" || code === "PORT" || code === "SCHEME" ? 403 : 502);
  }
}
