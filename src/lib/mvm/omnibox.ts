/** Omnibox: URL vs search vs internal page. Pure — no DOM. */

export type DetectKind = "url" | "search" | "internal" | "blocked";

export type Detected = {
  kind: DetectKind;
  /** Absolute http(s) URL, internal mvm:/about: URL, or empty for a bare search. */
  url: string;
  /** Block reason code when kind is blocked. */
  code?: "scheme" | "private" | "empty";
};

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|\[::1\]|\[fc[0-9a-f]{2}:|\[fd[0-9a-f]{2}:|\[fe80:)/i;

function hasWhitespace(s: string): boolean {
  return /\s/.test(s);
}

function ipv4Private(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const n = m.slice(1).map((x) => Number(x));
  if (n.some((x) => x > 255)) return false;
  const [a, b] = n;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (v === "::1" || v === "0.0.0.0" || v === "169.254.169.254") return true;
  if (v.includes(":") && (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd"))) return true;
  return isPrivateHost(v);
}

export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".localhost")) return true;
  if (h.includes(":")) {
    if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  }
  if (ipv4Private(h)) return true;
  return PRIVATE_HOST.test(host);
}

/**
 * Classify raw omnibox text.
 * Whitespace without a scheme is always a search.
 * Scheme-less domains, IPv4, and localhost are URLs (localhost is then blocked).
 */
export function detectQuery(input: string): Detected {
  const raw = input.trim();
  if (!raw) return { kind: "blocked", url: "", code: "empty" };

  if (/^(mvm|about):/i.test(raw)) {
    return { kind: "internal", url: raw };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (/^javascript:/i.test(raw) || /^data:/i.test(raw) || /^file:/i.test(raw) || /^blob:/i.test(raw)) {
      return { kind: "blocked", url: raw, code: "scheme" };
    }
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        if (isPrivateHost(u.hostname)) return { kind: "blocked", url: raw, code: "private" };
        return { kind: "url", url: u.toString() };
      } catch {
        return { kind: "search", url: "" };
      }
    }
    return { kind: "blocked", url: raw, code: "scheme" };
  }

  if (hasWhitespace(raw)) return { kind: "search", url: "" };

  const hostLike =
    /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z]{2,})(:\d{2,5})?(\/[^\s]*)?$/i;
  if (!hostLike.test(raw)) return { kind: "search", url: "" };

  const withScheme = `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (isPrivateHost(u.hostname) || ipv4Private(u.hostname)) {
      return { kind: "blocked", url: withScheme, code: "private" };
    }
    return { kind: "url", url: u.toString() };
  } catch {
    return { kind: "search", url: "" };
  }
}

export function hostnameOf(url: string): string {
  try {
    if (url.startsWith("mvm:") || url.startsWith("about:")) return url;
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function securityOf(url: string): "https" | "http" | "internal" | "unknown" {
  if (url.startsWith("mvm:") || url.startsWith("about:")) return "internal";
  if (url.startsWith("https:")) return "https";
  if (url.startsWith("http:")) return "http";
  return "unknown";
}

export function upgradeHttps(url: string): string {
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url;
}

export function applyEngine(template: string, query: string): string {
  const q = encodeURIComponent(query);
  if (template.includes("%s")) return template.replaceAll("%s", q);
  return `${template}${template.includes("?") ? "&" : "?"}q=${q}`;
}
