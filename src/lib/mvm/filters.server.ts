import { lookup } from "node:dns/promises";
import { isPrivateHost, isPrivateIp } from "./omnibox.ts";

const DENY_PORTS = new Set([
  "22", "23", "25", "110", "143", "445", "3306", "5432", "6379", "11211", "27017", "9200", "2375",
]);

const g = globalThis as typeof globalThis & {
  __mvmExtraHosts?: Set<string>;
  __mvmFilterAt?: number;
  __mvmSids?: Map<string, { n: number; t: number }>;
};

function sids(): Map<string, { n: number; t: number }> {
  g.__mvmSids ??= new Map();
  return g.__mvmSids;
}

export function extraHosts(): Set<string> {
  g.__mvmExtraHosts ??= new Set();
  return g.__mvmExtraHosts;
}

export function filterMeta(): { count: number; at: number } {
  return { count: extraHosts().size, at: g.__mvmFilterAt ?? 0 };
}

export function bumpBlocked(sid: string): void {
  if (!sid) return;
  const now = Date.now();
  const map = sids();
  if (map.size > 400) {
    for (const [k, v] of map) if (now - v.t > 5 * 60_000) map.delete(k);
  }
  const row = map.get(sid) ?? { n: 0, t: now };
  row.n += 1;
  row.t = now;
  map.set(sid, row);
}

export function readBlocked(sid: string): number {
  return sids().get(sid)?.n ?? 0;
}

export async function assertPublicUrl(target: URL): Promise<void> {
  if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("SCHEME");
  if (target.username || target.password) throw new Error("BAD_URL");
  const host = target.hostname.replace(/^\[|\]$/g, "");
  if (!host || /^\d+$/.test(host)) throw new Error("PRIVATE");
  if (!host.includes(".") && !host.includes(":")) throw new Error("PRIVATE");
  if (isPrivateHost(host) || isPrivateIp(host)) throw new Error("PRIVATE");
  if (target.port && DENY_PORTS.has(target.port)) throw new Error("PORT");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return;
  let records: { address: string }[] = [];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("DNS");
  }
  if (!records.length) throw new Error("DNS");
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error("PRIVATE");
  }
}

function parseHosts(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const parts = trimmed.split(/\s+/);
    const host = (parts.length > 1 ? parts[1] : parts[0] ?? "").replace(/\.$/, "").toLowerCase();
    if (!/^[a-z0-9.-]{3,253}$/.test(host) || !host.includes(".")) continue;
    if (isPrivateHost(host)) continue;
    out.push(host);
    if (out.length >= 8000) break;
  }
  return out;
}

/** Fetch public host lists into memory. Caller passes already-validated https URLs. */
export async function refreshFilterUrls(urls: string[]): Promise<{ added: number; errors: string[] }> {
  const next = new Set<string>();
  const errors: string[] = [];
  for (const raw of urls.slice(0, 5)) {
    let target: URL;
    try {
      target = new URL(raw);
      await assertPublicUrl(target);
      if (target.protocol !== "https:") throw new Error("SCHEME");
    } catch {
      errors.push(raw.slice(0, 80));
      continue;
    }
    try {
      const res = await fetch(target, {
        headers: { accept: "text/plain", "user-agent": "MVMBrowser/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        errors.push(target.hostname);
        continue;
      }
      const text = (await res.text()).slice(0, 1_500_000);
      for (const host of parseHosts(text)) next.add(host);
    } catch {
      errors.push(target.hostname);
    }
  }
  g.__mvmExtraHosts = next;
  g.__mvmFilterAt = Date.now();
  return { added: next.size, errors };
}
