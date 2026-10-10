import { assertPublicUrl, filterMeta, readBlocked, refreshFilterUrls } from "./filters.server.ts";
import { isPrivateHost } from "./omnibox.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const DOH: Record<string, string> = {
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/resolve",
  quad9: "https://dns.quad9.net:5053/dns-query",
};

async function audiusHost(): Promise<string> {
  try {
    const res = await fetch("https://api.audius.co", { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { data?: string[] };
    const host = data.data?.[0];
    if (host?.startsWith("https://")) return host.replace(/\/$/, "");
  } catch {
    /* fallback */
  }
  return "https://discoveryprovider.audius.co";
}

type Track = {
  id: string;
  title: string;
  artist: string;
  source: "audius" | "jamendo" | "radio";
  artwork: string;
  streamUrl: string;
  duration: number;
  pageUrl: string;
};

function mapAudius(row: Record<string, unknown>, host: string): Track | null {
  const id = String(row.id || "");
  if (!id) return null;
  const artwork = row.artwork as { "150x150"?: string; "480x480"?: string } | undefined;
  const user = row.user as { name?: string; handle?: string } | undefined;
  return {
    id: `audius:${id}`,
    title: String(row.title || "Untitled"),
    artist: String(user?.name || user?.handle || "Audius"),
    source: "audius",
    artwork: artwork?.["480x480"] || artwork?.["150x150"] || "",
    streamUrl: `${host}/v1/tracks/${id}/stream?app_name=MVMBROWSER`,
    duration: Number(row.duration || 0),
    pageUrl: String(row.permalink || ""),
  };
}

export async function handleMusic(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") || "audius";
  const q = (url.searchParams.get("q") || "").slice(0, 80);
  try {
    if (source === "radio") {
      const endpoint = new URL("https://de1.radio-browser.info/json/stations/search");
      endpoint.searchParams.set("limit", "24");
      endpoint.searchParams.set("hidebroken", "true");
      endpoint.searchParams.set("order", "votes");
      endpoint.searchParams.set("reverse", "true");
      if (q) endpoint.searchParams.set("name", q);
      const country = (url.searchParams.get("country") || "").slice(0, 40);
      if (country) endpoint.searchParams.set("country", country);
      const res = await fetch(endpoint, {
        headers: { "user-agent": "MVMBrowser/1.0", accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      const rows = (await res.json()) as {
        stationuuid?: string;
        name?: string;
        country?: string;
        tags?: string;
        url_resolved?: string;
        favicon?: string;
        homepage?: string;
        codec?: string;
      }[];
      const tracks: Track[] = (Array.isArray(rows) ? rows : [])
        .filter((row) => row.url_resolved?.startsWith("https://"))
        .slice(0, 24)
        .map((row) => ({
          id: `radio:${row.stationuuid || row.name}`,
          title: row.name || "Station",
          artist: [row.country, row.tags, row.codec].filter(Boolean).join(" · ").slice(0, 140),
          source: "radio" as const,
          artwork: row.favicon || "",
          streamUrl: row.url_resolved || "",
          duration: 0,
          pageUrl: row.homepage || "",
        }));
      return json({ tracks });
    }
    if (source === "jamendo") {
      const client = (url.searchParams.get("client") || "").trim();
      if (!/^[a-zA-Z0-9]{8,64}$/.test(client)) return json({ tracks: [], error: "jamendo_key" });
      const endpoint = new URL("https://api.jamendo.com/v3.0/tracks/");
      endpoint.searchParams.set("client_id", client);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("limit", "20");
      if (q) endpoint.searchParams.set("search", q);
      else endpoint.searchParams.set("order", "popularity_total");
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as {
        results?: { id: number; name: string; artist_name: string; audio: string; image: string; duration: number; shareurl: string }[];
      };
      const tracks: Track[] = (data.results || [])
        .filter((row) => row.audio?.startsWith("https://"))
        .map((row) => ({
          id: `jamendo:${row.id}`,
          title: row.name,
          artist: row.artist_name,
          source: "jamendo" as const,
          artwork: row.image || "",
          streamUrl: row.audio,
          duration: row.duration || 0,
          pageUrl: row.shareurl || "",
        }));
      return json({ tracks });
    }
    const host = await audiusHost();
    const path = q ? "/v1/tracks/search" : "/v1/tracks/trending";
    const endpoint = new URL(host + path);
    endpoint.searchParams.set("app_name", "MVMBROWSER");
    endpoint.searchParams.set("limit", "20");
    if (q) endpoint.searchParams.set("query", q);
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    const tracks = (data.data || []).map((row) => mapAudius(row, host)).filter((row): row is Track => !!row);
    return json({ tracks });
  } catch {
    return json({ tracks: [], error: "music_fetch" }, 200);
  }
}

export async function handleSuggest(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 80) || "";
  if (q.length < 2) return json({ suggestions: [] });
  const endpoints = [
    `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      const data = (await res.json()) as unknown;
      const list = Array.isArray(data) ? data[1] : [];
      if (Array.isArray(list)) {
        const suggestions = list.filter((item) => typeof item === "string").slice(0, 8) as string[];
        if (suggestions.length) return json({ suggestions });
      }
    } catch {
      /* try next */
    }
  }
  return json({ suggestions: [] });
}

export async function handlePing(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("bytes")) {
    const size = Math.min(256 * 1024, Math.max(1024, Number(url.searchParams.get("bytes")) || 64 * 1024));
    return new Response(new Uint8Array(size), {
      headers: { "content-type": "application/octet-stream", "cache-control": "no-store" },
    });
  }
  const sid = (url.searchParams.get("sid") || "").replace(/[^\w-]/g, "").slice(0, 40);
  const hostRaw = (url.searchParams.get("host") || "1.1.1.1").slice(0, 200);
  const doh = url.searchParams.get("doh") || "off";
  let rtt: number | null = null;
  let error: string | null = null;
  let ips: string[] = [];
  try {
    const probe = hostRaw.startsWith("http") ? new URL(hostRaw) : new URL(`https://${hostRaw}`);
    if (isPrivateHost(probe.hostname)) throw new Error("PRIVATE");
    await assertPublicUrl(probe);
    const started = performance.now();
    try {
      await fetch(probe, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000) });
      rtt = Math.round(performance.now() - started);
    } catch {
      rtt = Math.round(performance.now() - started);
      error = "unreachable";
    }
    const provider = DOH[doh];
    if (provider && !/^\d+\.\d+\.\d+\.\d+$/.test(probe.hostname)) {
      const dnsUrl = new URL(provider);
      dnsUrl.searchParams.set("name", probe.hostname);
      dnsUrl.searchParams.set("type", "A");
      const dns = await fetch(dnsUrl, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(4000),
      });
      const body = (await dns.json()) as { Answer?: { data?: string }[] };
      ips = (body.Answer || []).map((row) => row.data || "").filter(Boolean).slice(0, 6);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "PING";
  }
  return json({
    rtt,
    error,
    ips,
    source: "relay",
    blocked: sid ? readBlocked(sid) : 0,
    filters: filterMeta(),
  });
}

export async function handleAmo(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 80) || "ublock origin";
  const endpoint = new URL("https://addons.mozilla.org/api/v5/addons/search/");
  endpoint.searchParams.set("q", q);
  endpoint.searchParams.set("page_size", "12");
  endpoint.searchParams.set("type", "extension");
  endpoint.searchParams.set("app", "firefox");
  try {
    const res = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": "MVMBrowser/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      results?: {
        name?: Record<string, string> | string;
        summary?: Record<string, string> | string;
        guid?: string;
        url?: string;
        icon_url?: string;
        average_daily_users?: number;
      }[];
    };
    const text = (value: Record<string, string> | string | undefined) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      return value.en || value["en-US"] || Object.values(value)[0] || "";
    };
    const results = (data.results || []).map((row) => ({
      guid: row.guid || "",
      name: text(row.name),
      summary: text(row.summary).slice(0, 220),
      url: row.url || "",
      icon: row.icon_url || "",
      users: row.average_daily_users || 0,
    }));
    return json({ results });
  } catch {
    return json({ results: [], error: "amo" });
  }
}

export async function handleFilters(request: Request): Promise<Response> {
  if (request.method === "GET") return json(filterMeta());
  let urls: string[] = [];
  try {
    const body = (await request.json()) as { urls?: string[] };
    urls = (body.urls || []).filter((item) => typeof item === "string");
  } catch {
    return json({ error: "BAD" }, 400);
  }
  const result = await refreshFilterUrls(urls);
  return json({ ...result, ...filterMeta() });
}

const LOCAL_BAD = ["testsafebrowsing.appspot.com", "malware.testing.google.test"];

export async function handleSafe(request: Request): Promise<Response> {
  let target = "";
  let key = "";
  try {
    const body = (await request.json()) as { url?: string; key?: string };
    target = String(body.url || "");
    key = String(body.key || "");
  } catch {
    return json({ ok: false, reason: "BAD" }, 400);
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return json({ ok: false, reason: "BAD_URL" });
  }
  const host = parsed.hostname.toLowerCase();
  if (LOCAL_BAD.some((bad) => host === bad || host.endsWith(`.${bad}`))) {
    return json({ ok: false, reason: "LOCAL_LIST", remote: "skipped" });
  }
  if (parsed.username) return json({ ok: false, reason: "USERINFO" });
  if (!key) return json({ ok: true, reason: "local_only", remote: "no_key" });
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(key)) return json({ ok: true, reason: "local_only", remote: "bad_key" });
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "mvm-browser", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: parsed.toString() }],
        },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return json({ ok: true, reason: "local_only", remote: "unavailable" });
    const data = (await res.json()) as { matches?: unknown[] };
    if (data.matches?.length) return json({ ok: false, reason: "SAFE_BROWSING", remote: "match" });
    return json({ ok: true, reason: "clean", remote: "clean" });
  } catch {
    return json({ ok: true, reason: "local_only", remote: "unavailable" });
  }
}
