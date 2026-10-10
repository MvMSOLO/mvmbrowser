import type {
  Bookmark,
  DownloadItem,
  HistoryItem,
  Locale,
  QuickTile,
  Settings,
  Stats,
  StoredVault,
  Tab,
  ThemeId,
} from "./types.ts";

export const STORAGE_KEY = "mvm.v1";

export const PRESETS: QuickTile[] = [
  { id: "gfn", label: "GeForce NOW", url: "https://play.geforcenow.com" },
  { id: "xbox", label: "Xbox Cloud", url: "https://www.xbox.com/play" },
  { id: "steam", label: "Steam", url: "https://store.steampowered.com" },
  { id: "twitch", label: "Twitch", url: "https://www.twitch.tv" },
  { id: "discord", label: "Discord", url: "https://discord.com/app" },
  { id: "youtube", label: "YouTube", url: "https://www.youtube.com" },
  { id: "epic", label: "Epic Games", url: "https://store.epicgames.com" },
  { id: "itch", label: "itch.io", url: "https://itch.io" },
  { id: "crazy", label: "CrazyGames", url: "https://www.crazygames.com" },
  { id: "poki", label: "Poki", url: "https://poki.com" },
  { id: "reddit", label: "Reddit", url: "https://www.reddit.com" },
  { id: "x", label: "X", url: "https://x.com" },
];

export function defaultSettings(): Settings {
  return {
    homepage: "home",
    homepageUrl: "https://html.duckduckgo.com/html/",
    searchEngine: "ddg",
    customSearch: "https://html.duckduckgo.com/html/?q=%s",
    startup: "restore",
    linkTarget: "new",
    suspendBackground: true,
    accent: "primary",
    fontScale: 1,
    scanlines: true,
    glow: 70,
    motion: "full",
    addressBar: "top",
    dockStyle: "float",
    iconAnim: "full",
    wallpaper: "",
    fpsOverlay: false,
    overlayEdge: "left",
    overlayOpacity: 92,
    miniFps: false,
    boostSuspend: true,
    keepAwake: false,
    autoLandscape: false,
    pingHost: "1.1.1.1",
    lowLatency: false,
    blockLevel: "standard",
    httpsOnly: true,
    doh: "cloudflare",
    dnt: true,
    gpc: true,
    fingerprint: false,
    webrtcBlock: false,
    cookieBanner: true,
    safeBrowsingKey: "",
    clearOnExit: false,
    appLock: false,
    secureIncognito: true,
    jamendoKey: "",
    eqPreset: "flat",
    crossfade: 0,
    musicAutoPause: true,
    sleepTimerMin: 0,
    musicSource: "audius",
    downloadWifiOnly: false,
    parallelDownloads: 2,
    downloadNotify: true,
    webLangs: "en",
    translateOffer: true,
    translateLang: "en",
    spellcheck: true,
    highContrast: false,
    haptics: 1,
    forceZoom: true,
    dataSaver: false,
    autoplay: "limit",
    xpEnabled: true,
    filterUrls: "",
    userCss: "",
    extDark: false,
    extCosmetic: true,
    pinSet: false,
  };
}

export type Persisted = {
  locale: Locale | null;
  theme: ThemeId;
  settings: Settings;
  tabs: Tab[];
  activeId: string;
  bookmarks: Bookmark[];
  history: HistoryItem[];
  downloads: DownloadItem[];
  quick: QuickTile[];
  profiles: Record<string, "balanced" | "performance" | "battery">;
  xp: number;
  achievements: string[];
  stats: Stats;
  vault: StoredVault | null;
  miniPos: { x: number; y: number };
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function emptyStats(): Stats {
  return {
    day: todayKey(),
    pages: 0,
    blocked: 0,
    ms: 0,
    lifetimePages: 0,
    lifetimeBlocked: 0,
    lifetimeMs: 0,
    night: false,
    fpsPeak: 0,
    playedMusic: false,
    usedIncognito: false,
    usedBoost: false,
    switchedLang: false,
    usedReader: false,
  };
}

export function loadPersisted(): Persisted | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (!data || typeof data !== "object" || !data.settings) return null;
    return {
      ...data,
      settings: { ...defaultSettings(), ...data.settings },
      stats: { ...emptyStats(), ...data.stats },
      quick: data.quick?.length ? data.quick : PRESETS,
    };
  } catch {
    return null;
  }
}

export function savePersisted(data: Persisted): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota: drop wallpaper and retry once */
    try {
      const clone = { ...data, settings: { ...data.settings, wallpaper: "" } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
    } catch {
      /* ignore */
    }
  }
}
