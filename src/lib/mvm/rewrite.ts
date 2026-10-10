/** Pure HTML/CSS rewriter for the document proxy. No Node APIs. */

const SKIP = /^(#|data:|blob:|javascript:|mailto:|tel:|about:|mvm:)/i;

export function resolveHttpUrl(raw: string, base: string): string | null {
  const t = raw.trim();
  if (!t || SKIP.test(t)) return null;
  if (t.startsWith("?url=") || t.includes("/api/browse?")) return null;
  try {
    const u = new URL(t, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function toProxyRef(abs: string, flagsQuery: string): string {
  const p = new URLSearchParams();
  p.set("url", abs);
  const flags = new URLSearchParams(flagsQuery);
  flags.forEach((v, k) => {
    if (k !== "url" && k !== "dest") p.set(k, v);
  });
  return `?${p.toString()}`;
}

function rewriteSrcset(value: string, pageUrl: string, flagsQuery: string): string {
  return value
    .split(",")
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      const first = bits[0];
      if (!first) return part;
      const abs = resolveHttpUrl(first, pageUrl);
      if (!abs) return part;
      bits[0] = toProxyRef(abs, flagsQuery);
      return bits.join(" ");
    })
    .join(", ");
}

export function rewriteCss(css: string, pageUrl: string, flagsQuery: string): string {
  const withUrl = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q: string, inner: string) => {
    const abs = resolveHttpUrl(inner.trim(), pageUrl);
    if (!abs) return full;
    const quote = q || "";
    return `url(${quote}${toProxyRef(abs, flagsQuery)}${quote})`;
  });
  return withUrl.replace(/@import\s+(['"])([^'"]+)\1/gi, (full, q: string, inner: string) => {
    const abs = resolveHttpUrl(inner.trim(), pageUrl);
    if (!abs) return full;
    return `@import ${q}${toProxyRef(abs, flagsQuery)}${q}`;
  });
}

/**
 * Rewrite fetchable URLs to same-document query refs (`?url=`).
 * Relative query URLs keep whatever public path prefix loaded the document.
 */
export function rewriteHtml(html: string, pageUrl: string, flagsQuery: string, inject = ""): string {
  let out = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*['"]?\s*content-security-policy\s*['"]?[^>]*>/gi,
    "",
  );
  out = out.replace(/<base\b[^>]*>/gi, "");
  out = out.replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  out = out.replace(/\s+nonce\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  out = out.replace(/\s+crossorigin\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  out = out.replace(
    /(<[a-zA-Z][^>]*?\s)(href|src|action|poster|formaction)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (full, start: string, name: string, _quoted: string, a?: string, b?: string) => {
      const raw = (a ?? b ?? "").trim();
      const abs = resolveHttpUrl(raw, pageUrl);
      if (!abs) return full;
      const quote = full.includes("'") && !full.trimEnd().endsWith('"') && a === undefined ? "'" : '"';
      return `${start}${name}=${quote}${toProxyRef(abs, flagsQuery)}${quote}`;
    },
  );

  out = out.replace(/\ssrcset\s*=\s*("([^"]*)"|'([^']*)')/gi, (full, _q: string, a?: string, b?: string) => {
    const raw = a ?? b ?? "";
    const next = rewriteSrcset(raw, pageUrl, flagsQuery);
    const quote = full.indexOf("'") !== -1 && full.indexOf('"') === -1 ? "'" : '"';
    return ` srcset=${quote}${next}${quote}`;
  });

  out = out.replace(
    /(<[^>]*?\sstyle\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (full, start: string, _q: string, a?: string, b?: string) => {
      const raw = a ?? b ?? "";
      if (!/url\(/i.test(raw)) return full;
      const quote = a !== undefined ? '"' : "'";
      return `${start}${quote}${rewriteCss(raw, pageUrl, flagsQuery)}${quote}`;
    },
  );

  if (inject) {
    if (/<head\b[^>]*>/i.test(out)) out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${inject}`);
    else out = inject + out;
  }
  return out;
}
