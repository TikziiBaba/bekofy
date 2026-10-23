// Oynatıcı: expo-audio'nun yerel çalma listesi (AudioPlaylist) üstünde. Arka planda çalar, kilit ekranı ve bildirimde
// denetim gösterir; ileri/geri düğmeleri yerel listede gezer, uygulama "trackChanged" ile eşitlenir.
//
// Sıra düz bir dizidir ve yerel listeyle birebir aynı tutulur: karışık çalmada dizi karışık kurulur, "Sıradaki çal"
// bir sonraki konuma eklenir, "Sıraya ekle" sona eklenir. Tekrar: tüm liste -> 'all', bu şarkı -> 'single'.

import { recordPlay, setNowPlaying, shouldRecordPlay, shuffled, songAudioUrl, type SongSummary } from '@bekofy/core';
import { createAudioPlaylist, setAudioModeAsync, type AudioPlaylist, type AudioPlaylistStatus } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localUri } from './offline';
import { sb } from './supabase';

export type Track = SongSummary;
export type Repeat = 'off' | 'all' | 'one';

export interface PlayerState {
  items: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  contextId: string | null;
  /** Karışık çalma kapatılınca dönülecek özgün sıra. */
  original: Track[];
}

const LOOP = { off: 'none', all: 'all', one: 'single' } as const;

class Player {
  private native: AudioPlaylist | null = null;
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private heard = 0;
  private lastTime = 0;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  state: PlayerState = { items: [], index: -1, current: null, isPlaying: false, buffering: false, position: 0, duration: 0, shuffle: false, repeat: 'off', contextId: null, original: [] };

  private get pl(): AudioPlaylist {
    if (!this.native) {
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      this.native = createAudioPlaylist({ sources: [], updateInterval: 500, loop: 'none' });
      this.native.addListener('playlistStatusUpdate', (s: AudioPlaylistStatus) => this.onStatus(s));
      this.native.addListener('trackChanged', (e: { currentIndex: number }) => this.onTrackChanged(e.currentIndex));
    }
    return this.native;
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getState = () => this.state;

  private set(patch: Partial<PlayerState>): void {
    const before = this.state;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
    if (before.current?.id !== this.state.current?.id || before.isPlaying !== this.state.isPlaying) this.publishPresence();
  }

  setAccount(userId: string | null): void {
    this.userId = userId;
    if (!userId) this.stop();
  }

  private source(t: Track) {
    return { uri: localUri(t.id) ?? songAudioUrl(sb, t), name: t.title };
  }

  private meta(t: Track) {
    return { title: t.title, artist: t.artist, albumTitle: t.album ?? undefined, artworkUrl: t.cover_url ?? undefined };
  }

  /* ---------- Yerel olaylar ---------- */
  private onStatus(s: AudioPlaylistStatus): void {
    if (this.state.isPlaying && s.currentTime > this.lastTime && s.currentTime - this.lastTime < 3) this.heard += s.currentTime - this.lastTime;
    this.lastTime = s.currentTime;
    this.set({ isPlaying: s.playing, buffering: s.isBuffering, position: s.currentTime, duration: s.duration || this.state.current?.duration || 0 });
    if (s.didJustFinish && s.currentIndex === this.state.items.length - 1 && this.state.repeat === 'off') this.flushHistory();
  }

  /** Yerel liste başka şarkıya geçti (bildirim/kilit ekranı düğmesi, şarkı bitti ya da uygulamadan geçiş). */
  private onTrackChanged(index: number): void {
    const current = this.state.items[index] ?? null;
    if (index === this.state.index && current === this.state.current) return;
    this.flushHistory();
    this.set({ index, current, position: 0 });
    if (current) this.pl.updateLockScreenMetadata(this.meta(current));
  }

  /* ---------- Komutlar ---------- */
  /** Bir bağlamı belirli şarkıdan başlatır. Karışık açıksa başlangıç şarkısı başta, kalanlar karışık. */
  playList(tracks: readonly Track[], start = 0, contextId: string | null = null): void {
    if (!tracks.length) return;
    this.flushHistory();
    const original = [...tracks];
    const first = original[Math.min(Math.max(start, 0), original.length - 1)]!;
    const items = this.state.shuffle ? [first, ...shuffled(original.filter((_, i) => i !== start))] : original;
    const index = this.state.shuffle ? 0 : Math.min(Math.max(start, 0), original.length - 1);
    const pl = this.pl;
    pl.pause();
    pl.clear();
    for (const t of items) pl.add(this.source(t));
    pl.loop = LOOP[this.state.repeat];
    pl.skipTo(index);
    pl.play();
    this.heard = 0;
    this.lastTime = 0;
    this.set({ items, index, current: items[index]!, original, contextId, position: 0, isPlaying: true });
    pl.setActiveForLockScreen(true, this.meta(items[index]!), { showNextTrack: true, showPreviousTrack: true });
  }

  /** Sıradaki listeden bir şarkıya atla. */
  skipTo(index: number): void {
    if (index < 0 || index >= this.state.items.length) return;
    this.pl.skipTo(index);
    this.pl.play();
    this.onTrackChanged(index);
  }

  toggle(): void {
    if (!this.state.current) return;
    if (this.state.isPlaying) this.pl.pause();
    else this.pl.play();
  }

  next(): void {
    if (this.state.index < this.state.items.length - 1 || this.state.repeat === 'all') this.pl.next();
  }

  previous(): void {
    if (this.state.position > 3 || this.state.index === 0) void this.pl.seekTo(0);
    else this.pl.previous();
  }

  seek(seconds: number): void {
    void this.pl.seekTo(Math.max(0, seconds));
    this.lastTime = seconds;
    this.set({ position: seconds });
  }

  cycleRepeat(): void {
    const repeat: Repeat = this.state.repeat === 'off' ? 'all' : this.state.repeat === 'all' ? 'one' : 'off';
    this.pl.loop = LOOP[repeat];
    this.set({ repeat });
  }

  /** Şu anki şarkıdan sonrasını yeniden kurar: çalan şarkı kesilmez. */
  private replaceTail(tail: Track[]): void {
    const pl = this.pl;
    for (let i = this.state.items.length - 1; i > this.state.index; i--) pl.remove(i);
    for (const t of tail) pl.add(this.source(t));
    this.set({ items: [...this.state.items.slice(0, this.state.index + 1), ...tail] });
  }

  toggleShuffle(): void {
    const shuffle = !this.state.shuffle;
    const cur = this.state.current;
    if (cur) {
      const rest = this.state.original.filter((t) => t.id !== cur.id);
      if (shuffle) this.replaceTail(shuffled(rest));
      else {
        const at = this.state.original.findIndex((t) => t.id === cur.id);
        this.replaceTail(this.state.original.slice(at + 1));
      }
    }
    this.set({ shuffle });
  }

  playNextTrack(t: Track): void {
    if (!this.state.current) return this.playList([t]);
    this.pl.insert(this.source(t), this.state.index + 1);
    const items = [...this.state.items];
    items.splice(this.state.index + 1, 0, t);
    this.set({ items });
  }

  addToQueue(t: Track): void {
    if (!this.state.current) return this.playList([t]);
    this.pl.add(this.source(t));
    this.set({ items: [...this.state.items, t] });
  }

  /** Sıradaki bir şarkıyı hemen bu şarkının arkasına taşır. */
  moveToNext(index: number): void {
    const target = this.state.index + 1;
    if (index <= target || index >= this.state.items.length) return;
    const t = this.state.items[index]!;
    this.pl.remove(index);
    this.pl.insert(this.source(t), target);
    const items = this.state.items.filter((_, i) => i !== index);
    items.splice(target, 0, t);
    this.set({ items });
  }

  removeAt(index: number): void {
    if (index <= this.state.index) return;
    this.pl.remove(index);
    this.set({ items: this.state.items.filter((_, i) => i !== index) });
  }

  /** Jam: uzaktan gelen şarkı ve konum. */
  async playRemote(t: Track, position: number, playing: boolean): Promise<void> {
    if (this.state.current?.id !== t.id) this.playList([t], 0, 'jam');
    await this.pl.seekTo(position);
    if (playing) this.pl.play();
    else this.pl.pause();
  }

  stop(): void {
    this.flushHistory();
    if (this.native) {
      this.native.pause();
      this.native.clear();
      this.native.clearLockScreenControls();
    }
    this.set({ items: [], index: -1, current: null, isPlaying: false, position: 0, duration: 0, contextId: null, original: [] });
  }

  /* ---------- Yan etkiler ---------- */
  private flushHistory(): void {
    const t = this.state.current;
    const seconds = this.heard;
    this.heard = 0;
    this.lastTime = 0;
    if (!t || !this.userId || !shouldRecordPlay(seconds, t.duration)) return;
    void recordPlay(sb, { userId: this.userId, songId: t.id, secondsPlayed: seconds, platform: Platform.OS === 'ios' ? 'ios' : 'android', contextId: this.state.contextId }).catch(() => undefined);
  }

  private publishPresence(): void {
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.presenceTimer = setTimeout(() => {
      if (this.userId) void setNowPlaying(sb, this.userId, this.state.current?.id ?? null, this.state.isPlaying).catch(() => undefined);
    }, 1500);
  }
}

export const player = new Player();

export function usePlayer(): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}
