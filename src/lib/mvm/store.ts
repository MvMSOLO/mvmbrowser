import { create } from "zustand";
import { apiPath } from "./api.ts";
import { engineTemplate } from "./engines.ts";
import { applyEngine, detectQuery, hostnameOf, upgradeHttps } from "./omnibox.ts";
import {
  defaultSettings,
  emptyStats,
  loadPersisted,
  PRESETS,
  savePersisted,
  todayKey,
  type Persisted,
} from "./storage.ts";
import type {
  Bookmark,
  DownloadItem,
  HistoryItem,
  Locale,
  Panel,
  ProfileId,
  QuickTile,
  Settings,
  Stats,
  StoredVault,
  Tab,
  ThemeId,
} from "./types.ts";

export type Suggestion = { label: string; kind: "search" | "history" | "bookmark" | "url"; url?: string };

const BOOT: Tab = {
  id: "boot",
  url: "mvm://home",
  title: "",
  incognito: false,
  suspended: false,
  loading: false,
  progress: 0,
  group: "",
  history: ["mvm://home"],
  index: 0,
  desktop: false,
  error: "",
  sid: "boot",
  blocked: 0,
  reader: false,
  translate: false,
};

export function makeTab(incognito: boolean, url = "mvm://home"): Tab {
  const id = crypto.randomUUID();
  return { ...BOOT, id, url, incognito, history: [url], sid: id.replace(/-/g, "").slice(0, 10) };
}

function rollStats(stats: Stats): Stats {
  if (stats.day === todayKey()) return stats;
  return { ...stats, day: todayKey(), pages: 0, blocked: 0, ms: 0 };
}

type State = {
  ready: boolean;
  locale: Locale;
  theme: ThemeId;
  settings: Settings;
  tabs: Tab[];
  incognitoTabs: Tab[];
  mode: "normal" | "incognito";
  activeId: string;
  incognitoActiveId: string;
  panel: Panel;
  overlay: boolean;
  dockHidden: boolean;
  collapsed: boolean;
  findOpen: boolean;
  link: { href: string; text: string } | null;
  drafts: Record<string, string>;
  bookmarks: Bookmark[];
  history: HistoryItem[];
  downloads: DownloadItem[];
  quick: QuickTile[];
  profiles: Record<string, ProfileId>;
  xp: number;
  achievements: string[];
  stats: Stats;
  toast: string;
  locked: boolean;
  vault: StoredVault | null;
  webauthnId: string;
  editQuick: boolean;
  miniPos: { x: number; y: number };
  session: { t: number; fps: number }[];
  brightness: number;
  glitch: boolean;
  incogSeen: boolean;
};

type Actions = {
  hydrate: () => void;
  persist: () => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeId) => void;
  patch: (partial: Partial<Settings>) => void;
  setPanel: (panel: Panel) => void;
  setOverlay: (open: boolean) => void;
  setDockHidden: (hidden: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  setFind: (open: boolean) => void;
  setLink: (link: State["link"]) => void;
  setDraft: (id: string, value: string) => void;
  setMode: (mode: State["mode"]) => void;
  navigate: (input: string, opts?: { newTab?: boolean; background?: boolean; incognito?: boolean; replace?: boolean }) => void;
  setTab: (id: string, partial: Partial<Tab>) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  newTab: (incognito?: boolean) => void;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  closeAll: (incognito: boolean) => void;
  setGroup: (id: string, group: string) => void;
  toggleBookmark: () => void;
  removeBookmark: (id: string) => void;
  clearHistory: () => void;
  upsertDownload: (item: DownloadItem) => void;
  removeDownload: (id: string) => void;
  setQuick: (quick: QuickTile[]) => void;
  setProfile: (host: string, profile: ProfileId) => void;
  addBlocked: (id: string, count: number) => void;
  tickTime: (ms: number) => void;
  noteFps: (fps: number) => void;
  mark: (key: keyof Pick<Stats, "playedMusic" | "usedIncognito" | "usedBoost" | "switchedLang" | "usedReader" | "night">) => void;
  boost: () => number;
  clearParts: (parts: { history?: boolean; bookmarks?: boolean; downloads?: boolean; vault?: boolean }) => void;
  setMiniPos: (pos: { x: number; y: number }) => void;
  pushSession: (fps: number) => void;
  setBrightness: (n: number) => void;
  setLocked: (locked: boolean) => void;
  setVault: (vault: StoredVault | null) => void;
  setWebauthn: (id: string) => void;
  setEditQuick: (on: boolean) => void;
  setToast: (toast: string) => void;
  setIncogSeen: (seen: boolean) => void;
  importPersisted: (data: Persisted) => void;
};

export type MvmState = State & Actions;

function lists(state: State): { key: "tabs" | "incognitoTabs"; active: "activeId" | "incognitoActiveId" } {
  if (state.mode === "incognito") return { key: "incognitoTabs", active: "incognitoActiveId" };
  return { key: "tabs", active: "activeId" };
}

export function currentTab(state: State): Tab {
  const { key, active } = lists(state);
  const list = state[key];
  return list.find((tab) => tab.id === state[active]) ?? list[0] ?? BOOT;
}

export function levelFromXp(xp: number): { level: number; pct: number } {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 8)) + 1);
  const start = (level - 1) ** 2 * 8;
  const end = level ** 2 * 8;
  return { level, pct: end === start ? 0 : Math.min(1, (xp - start) / (end - start)) };
}

function award(state: State): Pick<State, "xp" | "achievements" | "toast"> {
  if (!state.settings.xpEnabled) return { xp: state.xp, achievements: state.achievements, toast: state.toast };
  const tests: Record<string, boolean> = {
    "first-page": state.stats.lifetimePages >= 1,
    "trackers-100": state.stats.lifetimeBlocked >= 100,
    "night-owl": state.stats.night,
    "fps-master": state.stats.fpsPeak >= 100,
    music: state.stats.playedMusic,
    incognito: state.stats.usedIncognito,
    boost: state.stats.usedBoost,
    bookmark: state.bookmarks.length >= 1,
    polyglot: state.stats.switchedLang,
    reader: state.stats.usedReader,
  };
  const achievements = [...state.achievements];
  let xp = state.xp;
  let toast = "";
  for (const [id, ok] of Object.entries(tests)) {
    if (ok && !achievements.includes(id)) {
      achievements.push(id);
      xp += 25;
      toast = id;
    }
  }
  return { xp, achievements, toast: toast || state.toast };
}

function snapshot(state: State): Persisted {
  return {
    locale: state.locale,
    theme: state.theme,
    settings: state.settings,
    tabs: state.tabs.map((tab) => ({ ...tab, loading: false, progress: 0 })),
    activeId: state.activeId,
    bookmarks: state.bookmarks,
    history: state.history,
    downloads: state.downloads
      .filter((item) => !item.incognito)
      .map((item) => (item.status === "downloading" ? { ...item, status: "paused" as const } : item)),
    quick: state.quick,
    profiles: state.profiles,
    xp: state.xp,
    achievements: state.achievements,
    stats: state.stats,
    vault: state.vault,
    miniPos: state.miniPos,
  };
}

function resolveInput(state: State, input: string): { url: string; error: string } {
  const detected = detectQuery(input);
  if (detected.kind === "blocked") return { url: detected.url, error: detected.code || "scheme" };
  if (detected.kind === "internal" || detected.kind === "url") {
    let url = detected.url;
    if (state.settings.httpsOnly && detected.kind === "url") url = upgradeHttps(url);
    return { url, error: "" };
  }
  const lang = state.settings.webLangs.split(",")[0] || state.locale;
  const template = engineTemplate(state.settings.searchEngine, state.settings.customSearch, lang);
  return { url: applyEngine(template, input.trim()), error: "" };
}

export const useMvm = create<MvmState>((set, get) => ({
  ready: false,
  locale: "en",
  theme: "cyan",
  settings: defaultSettings(),
  tabs: [BOOT],
  incognitoTabs: [],
  mode: "normal",
  activeId: "boot",
  incognitoActiveId: "",
  panel: null,
  overlay: false,
  dockHidden: false,
  collapsed: false,
  findOpen: false,
  link: null,
  drafts: {},
  bookmarks: [],
  history: [],
  downloads: [],
  quick: PRESETS,
  profiles: {},
  xp: 0,
  achievements: [],
  stats: emptyStats(),
  toast: "",
  locked: false,
  vault: null,
  webauthnId: "",
  editQuick: false,
  miniPos: { x: 16, y: 120 },
  session: [],
  brightness: 1,
  glitch: false,
  incogSeen: false,

  hydrate: () => {
    const saved = loadPersisted();
    const settings = saved?.settings ?? defaultSettings();
    let tabs = saved?.tabs?.length ? saved.tabs : [makeTab(false)];
    if (settings.startup === "home") tabs = [makeTab(false, "mvm://home")];
    if (settings.startup === "new") tabs = [makeTab(false, "mvm://home")];
    const activeId = tabs.some((tab) => tab.id === saved?.activeId) ? (saved?.activeId as string) : tabs[0].id;
    const hour = new Date().getHours();
    set({
      ready: true,
      locale: saved?.locale ?? "en",
      theme: saved?.theme ?? "cyan",
      settings,
      tabs,
      activeId,
      bookmarks: saved?.bookmarks ?? [],
      history: saved?.history ?? [],
      downloads: saved?.downloads ?? [],
      quick: saved?.quick ?? PRESETS,
      profiles: saved?.profiles ?? {},
      xp: saved?.xp ?? 0,
      achievements: saved?.achievements ?? [],
      stats: rollStats(saved?.stats ?? emptyStats()),
      vault: saved?.vault ?? null,
      miniPos: saved?.miniPos ?? { x: 16, y: 120 },
      locked: !!settings.appLock && !!saved?.vault,
      webauthnId: localStorage.getItem("mvm.webauthn") || "",
    });
    if (hour < 5) get().mark("night");
    document.documentElement.lang = get().locale;
    document.documentElement.dataset.theme = get().theme;
    document.documentElement.dataset.motion = settings.motion;
    document.documentElement.dataset.contrast = settings.highContrast ? "1" : "0";
    document.documentElement.dataset.icons = settings.iconAnim;
    document.documentElement.style.setProperty("--mvm-font-scale", String(settings.fontScale));
  },

  persist: () => savePersisted(snapshot(get())),

  setLocale: (locale) => {
    set((state) => ({ locale, stats: { ...state.stats, switchedLang: true }, ...award({ ...state, stats: { ...state.stats, switchedLang: true } }) }));
    document.documentElement.lang = locale;
    get().persist();
  },

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.dataset.theme = theme;
    get().persist();
  },

  patch: (partial) => {
    const settings = { ...get().settings, ...partial };
    set({ settings });
    document.documentElement.dataset.motion = settings.motion;
    document.documentElement.dataset.contrast = settings.highContrast ? "1" : "0";
    document.documentElement.dataset.icons = settings.iconAnim;
    document.documentElement.style.setProperty("--mvm-font-scale", String(settings.fontScale));
    get().persist();
  },

  setPanel: (panel) => set({ panel }),
  setOverlay: (overlay) => set({ overlay, dockHidden: false }),
  setDockHidden: (dockHidden) => set({ dockHidden }),
  setCollapsed: (collapsed) => set({ collapsed }),
  setFind: (findOpen) => set({ findOpen }),
  setLink: (link) => set({ link }),
  setDraft: (id, value) => set((state) => ({ drafts: { ...state.drafts, [id]: value } })),
  setEditQuick: (editQuick) => set({ editQuick }),
  setToast: (toast) => set({ toast }),
  setIncogSeen: (incogSeen) => set({ incogSeen }),
  setBrightness: (brightness) => set({ brightness }),
  setLocked: (locked) => set({ locked }),
  setVault: (vault) => {
    set({ vault, settings: { ...get().settings, pinSet: !!vault } });
    get().persist();
  },
  setWebauthn: (webauthnId) => {
    set({ webauthnId });
    if (webauthnId) localStorage.setItem("mvm.webauthn", webauthnId);
    else localStorage.removeItem("mvm.webauthn");
  },
  setMiniPos: (miniPos) => {
    set({ miniPos });
    get().persist();
  },

  setMode: (mode) => {
    const state = get();
    if (mode === "incognito" && state.incognitoTabs.length === 0) {
      const tab = makeTab(true);
      set({
        mode,
        incognitoTabs: [tab],
        incognitoActiveId: tab.id,
        glitch: true,
        stats: { ...state.stats, usedIncognito: true },
        panel: null,
        ...award({ ...state, stats: { ...state.stats, usedIncognito: true } }),
      });
    } else {
      set({ mode, glitch: mode === "incognito", panel: null });
    }
    window.setTimeout(() => set({ glitch: false }), 180);
  },

  navigate: (input, opts) => {
    const state = get();
    const incognito = opts?.incognito ?? state.mode === "incognito";
    const { url, error } = resolveInput(state, input);
    const host = hostnameOf(url);
    const profile = state.profiles[host];
    const desktop = profile === "performance";
    if (opts?.newTab || opts?.background) {
      const tab = { ...makeTab(incognito, url), error, desktop, loading: !error && !url.startsWith("mvm:") && !url.startsWith("about:") };
      const key = incognito ? "incognitoTabs" : "tabs";
      const activeKey = incognito ? "incognitoActiveId" : "activeId";
      const list = [...state[key], tab];
      const stats = error || url.startsWith("mvm:") ? state.stats : {
        ...state.stats,
        pages: state.stats.pages + (incognito ? 0 : 1),
        lifetimePages: state.stats.lifetimePages + (incognito ? 0 : 1),
      };
      const history = !incognito && !error && !url.startsWith("mvm:")
        ? [{ id: crypto.randomUUID(), url, title: url, at: Date.now() }, ...state.history].slice(0, 400)
        : state.history;
      set({
        [key]: list,
        [activeKey]: opts?.background ? state[activeKey] : tab.id,
        mode: incognito ? "incognito" : state.mode,
        panel: null,
        collapsed: false,
        stats,
        history,
        ...award({ ...state, stats, history }),
      });
      if (!incognito) get().persist();
    return;
    }
    const { key, active } = incognito
      ? { key: "incognitoTabs" as const, active: "incognitoActiveId" as const }
      : { key: "tabs" as const, active: "activeId" as const };
    const list = state[key].length ? state[key] : [makeTab(incognito)];
    const id = state[active] || list[0].id;
    const next = list.map((tab) => {
      if (tab.id !== id) return state.settings.suspendBackground ? { ...tab, suspended: true } : tab;
      const history = tab.history.slice(0, tab.index + 1);
      const stack = opts?.replace ? [...history.slice(0, -1), url] : [...history, url];
      return {
        ...tab,
        url,
        error,
        desktop: desktop || tab.desktop,
        suspended: false,
        loading: !error && !url.startsWith("mvm:") && !url.startsWith("about:"),
        progress: 8,
        history: stack,
        index: stack.length - 1,
        reader: false,
        translate: false,
        title: url.startsWith("mvm:") ? "" : tab.title,
      };
    });
    const internal = url.startsWith("mvm:") || url.startsWith("about:");
    const stats = error || internal || incognito ? state.stats : {
      ...state.stats,
      pages: state.stats.pages + 1,
      lifetimePages: state.stats.lifetimePages + 1,
    };
    const history = !incognito && !error && !internal
      ? [{ id: crypto.randomUUID(), url, title: url, at: Date.now() }, ...state.history].slice(0, 400)
      : state.history;
    set({ [key]: next, [active]: id, mode: incognito ? "incognito" : "normal", panel: null, collapsed: false, stats, history, ...award({ ...state, stats }) });
    if (!incognito) get().persist();
    if (state.settings.safeBrowsingKey && !internal && !error) {
      const tabId = id;
      void checkSafe(url, state.settings.safeBrowsingKey)
        .then((ok) => {
          if (!ok) get().setTab(tabId, { error: "SAFE", loading: false });
        })
        .catch(() => undefined);
    }
  },

  setTab: (id, partial) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...partial } : tab)),
      incognitoTabs: state.incognitoTabs.map((tab) => (tab.id === id ? { ...tab, ...partial } : tab)),
    }));
  },

  back: () => shift(get, set, -1),
  forward: () => shift(get, set, 1),

  reload: () => {
    const tab = currentTab(get());
    get().setTab(tab.id, { loading: true, progress: 10, error: "", sid: crypto.randomUUID().slice(0, 10) });
  },

  newTab: (incognito) => {
    const mode = incognito ? "incognito" : get().mode;
    const tab = makeTab(!!incognito);
    if (incognito) {
      set((state) => ({ mode: "incognito", incognitoTabs: [...state.incognitoTabs, tab], incognitoActiveId: tab.id, panel: null, glitch: true, stats: { ...state.stats, usedIncognito: true } }));
      window.setTimeout(() => set({ glitch: false }), 180);
      get().mark("usedIncognito");
      return;
    }
    if (mode === "incognito") {
      set((state) => ({ incognitoTabs: [...state.incognitoTabs, tab], incognitoActiveId: tab.id, panel: null }));
      return;
    }
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id, panel: null }));
    get().persist();
  },

  closeTab: (id) => {
    const state = get();
    const closeList = (list: Tab[], active: string) => {
      const next = list.filter((tab) => tab.id !== id);
      const fallback = next[0]?.id ?? "";
      return { next, active: active === id ? fallback : active };
    };
    if (state.incognitoTabs.some((tab) => tab.id === id)) {
      const { next, active } = closeList(state.incognitoTabs, state.incognitoActiveId);
      set({ incognitoTabs: next, incognitoActiveId: active, mode: next.length ? state.mode : "normal" });
      return;
    }
    const { next, active } = closeList(state.tabs, state.activeId);
    const tabs = next.length ? next : [makeTab(false)];
    set({ tabs, activeId: active || tabs[0].id });
    get().persist();
  },

  activate: (id) => {
    const state = get();
    if (state.incognitoTabs.some((tab) => tab.id === id)) {
      set({
        mode: "incognito",
        incognitoActiveId: id,
        panel: null,
        incognitoTabs: state.incognitoTabs.map((tab) => ({ ...tab, suspended: tab.id !== id && state.settings.suspendBackground })),
      });
      return;
    }
    set({
      mode: "normal",
      activeId: id,
      panel: null,
      tabs: state.tabs.map((tab) => ({ ...tab, suspended: tab.id !== id && state.settings.suspendBackground ? true : tab.id === id ? false : tab.suspended })),
    });
  },

  closeAll: (incognito) => {
    if (incognito) {
      set({ incognitoTabs: [], incognitoActiveId: "", mode: "normal", panel: null });
      return;
    }
    const tab = makeTab(false);
    set({ tabs: [tab], activeId: tab.id, panel: null });
    get().persist();
  },

  setGroup: (id, group) => {
    get().setTab(id, { group });
    get().persist();
  },

  toggleBookmark: () => {
    const state = get();
    const tab = currentTab(state);
    if (tab.url.startsWith("mvm:")) return;
    const existing = state.bookmarks.find((item) => item.url === tab.url);
    const bookmarks = existing
      ? state.bookmarks.filter((item) => item.id !== existing.id)
      : [{ id: crypto.randomUUID(), url: tab.url, title: tab.title || tab.url, at: Date.now() }, ...state.bookmarks].slice(0, 300);
    const next = { ...state, bookmarks };
    set({ bookmarks, ...award(next) });
    get().persist();
  },

  removeBookmark: (id) => {
    set((state) => ({ bookmarks: state.bookmarks.filter((item) => item.id !== id) }));
    get().persist();
  },

  clearHistory: () => {
    set({ history: [] });
    get().persist();
  },

  upsertDownload: (item) => {
    set((state) => {
      const rest = state.downloads.filter((row) => row.id !== item.id);
      return { downloads: [item, ...rest].slice(0, 80) };
    });
    if (!item.incognito && (item.status === "done" || item.status === "error" || item.status === "paused")) get().persist();
  },

  removeDownload: (id) => {
    set((state) => ({ downloads: state.downloads.filter((item) => item.id !== id) }));
    get().persist();
  },

  setQuick: (quick) => {
    set({ quick });
    get().persist();
  },

  setProfile: (host, profile) => {
    set((state) => ({ profiles: { ...state.profiles, [host]: profile } }));
    get().persist();
  },

  addBlocked: (id, count) => {
    const state = get();
    const tab = [...state.tabs, ...state.incognitoTabs].find((item) => item.id === id);
    if (!tab) return;
    const delta = Math.max(0, count - tab.blocked);
    get().setTab(id, { blocked: count });
    if (!delta || tab.incognito) return;
    const stats = {
      ...state.stats,
      blocked: state.stats.blocked + delta,
      lifetimeBlocked: state.stats.lifetimeBlocked + delta,
    };
    set({ stats, ...award({ ...state, stats }) });
    get().persist();
  },

  tickTime: (ms) => {
    const state = get();
    if (state.mode === "incognito") return;
    const hour = new Date().getHours();
    const stats = {
      ...state.stats,
      ms: state.stats.ms + ms,
      lifetimeMs: state.stats.lifetimeMs + ms,
      night: state.stats.night || hour < 5,
    };
    set({ stats, ...award({ ...state, stats }) });
  },

  noteFps: (fps) => {
    const state = get();
    if (fps <= state.stats.fpsPeak) return;
    const stats = { ...state.stats, fpsPeak: fps };
    set({ stats, ...award({ ...state, stats }) });
  },

  mark: (key) => {
    const state = get();
    if (state.stats[key]) return;
    const stats = { ...state.stats, [key]: true };
    set({ stats, ...award({ ...state, stats }) });
    get().persist();
  },

  boost: () => {
    const state = get();
    const tab = currentTab(state);
    const { key } = lists(state);
    let freed = 0;
    const next = state[key].map((item) => {
      if (item.id === tab.id) return { ...item, suspended: false };
      if (!item.suspended) freed += 1;
      return { ...item, suspended: true };
    });
    const stats = { ...state.stats, usedBoost: true };
    set({ [key]: next, stats, ...award({ ...state, stats }) });
    return freed;
  },

  clearParts: (parts) => {
    set((state) => ({
      history: parts.history ? [] : state.history,
      bookmarks: parts.bookmarks ? [] : state.bookmarks,
      downloads: parts.downloads ? [] : state.downloads,
      vault: parts.vault ? null : state.vault,
      settings: parts.vault ? { ...state.settings, pinSet: false } : state.settings,
    }));
    get().persist();
  },

  pushSession: (fps) => {
    set((state) => ({ session: [...state.session, { t: Date.now(), fps }].slice(-120) }));
  },

  importPersisted: (data) => {
    set({
      locale: data.locale ?? get().locale,
      theme: data.theme,
      settings: { ...defaultSettings(), ...data.settings },
      tabs: data.tabs.length ? data.tabs : [makeTab(false)],
      activeId: data.activeId,
      bookmarks: data.bookmarks,
      history: data.history,
      downloads: data.downloads,
      quick: data.quick,
      profiles: data.profiles,
      xp: data.xp,
      achievements: data.achievements,
      stats: data.stats,
      vault: data.vault,
      miniPos: data.miniPos,
    });
    get().persist();
  },
}));

function shift(get: () => MvmState, set: (partial: Partial<MvmState>) => void, delta: number) {
  const state = get();
  const { key, active } = lists(state);
  const id = state[active];
  const next = state[key].map((tab) => {
    if (tab.id !== id) return tab;
    const index = Math.min(tab.history.length - 1, Math.max(0, tab.index + delta));
    const url = tab.history[index] ?? tab.url;
    return {
      ...tab,
      index,
      url,
      error: "",
      loading: !url.startsWith("mvm:"),
      progress: 12,
      suspended: false,
    };
  });
  set({ [key]: next, collapsed: false } as Partial<MvmState>);
}

export function suggestionsFor(state: State, query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const detected = detectQuery(query);
  const out: Suggestion[] = [];
  for (const item of state.bookmarks) {
    if (item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)) {
      out.push({ label: item.title || item.url, kind: "bookmark", url: item.url });
    }
    if (out.length >= 3) break;
  }
  for (const item of state.history) {
    if (item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)) {
      out.push({ label: item.title || item.url, kind: "history", url: item.url });
    }
    if (out.filter((row) => row.kind === "history").length >= 3) break;
  }
  if (detected.kind === "url") out.unshift({ label: detected.url, kind: "url", url: detected.url });
  return out.slice(0, 8);
}

export async function checkSafe(url: string, key: string): Promise<boolean> {
  const res = await fetch(apiPath("/api/safe"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, key }),
  });
  const body = (await res.json()) as { ok?: boolean };
  return body.ok !== false;
}
