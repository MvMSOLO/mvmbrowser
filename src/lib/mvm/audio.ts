export type Track = {
  id: string;
  title: string;
  artist: string;
  source: "audius" | "jamendo" | "radio" | "local";
  artwork: string;
  streamUrl: string;
  duration: number;
  pageUrl: string;
};

export type RepeatMode = "off" | "all" | "one";

type Snap = {
  queue: Track[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  preset: "flat" | "bass" | "focus" | "hype";
  sleepMin: number;
  sleepLeft: number;
  favorites: Track[];
  playlists: { id: string; name: string; tracks: Track[] }[];
  time: number;
  duration: number;
  levels: number[];
  visual: "live" | "synth";
  error: string;
  tab: "search" | "trending" | "radio" | "local" | "playlists" | "favorites";
  results: Track[];
  query: string;
  loading: boolean;
};

const listeners = new Set<() => void>();
let snap: Snap = {
  queue: [],
  index: 0,
  playing: false,
  shuffle: false,
  repeat: "off",
  volume: 0.9,
  preset: "flat",
  sleepMin: 0,
  sleepLeft: 0,
  favorites: [],
  playlists: [],
  time: 0,
  duration: 0,
  levels: [0.2, 0.4, 0.3, 0.5, 0.25],
  visual: "synth",
  error: "",
  tab: "trending",
  results: [],
  query: "",
  loading: false,
};

let musicEl: HTMLAudioElement | null = null;
let radioEl: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let filters: BiquadFilterNode[] = [];
let analyser: AnalyserNode | null = null;
let wired = false;
let sleepTimer = 0;
let raf = 0;

function emit() {
  snap = { ...snap };
  listeners.forEach((fn) => fn());
}

export function getMusic(): Snap {
  return snap;
}

export function subscribeMusic(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function patchMusic(partial: Partial<Snap>): void {
  snap = { ...snap, ...partial };
  emit();
}

function currentEl(): HTMLAudioElement | null {
  const track = snap.queue[snap.index];
  if (!track) return null;
  return track.source === "radio" ? radioEl : musicEl;
}

function applyPreset(preset: Snap["preset"]) {
  if (filters.length < 3) return;
  const [low, mid, high] = filters;
  low.frequency.value = 140;
  mid.frequency.value = 1200;
  high.frequency.value = 6000;
  low.gain.value = preset === "bass" || preset === "hype" ? 6 : preset === "focus" ? -2 : 0;
  mid.gain.value = preset === "focus" ? 3 : preset === "hype" ? 2 : 0;
  high.gain.value = preset === "hype" ? 4 : preset === "focus" ? 4 : 0;
}

function ensure() {
  if (musicEl || typeof window === "undefined") return;
  musicEl = new Audio();
  radioEl = new Audio();
  musicEl.preload = "none";
  radioEl.preload = "none";
  for (const el of [musicEl, radioEl]) {
    el.addEventListener("timeupdate", () => {
      const live = currentEl();
      if (live !== el) return;
      snap = { ...snap, time: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : snap.duration };
      emit();
    });
    el.addEventListener("ended", () => nextTrack(1));
    el.addEventListener("error", () => {
      snap = { ...snap, error: "audio", playing: false };
      emit();
    });
  }
}

function wireGraph() {
  if (wired || !musicEl) return;
  ctx = new AudioContext();
  const low = ctx.createBiquadFilter();
  const mid = ctx.createBiquadFilter();
  const high = ctx.createBiquadFilter();
  low.type = "lowshelf";
  mid.type = "peaking";
  high.type = "highshelf";
  analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  const source = ctx.createMediaElementSource(musicEl);
  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(analyser);
  analyser.connect(ctx.destination);
  filters = [low, mid, high];
  wired = true;
  applyPreset(snap.preset);
}

function loopVisual() {
  cancelAnimationFrame(raf);
  const tick = () => {
    const track = snap.queue[snap.index];
    if (!snap.playing) return;
    if (track && track.source !== "radio" && analyser) {
      const bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      const levels = [4, 10, 16, 22, 28].map((i) => (bins[i] || 0) / 255);
      snap = { ...snap, levels, visual: "live" };
    } else {
      const t = performance.now() / 180;
      const levels = [0, 1, 2, 3, 4].map((i) => 0.25 + Math.abs(Math.sin(t + i)) * 0.7);
      snap = { ...snap, levels, visual: "synth" };
    }
    emit();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

export async function playTrack(track: Track, queue?: Track[]) {
  ensure();
  const list = queue && queue.length ? queue : [track];
  const index = Math.max(0, list.findIndex((item) => item.id === track.id));
  snap = { ...snap, queue: list, index, error: "", playing: false };
  emit();
  const el = track.source === "radio" ? radioEl : musicEl;
  const other = track.source === "radio" ? musicEl : radioEl;
  other?.pause();
  if (!el) return;
  if (track.source !== "radio") {
    el.crossOrigin = "anonymous";
    wireGraph();
    if (ctx?.state === "suspended") await ctx.resume();
  }
  el.volume = snap.volume;
  el.src = track.streamUrl;
  try {
    await el.play();
    snap = { ...snap, playing: true };
    emit();
    loopVisual();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        artwork: track.artwork ? [{ src: track.artwork }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => void resume());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => nextTrack(-1));
    }
  } catch {
    snap = { ...snap, playing: false, error: "audio" };
    emit();
  }
}

export function pause() {
  musicEl?.pause();
  radioEl?.pause();
  snap = { ...snap, playing: false };
  emit();
}

export async function resume() {
  const el = currentEl();
  if (!el) return;
  try {
    await el.play();
    snap = { ...snap, playing: true };
    emit();
    loopVisual();
  } catch {
    snap = { ...snap, error: "audio" };
    emit();
  }
}

export function togglePlay() {
  if (snap.playing) pause();
  else void resume();
}

export function nextTrack(dir: number) {
  const { queue, index, shuffle, repeat } = snap;
  if (!queue.length) return;
  if (repeat === "one" && dir > 0) {
    const el = currentEl();
    if (el) el.currentTime = 0;
    void currentEl()?.play();
    return;
  }
  let next = index + dir;
  if (shuffle) next = Math.floor(Math.random() * queue.length);
  if (next >= queue.length) {
    if (repeat === "all") next = 0;
    else {
      pause();
      return;
    }
  }
  if (next < 0) next = 0;
  const track = queue[next];
  if (track) void playTrack(track, queue);
}

export function librarySnapshot() {
  return { favorites: snap.favorites, playlists: snap.playlists, volume: snap.volume, preset: snap.preset };
}

export function setVolume(volume: number) {
  snap = { ...snap, volume };
  if (musicEl) musicEl.volume = volume;
  if (radioEl) radioEl.volume = volume;
  emit();
  saveLib();
}

export function setPreset(preset: Snap["preset"]) {
  snap = { ...snap, preset };
  applyPreset(preset);
  emit();
  saveLib();
}

export function seek(time: number) {
  const el = currentEl();
  if (el) el.currentTime = time;
}

export function setSleep(min: number) {
  window.clearInterval(sleepTimer);
  snap = { ...snap, sleepMin: min, sleepLeft: min * 60 };
  emit();
  if (!min) return;
  sleepTimer = window.setInterval(() => {
    const left = snap.sleepLeft - 1;
    if (left <= 0) {
      window.clearInterval(sleepTimer);
      pause();
      snap = { ...snap, sleepLeft: 0, playing: false };
      emit();
      return;
    }
    snap = { ...snap, sleepLeft: left };
    emit();
  }, 1000);
}

export function toggleFavorite(track: Track) {
  const exists = snap.favorites.some((item) => item.id === track.id);
  snap = {
    ...snap,
    favorites: exists ? snap.favorites.filter((item) => item.id !== track.id) : [track, ...snap.favorites],
  };
  emit();
  saveLib();
}

export function savePlaylist(name: string, tracks: Track[]) {
  snap = {
    ...snap,
    playlists: [{ id: crypto.randomUUID(), name, tracks }, ...snap.playlists].slice(0, 30),
  };
  emit();
  saveLib();
}

export function restoreLibrary(data: { favorites: Track[]; playlists: Snap["playlists"]; volume: number; preset: Snap["preset"] }) {
  snap = { ...snap, ...data };
  emit();
}

function saveLib() {
  try {
    localStorage.setItem("mvm.music", JSON.stringify(librarySnapshot()));
  } catch {
    /* ignore quota */
  }
}

export function loadLibrary() {
  try {
    const raw = localStorage.getItem("mvm.music");
    if (!raw) return;
    restoreLibrary(JSON.parse(raw) as ReturnType<typeof librarySnapshot>);
  } catch {
    /* ignore */
  }
}
