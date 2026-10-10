import { previewPathPrefix } from "@/lib/preview-path-prefix";
import type { Settings } from "./types.ts";

export function apiPath(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
  return `${prefix}${path}`;
}

export function browseHref(
  settings: Settings,
  target: string,
  extra: { sid: string; desktop: boolean; mode?: "reader" | "translate"; download?: boolean; document?: boolean },
): string {
  const p = new URLSearchParams();
  p.set("url", target);
  p.set("block", settings.blockLevel);
  p.set("dnt", settings.dnt ? "1" : "0");
  p.set("gpc", settings.gpc ? "1" : "0");
  p.set("ua", extra.desktop ? "desktop" : "mobile");
  p.set("sid", extra.sid);
  p.set("fp", settings.fingerprint ? "1" : "0");
  p.set("rtc", settings.webrtcBlock ? "1" : "0");
  p.set("autoplay", settings.autoplay);
  p.set("banner", settings.cookieBanner ? "1" : "0");
  p.set("dark", settings.extDark ? "1" : "0");
  p.set("cosmetic", settings.extCosmetic && settings.blockLevel !== "off" ? "1" : "0");
  p.set("lang", settings.webLangs || "en");
  p.set("data", settings.dataSaver ? "1" : "0");
  if (extra.mode) p.set("mode", extra.mode);
  if (extra.mode === "translate") p.set("to", settings.translateLang);
  if (extra.download) p.set("download", "1");
  if (extra.document) p.set("dest", "document");
  return `${apiPath("/api/browse")}?${p.toString()}`;
}
