import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bookmark, CircleHelp, Download, ExternalLink,
  Globe2, History, Home, Layers3, LockKeyhole, Menu, Plus, RefreshCw, Search,
  Settings2, ShieldCheck, Sparkles, Trash2, UserRound, X, Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { browseHref } from "@/lib/mvm/api";
import { currentTab, useMvm } from "@/lib/mvm/store";
import type { Panel, ThemeId } from "@/lib/mvm/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type FrameMessage = {
  source?: string; kind?: string; pageUrl?: string; title?: string; code?: string;
  href?: string; action?: string; fields?: [string, string][]; count?: number;
};
const NAV_ITEMS: { id: Exclude<Panel, null>; label: string; icon: typeof Home }[] = [
  { id: "tabs", label: "Tabs", icon: Layers3 },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "history", label: "History", icon: History },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const THEMES: { id: ThemeId; label: string }[] = [
  { id: "cyan", label: "Signal cyan" }, { id: "redmagic", label: "Crimson" },
  { id: "lime", label: "Ion lime" }, { id: "ultra", label: "Ultra violet" }, { id: "amoled", label: "Pure AMOLED" },
];

export function BrowserRoot() {
  const ready = useMvm((s) => s.ready);
  const hydrate = useMvm((s) => s.hydrate);
  const mode = useMvm((s) => s.mode);
  const tabs = useMvm((s) => s.mode === "incognito" ? s.incognitoTabs : s.tabs);
  const tab = useMvm(currentTab);
  const panel = useMvm((s) => s.panel);
  const settings = useMvm((s) => s.settings);
  const bookmarks = useMvm((s) => s.bookmarks);
  const navigate = useMvm((s) => s.navigate);
  const back = useMvm((s) => s.back);
  const forward = useMvm((s) => s.forward);
  const reload = useMvm((s) => s.reload);
  const newTab = useMvm((s) => s.newTab);
  const closeTab = useMvm((s) => s.closeTab);
  const activate = useMvm((s) => s.activate);
  const setTab = useMvm((s) => s.setTab);
  const toggleBookmark = useMvm((s) => s.toggleBookmark);
  const setPanel = useMvm((s) => s.setPanel);
  const [address, setAddress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => { if (!ready) hydrate(); }, [ready, hydrate]);
  useEffect(() => { setAddress(tab.url.startsWith("mvm://") ? "" : tab.url); }, [tab.id, tab.url]);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onMessage = (event: MessageEvent<FrameMessage>) => {
      if (event.source !== frame.contentWindow) return;
      if (event.origin !== "null" && event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== "mvm") return;
      if (message.kind === "load") {
        setTab(tab.id, { title: message.title || message.pageUrl || tab.url, loading: false, progress: 100, error: "" });
      } else if (message.kind === "error") {
        setTab(tab.id, { error: message.code || "PAGE", loading: false, progress: 100 });
      } else if (message.kind === "open" && message.href) {
        navigate(message.href, { newTab: true });
      } else if (message.kind === "form" && message.action && Array.isArray(message.fields)) {
        try {
          const target = new URL(message.action);
          for (const pair of message.fields) {
            if (Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") target.searchParams.append(pair[0], pair[1]);
          }
          navigate(target.toString());
        } catch { setTab(tab.id, { error: "FORM", loading: false }); }
      } else if (message.kind === "blocked" && typeof message.count === "number") {
        useMvm.getState().addBlocked(tab.id, message.count);
      } else if (message.kind === "pull") {
        reload();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tab.id, tab.url, navigate, reload, setTab]);
  useEffect(() => { document.title = tab.title ? tab.title + " — MVM Browser" : "MVM Browser"; }, [tab.title]);

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;
    navigate(address.trim());
    setPanel(null);
  }
  function goHome() { navigate("mvm://home"); setPanel(null); }
  const isHome = tab.url === "mvm://home";
  const internal = tab.url.startsWith("mvm://");
  const frameSrc = !internal && !tab.error ? browseHref(settings, tab.url, { sid: tab.sid, desktop: tab.desktop }) : "";

  return (
    <div className="mvm-shell" data-mode={mode}>
      <header className="mvm-topbar">
        <Link to="/" className="mvm-brand" aria-label="MVM Browser home" onClick={goHome}>
          <img src="/design/logo/mvm-logo.svg" alt="" /><span>MVM<span className="mvm-brand-light">BROWSER</span></span>
        </Link>
        <div className="mvm-build-mark"><span className="mvm-live-dot" />{mode === "incognito" ? "PRIVATE SESSION" : "WEB EXPLORER"}</div>
        <div className="mvm-account-actions">
          <button className="mvm-icon-button mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setMenuOpen((v) => !v)}><Menu size={18} /></button>
          {isPending ? <span className="mvm-account-skeleton" aria-label="Loading account" /> : user ? (
            <Link to="/profile" className="mvm-account-link">
              {user.profileImageUrl ? <img src={user.profileImageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="mvm-avatar-fallback">{(user.displayName || user.primaryEmail || "U").slice(0, 1).toUpperCase()}</span>}
              <span className="mvm-account-name">{user.displayName || user.primaryEmail || "Account"}</span>
            </Link>
          ) : <Link to="/login" className="mvm-signin-button"><UserRound size={15} /> Sign in</Link>}
        </div>
      </header>

      <nav className="mvm-tabs" aria-label="Browser tabs">
        <div className="mvm-tab-list">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={"mvm-tab" + (item.id === tab.id ? " is-active" : "")} onClick={() => activate(item.id)} title={item.title || item.url}>
              <Globe2 size={14} className="mvm-tab-favicon" />
              <span>{item.title || (item.url === "mvm://home" ? "New tab" : item.url.replace(/^https?:\/\//, "").slice(0, 24))}</span>
              <span className="mvm-tab-close" role="button" tabIndex={0} aria-label="Close tab"
                onClick={(event) => { event.stopPropagation(); closeTab(item.id); }}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); closeTab(item.id); } }}>
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
        <button className="mvm-icon-button mvm-add-tab" type="button" aria-label="New tab" onClick={() => newTab(false)}><Plus size={16} /></button>
      </nav>

      <div className="mvm-browser-toolbar">
        <div className="mvm-navigation-controls">
          <button className="mvm-icon-button" type="button" aria-label="Go back" disabled={tab.index <= 0} onClick={back}><ArrowLeft size={17} /></button>
          <button className="mvm-icon-button" type="button" aria-label="Go forward" disabled={tab.index >= tab.history.length - 1} onClick={forward}><ArrowRight size={17} /></button>
          <button className="mvm-icon-button" type="button" aria-label="Reload page" onClick={() => isHome ? goHome() : reload()}><RefreshCw size={16} /></button>
          <button className="mvm-icon-button mvm-home-button" type="button" aria-label="Home" onClick={goHome}><Home size={16} /></button>
        </div>
        <form className="mvm-address-form" onSubmit={submitAddress}>
          <ShieldCheck size={15} className="mvm-address-security" />
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search or enter an address" aria-label="Search or enter an address" spellCheck={false} autoCapitalize="off" autoComplete="url" />
          {address && <button className="mvm-address-clear" type="button" aria-label="Clear address" onClick={() => setAddress("")}><X size={14} /></button>}
          <button className="mvm-address-go" type="submit" aria-label="Go"><ArrowRight size={16} /></button>
        </form>
        <button className={"mvm-icon-button" + (bookmarks.some((b) => b.url === tab.url) ? " is-selected" : "")} type="button" aria-label="Toggle bookmark" onClick={toggleBookmark} disabled={tab.url.startsWith("mvm://")}><Bookmark size={16} /></button>
        <button className={"mvm-icon-button" + (panel ? " is-selected" : "")} type="button" aria-label="Toggle navigation panels" onClick={() => setMenuOpen((v) => !v)}><Menu size={17} /></button>
      </div>
      {tab.loading && <div className="mvm-progress-track"><span style={{ width: Math.max(8, tab.progress || 8) + "%" }} /></div>}

      <div className="mvm-main-layout">
        <aside className={"mvm-rail" + (menuOpen ? " is-open" : "")} aria-label="Browser tools">
          <button className={"mvm-rail-button" + (isHome && !panel ? " is-active" : "")} type="button" onClick={goHome} aria-label="Home" title="Home"><Home size={18} /></button>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={"mvm-rail-button" + (panel === id ? " is-active" : "")} type="button" onClick={() => { setPanel(panel === id ? null : id); setMenuOpen(false); }} aria-label={label} title={label}>
              <Icon size={18} />{id === "tabs" && <span className="mvm-rail-count">{tabs.length}</span>}
            </button>
          ))}
          <span className="mvm-rail-spacer" />
          <button className={"mvm-rail-button" + (mode === "incognito" ? " is-active" : "")} type="button" onClick={() => useMvm.getState().setMode(mode === "incognito" ? "normal" : "incognito")} aria-label="Private session" title="Private session"><LockKeyhole size={17} /></button>
          <button className="mvm-rail-button" type="button" onClick={() => setPanel("about")} aria-label="About MVM Browser" title="About"><CircleHelp size={17} /></button>
        </aside>

        <main className="mvm-viewport">
          {panel ? <BrowserPanel panel={panel} onNavigate={(url) => { navigate(url); setPanel(null); }} /> :
            tab.error ? <div className="mvm-error-state">
              <div className="mvm-error-orb"><ShieldCheck size={28} /></div><p className="mvm-eyebrow">NAVIGATION STOPPED</p>
              <h1>{tab.error === "SAFE" ? "This page was flagged" : "This page could not open"}</h1>
              <p className="mvm-muted">{tab.error === "SAFE" ? "The safety check rejected this destination." : "MVM Browser stopped this navigation instead of silently bypassing the error."}</p>
              <code>{tab.url}</code><div className="mvm-action-row"><button className="mvm-secondary-button" type="button" onClick={goHome}>Return home</button><button className="mvm-primary-button" type="button" onClick={reload}><RefreshCw size={15} /> Try again</button></div>
            </div> :
            isHome ? <HomeSurface address={address} setAddress={setAddress} onNavigate={(value) => { navigate(value); setPanel(null); }} quick={useMvm.getState().quick} bookmarks={bookmarks.slice(0, 4)} /> :
            internal ? <div className="mvm-internal-state"><div className="mvm-error-orb"><Sparkles size={26} /></div><p className="mvm-eyebrow">MVM INTERNAL</p><h1>{tab.url.replace("mvm://", "").replace(/-/g, " ")}</h1><p className="mvm-muted">This address is reserved for browser features.</p><button className="mvm-primary-button" type="button" onClick={goHome}><Home size={15} /> Open start page</button></div> :
            <div className="mvm-frame-wrap">
              <iframe key={tab.id + ":" + tab.sid + ":" + tab.url} ref={frameRef} className="mvm-web-frame" title={tab.title || tab.url} src={frameSrc}
                sandbox="allow-scripts allow-forms allow-downloads allow-modals" referrerPolicy="no-referrer"
                allow="fullscreen; autoplay; clipboard-read; clipboard-write"
                onLoad={() => setTab(tab.id, { loading: false, progress: 100 })} />
              {tab.loading && <div className="mvm-frame-loading"><span className="mvm-spinner" /> Loading securely…</div>}
            </div>}
        </main>
      </div>

      <footer className="mvm-statusbar">
        <div><span className="mvm-status-dot" /> MVM BROWSER <span className="mvm-status-divider">/</span> {mode === "incognito" ? "LOCAL PRIVATE SESSION" : "LOCAL PROFILE"}</div>
        <div className="mvm-status-metrics"><span><ShieldCheck size={12} /> {settings.blockLevel === "off" ? "Protection off" : "Protection " + settings.blockLevel}</span><span><Activity size={12} /> {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}</span></div>
      </footer>
    </div>
  );
}

function HomeSurface({
  address, setAddress, onNavigate, quick, bookmarks,
}: {
  address: string; setAddress: (value: string) => void; onNavigate: (value: string) => void;
  quick: { id: string; label: string; url: string }[]; bookmarks: { id: string; title: string; url: string }[];
}) {
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (address.trim()) onNavigate(address.trim()); }
  return (
    <section className="mvm-home-surface">
      <div className="mvm-home-topline"><span className="mvm-live-dot" /> YOUR SPACE ON THE WEB <span className="mvm-home-version">MVM / 01</span></div>
      <div className="mvm-home-hero">
        <div className="mvm-hero-orbit mvm-hero-orbit-one" /><div className="mvm-hero-orbit mvm-hero-orbit-two" />
        <div className="mvm-hero-mark"><img src="/design/logo/mvm-logo.svg" alt="" /></div>
        <p className="mvm-eyebrow">MOVE THROUGH THE WEB</p><h1>Go beyond<br /><span>the ordinary.</span></h1>
        <p className="mvm-muted mvm-hero-copy">A focused space for searching, exploring and keeping your web within reach.</p>
        <form className="mvm-home-search" onSubmit={search}><Search size={19} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Search anything or enter a URL" aria-label="Search the web" autoComplete="off" /><button type="submit" aria-label="Search"><ArrowRight size={17} /></button></form>
      </div>
      <div className="mvm-section-heading"><div><p className="mvm-eyebrow">QUICK ACCESS</p><h2>Jump back in</h2></div><span>{quick.length} shortcuts</span></div>
      <div className="mvm-quick-grid">{quick.slice(0, 8).map((tile) => (
        <button key={tile.id} type="button" className="mvm-quick-tile" onClick={() => onNavigate(tile.url)}><span className="mvm-quick-icon">{tile.label.slice(0, 1).toUpperCase()}</span><span className="mvm-quick-label">{tile.label}</span><ExternalLink size={13} className="mvm-quick-open" /></button>
      ))}</div>
      {bookmarks.length > 0 && <div className="mvm-bookmark-strip"><div className="mvm-section-heading"><div><p className="mvm-eyebrow">SAVED BY YOU</p><h2>Bookmarks</h2></div></div>{bookmarks.map((item) => <button key={item.id} className="mvm-mini-bookmark" type="button" onClick={() => onNavigate(item.url)}><Bookmark size={14} /><span>{item.title || item.url}</span><ArrowRight size={13} /></button>)}</div>}
      <div className="mvm-home-note"><ShieldCheck size={16} /><span>Privacy controls are available from the side rail. Your current browsing data stays on this device.</span></div>
    </section>
  );
}

function BrowserPanel({ panel, onNavigate }: { panel: Exclude<Panel, null>; onNavigate: (url: string) => void }) {
  const close = useMvm((s) => s.setPanel);
  const tabs = useMvm((s) => [...s.tabs, ...s.incognitoTabs]);
  const active = useMvm(currentTab);
  const bookmarks = useMvm((s) => s.bookmarks);
  const history = useMvm((s) => s.history);
  const downloads = useMvm((s) => s.downloads);
  const settings = useMvm((s) => s.settings);
  const theme = useMvm((s) => s.theme);
  const setTheme = useMvm((s) => s.setTheme);
  const patch = useMvm((s) => s.patch);
  const activate = useMvm((s) => s.activate);
  const closeTab = useMvm((s) => s.closeTab);
  const removeBookmark = useMvm((s) => s.removeBookmark);
  const removeDownload = useMvm((s) => s.removeDownload);
  const clearHistory = useMvm((s) => s.clearHistory);
  const newTab = useMvm((s) => s.newTab);
  const labels: Record<Exclude<Panel, null>, string> = {
    menu: "Browser menu", tabs: "Open tabs", settings: "Settings", history: "History", bookmarks: "Bookmarks",
    downloads: "Downloads", extensions: "Extensions", music: "Music", gallery: "Gallery", about: "About MVM Browser",
    site: "Site controls", qr: "Share a page", vault: "Private vault", clear: "Clear browsing data", game: "Performance",
  };
  return (
    <section className="mvm-panel">
      <header className="mvm-panel-header"><div><p className="mvm-eyebrow">CONTROL CENTER</p><h1>{labels[panel]}</h1></div><button className="mvm-icon-button" type="button" aria-label="Close panel" onClick={() => close(null)}><X size={17} /></button></header>
      {panel === "tabs" && <div className="mvm-panel-list">{tabs.map((item) => <div className={"mvm-list-row" + (item.id === active.id ? " is-current" : "")} key={item.id}><button className="mvm-list-main" type="button" onClick={() => { activate(item.id); close(null); }}><Globe2 size={16} /><span><strong>{item.title || item.url}</strong><small>{item.url}</small></span></button><button className="mvm-icon-button small" type="button" aria-label="Close tab" onClick={() => closeTab(item.id)}><X size={14} /></button></div>)}<button className="mvm-secondary-button" type="button" onClick={() => { newTab(false); close(null); }}><Plus size={15} /> New tab</button></div>}
      {panel === "bookmarks" && <div className="mvm-panel-list">{bookmarks.length === 0 ? <EmptyPanel icon={<Bookmark size={22} />} title="Nothing saved yet" text="Use the bookmark icon in the address bar to save a page." /> : bookmarks.map((item) => <div className="mvm-list-row" key={item.id}><button className="mvm-list-main" type="button" onClick={() => onNavigate(item.url)}><Bookmark size={16} /><span><strong>{item.title || item.url}</strong><small>{item.url}</small></span></button><button className="mvm-icon-button small" type="button" aria-label="Remove bookmark" onClick={() => removeBookmark(item.id)}><Trash2 size={14} /></button></div>)}</div>}
      {panel === "history" && <div className="mvm-panel-list"><div className="mvm-list-toolbar"><span>{history.length} recent visits</span><button className="mvm-text-button" type="button" onClick={() => { if (window.confirm("Clear all local browsing history?")) clearHistory(); }}>Clear history</button></div>{history.length === 0 ? <EmptyPanel icon={<History size={22} />} title="No history yet" text="Pages you visit in a normal session appear here." /> : history.slice(0, 100).map((item) => <button className="mvm-history-row" key={item.id} type="button" onClick={() => onNavigate(item.url)}><History size={15} /><span><strong>{item.title || item.url}</strong><small>{item.url}</small></span><time>{new Date(item.at).toLocaleDateString()}</time></button>)}</div>}
      {panel === "downloads" && <div className="mvm-panel-list">{downloads.length === 0 ? <EmptyPanel icon={<Download size={22} />} title="No downloads recorded" text="Download activity appears here when supported by the active page." /> : downloads.map((item) => <div className="mvm-list-row" key={item.id}><button className="mvm-list-main" type="button" onClick={() => onNavigate(item.url)}><Download size={16} /><span><strong>{item.filename}</strong><small>{item.status} · {item.url}</small></span></button><button className="mvm-icon-button small" type="button" aria-label="Remove download record" onClick={() => removeDownload(item.id)}><Trash2 size={14} /></button></div>)}</div>}
      {panel === "settings" && <div className="mvm-settings-grid">
        <div className="mvm-settings-section"><p className="mvm-eyebrow">APPEARANCE</p><label className="mvm-setting-field"><span>Color profile</span><select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label><SettingToggle title="Reduce motion" description="Limit nonessential interface animation." value={settings.motion === "reduced"} onChange={(value) => patch({ motion: value ? "reduced" : "full" })} /></div>
        <div className="mvm-settings-section"><p className="mvm-eyebrow">PRIVACY & SECURITY</p><SettingToggle title="HTTPS-only navigation" description="Upgrade typed web addresses to HTTPS." value={settings.httpsOnly} onChange={(value) => patch({ httpsOnly: value })} /><SettingToggle title="Do Not Track" description="Send a browser privacy preference." value={settings.dnt} onChange={(value) => patch({ dnt: value })} /><SettingToggle title="Global Privacy Control" description="Signal a preference to opt out of sale or sharing." value={settings.gpc} onChange={(value) => patch({ gpc: value })} /><label className="mvm-setting-field"><span>Content blocking</span><select value={settings.blockLevel} onChange={(event) => patch({ blockLevel: event.target.value as "off" | "standard" | "strict" })}><option value="off">Off</option><option value="standard">Standard</option><option value="strict">Strict</option></select></label></div>
        <div className="mvm-settings-section"><p className="mvm-eyebrow">ACCOUNT</p><div className="mvm-account-setting"><UserRound size={18} /><span><strong>Browser account</strong><small>Profile and sign-in are separate from local browsing storage.</small></span><Link to="/profile" className="mvm-text-button">Open</Link></div></div>
        <p className="mvm-settings-note"><LockKeyhole size={15} /> Browser history, bookmarks and settings are local. Account-based sync is not enabled yet.</p>
      </div>}
      {panel === "about" && <div className="mvm-about-card"><img src="/design/logo/mvm-logo.svg" alt="" /><p className="mvm-eyebrow">BROWSER EXPERIENCE</p><h2>MVM Browser</h2><p className="mvm-muted">A privacy-focused browser interface by MvMSOLO. The current Android package uses Android System WebView; standalone Chromium remains a separate migration milestone.</p><div className="mvm-about-stats"><span><ShieldCheck size={14} /> HTTPS-first controls</span><span><Zap size={14} /> Performance profiles</span></div></div>}
      {!["tabs", "bookmarks", "history", "downloads", "settings", "about"].includes(panel) && <EmptyPanel icon={<Settings2 size={22} />} title="This tool is being integrated" text="This navigation entry is reserved for a later product-readiness phase." />}
    </section>
  );
}

function SettingToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button className="mvm-setting-toggle" type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}><span><strong>{title}</strong><small>{description}</small></span><span className={"mvm-switch" + (value ? " is-on" : "")}><i /></span></button>;
}
function EmptyPanel({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="mvm-empty-panel"><span className="mvm-empty-icon">{icon}</span><h2>{title}</h2><p>{text}</p></div>;
}
