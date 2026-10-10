export type Locale = "en" | "ru" | "uz";
export type ThemeId = "cyan" | "redmagic" | "lime" | "ultra" | "amoled";
export type EngineId = "ddg" | "google" | "bing" | "brave" | "yandex" | "ecosia" | "startpage" | "custom";
export type ProfileId = "balanced" | "performance" | "battery";
export type Panel =
  | "menu"
  | "tabs"
  | "settings"
  | "history"
  | "bookmarks"
  | "downloads"
  | "extensions"
  | "music"
  | "gallery"
  | "about"
  | "site"
  | "qr"
  | "vault"
  | "clear"
  | "game"
  | null;

export type Tab = {
  id: string;
  url: string;
  title: string;
  incognito: boolean;
  suspended: boolean;
  loading: boolean;
  progress: number;
  group: string;
  history: string[];
  index: number;
  desktop: boolean;
  error: string;
  sid: string;
  blocked: number;
  reader: boolean;
  translate: boolean;
};

export type Settings = {
  homepage: "home" | "custom";
  homepageUrl: string;
  searchEngine: EngineId;
  customSearch: string;
  startup: "restore" | "new" | "home";
  linkTarget: "new" | "same";
  suspendBackground: boolean;
  accent: "primary" | "secondary" | "accent" | "success" | "warning";
  fontScale: number;
  scanlines: boolean;
  glow: number;
  motion: "full" | "reduced" | "off";
  addressBar: "top" | "bottom";
  dockStyle: "float" | "solid";
  iconAnim: "full" | "draw" | "off";
  wallpaper: string;
  fpsOverlay: boolean;
  overlayEdge: "left" | "right";
  overlayOpacity: number;
  miniFps: boolean;
  boostSuspend: boolean;
  keepAwake: boolean;
  autoLandscape: boolean;
  pingHost: string;
  lowLatency: boolean;
  blockLevel: "off" | "standard" | "strict";
  httpsOnly: boolean;
  doh: "off" | "cloudflare" | "google" | "quad9";
  dnt: boolean;
  gpc: boolean;
  fingerprint: boolean;
  webrtcBlock: boolean;
  cookieBanner: boolean;
  safeBrowsingKey: string;
  clearOnExit: boolean;
  appLock: boolean;
  secureIncognito: boolean;
  jamendoKey: string;
  eqPreset: "flat" | "bass" | "focus" | "hype";
  crossfade: number;
  musicAutoPause: boolean;
  sleepTimerMin: number;
  musicSource: "audius" | "jamendo" | "radio";
  downloadWifiOnly: boolean;
  parallelDownloads: number;
  downloadNotify: boolean;
  webLangs: string;
  translateOffer: boolean;
  translateLang: Locale;
  spellcheck: boolean;
  highContrast: boolean;
  haptics: number;
  forceZoom: boolean;
  dataSaver: boolean;
  autoplay: "allow" | "limit" | "block";
  xpEnabled: boolean;
  filterUrls: string;
  userCss: string;
  extDark: boolean;
  extCosmetic: boolean;
  pinSet: boolean;
};

export type Bookmark = { id: string; url: string; title: string; at: number };
export type HistoryItem = { id: string; url: string; title: string; at: number };
export type DownloadItem = {
  id: string;
  url: string;
  filename: string;
  received: number;
  total: number;
  status: "queued" | "downloading" | "paused" | "done" | "error";
  error: string;
  at: number;
  incognito: boolean;
};
export type QuickTile = { id: string; label: string; url: string };
export type VaultLogin = { id: string; origin: string; username: string; password: string };
export type VaultAddress = { id: string; label: string; lines: string };
export type VaultCard = { id: string; label: string; number: string; exp: string; name: string };
export type VaultData = { logins: VaultLogin[]; addresses: VaultAddress[]; cards: VaultCard[] };
export type StoredVault = { salt: string; iv: string; data: string; verifier: string };

export type Stats = {
  day: string;
  pages: number;
  blocked: number;
  ms: number;
  lifetimePages: number;
  lifetimeBlocked: number;
  lifetimeMs: number;
  night: boolean;
  fpsPeak: number;
  playedMusic: boolean;
  usedIncognito: boolean;
  usedBoost: boolean;
  switchedLang: boolean;
  usedReader: boolean;
};

export const VERSION = "1.0.0";
