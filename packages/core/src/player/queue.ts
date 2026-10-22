// Oynatıcı kuyruğu: saf fonksiyonlar, platformdan bağımsız. Her işlem yeni bir durum döndürür.
// Bağlam (çalma listesi, albüm) sırası ile karışık sıra ayrı tutulur; elle eklenen "Sıradaki"
// şarkılar bağlamdan önce çalar. Rastgelelik dışarıdan verilebilir (testler için).

export type RepeatMode = 'off' | 'all' | 'one';
export type Rng = () => number;

export interface QueueTrack {
  id: string;
}

export interface QueueState<T extends QueueTrack> {
  /** Bağlamdaki şarkılar, özgün sırasıyla. */
  context: readonly T[];
  /** Çalma sırası: context indeksleri. Karışık değilse 0..n-1. */
  order: readonly number[];
  /** order içindeki konum. Kuyruk boşsa -1. */
  position: number;
  /** Elle eklenen ve bağlamdan önce çalacak şarkılar. */
  upNext: readonly T[];
  /** Şu an "Sıradaki"nden çalan şarkı; bağlamdan çalıyorsa null. */
  playingFromUpNext: T | null;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Bağlamın kimliği (çalma listesi, albüm) ve adı; arayüzde "Çalınıyor: ..." için. */
  contextId: string | null;
}

export type NextResult<T extends QueueTrack> = { state: QueueState<T>; track: T | null; restart: boolean };

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Fisher-Yates karıştırma; yerinde değil, yeni dizi döndürür. */
export function shuffled<V>(items: readonly V[], rng: Rng = Math.random): V[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as V, out[i] as V];
  }
  return out;
}

export function emptyQueue<T extends QueueTrack>(): QueueState<T> {
  return { context: [], order: [], position: -1, upNext: [], playingFromUpNext: null, shuffle: false, repeat: 'off', contextId: null };
}

/** Şu an çalan şarkı. */
export function currentTrack<T extends QueueTrack>(s: QueueState<T>): T | null {
  if (s.playingFromUpNext) return s.playingFromUpNext;
  const idx = s.order[s.position];
  return idx === undefined ? null : (s.context[idx] ?? null);
}

/** Karışık sıra: başlangıç şarkısı en başta, kalanlar karışık. */
function shuffledOrder(length: number, first: number, rng: Rng): number[] {
  return [first, ...shuffled(range(length).filter((i) => i !== first), rng)];
}

/** Bir bağlamı belirli bir şarkıdan başlatır. Karışık mod ve tekrar ayarı korunur. */
export function playContext<T extends QueueTrack>(
  s: QueueState<T>,
  context: readonly T[],
  startIndex = 0,
  contextId: string | null = null,
  rng: Rng = Math.random,
): QueueState<T> {
  if (!context.length) return { ...emptyQueue<T>(), shuffle: s.shuffle, repeat: s.repeat, upNext: s.upNext };
  const start = Math.min(Math.max(startIndex, 0), context.length - 1);
  const order = s.shuffle ? shuffledOrder(context.length, start, rng) : range(context.length);
  return { ...s, context, order, position: s.shuffle ? 0 : start, playingFromUpNext: null, contextId };
}

/** Sonraki şarkı: önce "Sıradaki", sonra bağlam; sonda tekrar "tümü" ise başa döner. */
export function next<T extends QueueTrack>(s: QueueState<T>, rng: Rng = Math.random): NextResult<T> {
  const [head, ...rest] = s.upNext;
  if (head) return { state: { ...s, upNext: rest, playingFromUpNext: head }, track: head, restart: false };
  const base = { ...s, playingFromUpNext: null };
  if (s.position + 1 < s.order.length) {
    const state = { ...base, position: s.position + 1 };
    return { state, track: currentTrack(state), restart: false };
  }
  if (s.repeat === 'all' && s.order.length) {
    const order = s.shuffle ? shuffled(range(s.context.length), rng) : s.order;
    const state = { ...base, order, position: 0 };
    return { state, track: currentTrack(state), restart: false };
  }
  return { state: s, track: null, restart: false };
}

/** Önceki şarkı. 3 saniyeden fazla çalındıysa ya da başa gelindiyse şarkıyı baştan alır. */
export function previous<T extends QueueTrack>(s: QueueState<T>, elapsedSeconds: number): NextResult<T> {
  const playing = currentTrack(s);
  if (elapsedSeconds > 3) return { state: s, track: playing, restart: true };
  if (s.playingFromUpNext) {
    const state = { ...s, playingFromUpNext: null };
    const track = currentTrack(state);
    return track ? { state, track, restart: false } : { state: s, track: playing, restart: true };
  }
  if (s.position > 0) {
    const state = { ...s, position: s.position - 1 };
    return { state, track: currentTrack(state), restart: false };
  }
  if (s.repeat === 'all' && s.order.length > 1) {
    const state = { ...s, position: s.order.length - 1 };
    return { state, track: currentTrack(state), restart: false };
  }
  return { state: s, track: playing, restart: true };
}

/** Şarkı kendiliğinden bitince: tek tekrarda aynı şarkı baştan, aksi halde sonraki. */
export function trackEnded<T extends QueueTrack>(s: QueueState<T>, rng: Rng = Math.random): NextResult<T> {
  if (s.repeat === 'one') return { state: s, track: currentTrack(s), restart: true };
  return next(s, rng);
}

/** Karışık modu açar/kapatır. Çalan şarkı yerinde kalır; kapatınca özgün sıradaki yerine döner. */
export function setShuffle<T extends QueueTrack>(s: QueueState<T>, on: boolean, rng: Rng = Math.random): QueueState<T> {
  if (on === s.shuffle) return s;
  const playingIdx = s.order[s.position];
  if (playingIdx === undefined) return { ...s, shuffle: on };
  if (on) return { ...s, shuffle: true, order: shuffledOrder(s.context.length, playingIdx, rng), position: 0 };
  return { ...s, shuffle: false, order: range(s.context.length), position: playingIdx };
}

const REPEAT_CYCLE: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

/** Tekrar düğmesinin sırası: kapalı -> tümü -> tek -> kapalı. */
export function cycleRepeat<T extends QueueTrack>(s: QueueState<T>): QueueState<T> {
  return { ...s, repeat: REPEAT_CYCLE[s.repeat] };
}

/** "Sıraya ekle": "Sıradaki" listesinin sonuna. */
export function enqueue<T extends QueueTrack>(s: QueueState<T>, ...tracks: T[]): QueueState<T> {
  return { ...s, upNext: [...s.upNext, ...tracks] };
}

/** "Sonra çal": "Sıradaki" listesinin başına. */
export function playNext<T extends QueueTrack>(s: QueueState<T>, ...tracks: T[]): QueueState<T> {
  return { ...s, upNext: [...tracks, ...s.upNext] };
}

export function removeFromUpNext<T extends QueueTrack>(s: QueueState<T>, index: number): QueueState<T> {
  return { ...s, upNext: s.upNext.filter((_, i) => i !== index) };
}

export function moveInUpNext<T extends QueueTrack>(s: QueueState<T>, from: number, to: number): QueueState<T> {
  if (from === to || from < 0 || from >= s.upNext.length) return s;
  const list = [...s.upNext];
  const [item] = list.splice(from, 1);
  list.splice(Math.min(Math.max(to, 0), list.length), 0, item as T);
  return { ...s, upNext: list };
}

export function clearUpNext<T extends QueueTrack>(s: QueueState<T>): QueueState<T> {
  return { ...s, upNext: [] };
}

/** Sırada bekleyenler: önce "Sıradaki", sonra bağlamın kalanı. */
export function upcoming<T extends QueueTrack>(s: QueueState<T>, limit = 50): T[] {
  const rest = s.order.slice(s.position + 1).map((i) => s.context[i]).filter((t): t is T => t !== undefined);
  return [...s.upNext, ...rest].slice(0, limit);
}
