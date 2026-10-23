// Oynatıcı: kuyruk mantığı çekirdekte (saf fonksiyonlar), burada ses öğesi ve yan etkiler.
// Yan etkiler: dinleme geçmişi, "şimdi ne dinliyor", işletim sistemi medya tuşları, mini oynatıcı, Discord.

import {
  cycleRepeat,
  emptyQueue,
  enqueue,
  next as queueNext,
  playContext,
  playNext as queuePlayNext,
  previous as queuePrevious,
  recordPlay,
  removeFromUpNext,
  setNowPlaying,
  setShuffle,
  shouldRecordPlay,
  songAudioUrl,
  trackEnded,
  upcoming,
  currentTrack,
  type BekofyClient,
  type QueueState,
  type SongSummary,
} from '@bekofy/core';
import { useSyncExternalStore } from 'react';
import type { MiniCommand, PlayerSnapshot } from '../../../shared/ipc';
import { bridge } from './bridge';
import { setAmbientSeed } from './settings';

export type Track = SongSummary;

export interface PlayerState {
  queue: QueueState<Track>;
  current: Track | null;
  isPlaying: boolean;
  /** Saniye; ekranda saniyede birkaç kez güncellenir. */
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  error: string | null;
}

interface Account {
  sb: BekofyClient;
  userId: string;
}

const VOLUME_KEY = 'bekofy-volume';

class Player {
  private audio = new Audio();
  private listeners = new Set<() => void>();
  private account: Account | null = null;
  private offline = new Set<string>();
  /** Bu şarkıda gerçekten dinlenen süre (atlama/sarma sayılmaz). */
  private heard = 0;
  private lastTick = 0;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  state: PlayerState;

  constructor() {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    this.audio.preload = 'auto';
    this.audio.volume = Number.isFinite(saved) && saved >= 0 && saved <= 1 && localStorage.getItem(VOLUME_KEY) !== null ? saved : 0.8;
    this.state = { queue: emptyQueue(), current: null, isPlaying: false, position: 0, duration: 0, volume: this.audio.volume, muted: false, buffering: false, error: null };

    this.audio.addEventListener('timeupdate', () => {
      const t = this.audio.currentTime;
      if (this.state.isPlaying && t > this.lastTick && t - this.lastTick < 2) this.heard += t - this.lastTick;
      this.lastTick = t;
      if (Math.abs(t - this.state.position) >= 0.25) this.set({ position: t });
    });
    this.audio.addEventListener('durationchange', () => this.set({ duration: Number.isFinite(this.audio.duration) ? this.audio.duration : (this.state.current?.duration ?? 0) }));
    this.audio.addEventListener('play', () => this.set({ isPlaying: true, error: null }));
    this.audio.addEventListener('pause', () => this.set({ isPlaying: false }));
    this.audio.addEventListener('waiting', () => this.set({ buffering: true }));
    this.audio.addEventListener('playing', () => this.set({ buffering: false }));
    this.audio.addEventListener('seeked', () => (this.lastTick = this.audio.currentTime));
    this.audio.addEventListener('ended', () => {
      this.flushHistory();
      const r = trackEnded(this.state.queue);
      this.load(r.state, r.track, true);
    });
    this.audio.addEventListener('error', () => {
      if (!this.state.current) return;
      this.set({ isPlaying: false, buffering: false, error: 'Şarkı çalınamadı. İnternet bağlantını kontrol et.' });
    });
    this.setupMediaSession();
    bridge?.mini.onCommand((c) => this.command(c));
  }

  /* ---------- Durum ---------- */
  private set(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
    if ('isPlaying' in patch || 'current' in patch) this.publish();
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getState = () => this.state;

  setAccount(account: Account | null): void {
    this.account = account;
  }

  setOffline(ids: Iterable<string>): void {
    this.offline = new Set(ids);
  }

  /* ---------- Yükleme ---------- */
  private srcOf(track: Track): string {
    if (bridge && this.offline.has(track.id)) return bridge.offline.mediaUrl(track.id);
    return this.account ? songAudioUrl(this.account.sb, track) : track.file_path;
  }

  private load(queue: QueueState<Track>, track: Track | null, autoplay: boolean): void {
    this.heard = 0;
    this.lastTick = 0;
    if (!track) {
      this.audio.pause();
      this.set({ queue, isPlaying: false });
      return;
    }
    const changed = track.id !== this.state.current?.id;
    if (changed || !this.audio.src) {
      this.audio.src = this.srcOf(track);
      this.set({ queue, current: track, position: 0, duration: track.duration ?? 0, error: null });
      this.updateMediaMetadata(track);
      void bridge?.covers.seed(track.cover_url ?? '').then((seed) => {
        if (this.state.current?.id === track.id) setAmbientSeed(seed);
      });
    } else {
      this.audio.currentTime = 0;
      this.set({ queue, position: 0 });
    }
    if (autoplay) void this.audio.play().catch(() => this.set({ isPlaying: false }));
  }

  /** Bir bağlamı (çalma listesi, albüm, arama sonucu) belirli şarkıdan başlatır. */
  playList(tracks: readonly Track[], startIndex = 0, contextId: string | null = null): void {
    this.flushHistory();
    const queue = playContext(this.state.queue, tracks, startIndex, contextId);
    this.load(queue, currentTrack(queue), true);
  }

  toggle(): void {
    if (!this.state.current) return;
    if (this.audio.paused) void this.audio.play().catch(() => undefined);
    else this.audio.pause();
  }

  next(): void {
    this.flushHistory();
    const r = queueNext(this.state.queue);
    this.load(r.state, r.track, true);
  }

  previous(): void {
    const r = queuePrevious(this.state.queue, this.audio.currentTime);
    if (r.restart || r.track?.id === this.state.current?.id) {
      this.audio.currentTime = 0;
      return;
    }
    this.flushHistory();
    this.load(r.state, r.track, true);
  }

  seek(seconds: number): void {
    if (!this.state.current) return;
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.state.duration || seconds));
    this.set({ position: this.audio.currentTime });
    this.publish();
  }

  setVolume(v: number): void {
    this.audio.volume = Math.max(0, Math.min(1, v));
    this.audio.muted = false;
    localStorage.setItem(VOLUME_KEY, String(this.audio.volume));
    this.set({ volume: this.audio.volume, muted: false });
  }

  toggleMute(): void {
    this.audio.muted = !this.audio.muted;
    this.set({ muted: this.audio.muted });
  }

  toggleShuffle(): void {
    this.set({ queue: setShuffle(this.state.queue, !this.state.queue.shuffle) });
  }

  cycleRepeat(): void {
    this.set({ queue: cycleRepeat(this.state.queue) });
  }

  addToQueue(track: Track): void {
    this.set({ queue: enqueue(this.state.queue, track) });
  }

  playNextTrack(track: Track): void {
    this.set({ queue: queuePlayNext(this.state.queue, track) });
  }

  removeUpNext(index: number): void {
    this.set({ queue: removeFromUpNext(this.state.queue, index) });
  }

  upcoming(limit = 50): Track[] {
    return upcoming(this.state.queue, limit);
  }

  /** Jam: uzaktan gelen şarkı/konum; bağlamı değiştirmeden tek şarkı çalar. */
  playRemote(track: Track, position: number, playing: boolean): void {
    if (track.id !== this.state.current?.id) this.load(playContext(this.state.queue, [track], 0, 'jam'), track, playing);
    this.audio.currentTime = position;
    if (playing) void this.audio.play().catch(() => undefined);
    else this.audio.pause();
  }

  command(c: MiniCommand): void {
    if (c === 'toggle-play') this.toggle();
    else if (c === 'next') this.next();
    else if (c === 'previous') this.previous();
  }

  stop(): void {
    this.flushHistory();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.set({ queue: emptyQueue(), current: null, isPlaying: false, position: 0, duration: 0 });
  }

  /* ---------- Yan etkiler ---------- */
  private flushHistory(): void {
    const track = this.state.current;
    const acc = this.account;
    const seconds = this.heard;
    this.heard = 0;
    if (!track || !acc || !shouldRecordPlay(seconds, track.duration)) return;
    void recordPlay(acc.sb, { userId: acc.userId, songId: track.id, secondsPlayed: seconds, platform: 'desktop', contextId: this.state.queue.contextId }).catch(() => undefined);
  }

  snapshot(): PlayerSnapshot {
    const t = this.state.current;
    return {
      song: t ? { id: t.id, title: t.title, artist: t.artist, album: t.album, coverUrl: t.cover_url, duration: this.state.duration || t.duration || 0 } : null,
      isPlaying: this.state.isPlaying,
      position: this.audio.currentTime,
      at: Date.now(),
    };
  }

  private publish(): void {
    const snap = this.snapshot();
    bridge?.mini.publish(snap);
    bridge?.discord.setActivity(snap);
    if (navigator.mediaSession) navigator.mediaSession.playbackState = snap.song ? (snap.isPlaying ? 'playing' : 'paused') : 'none';
    // Arkadaş etkinliği: art arda değişimlerde tek yazım.
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.presenceTimer = setTimeout(() => {
      const acc = this.account;
      if (acc) void setNowPlaying(acc.sb, acc.userId, snap.song?.id ?? null, snap.isPlaying).catch(() => undefined);
    }, 1500);
  }

  private setupMediaSession(): void {
    const ms = navigator.mediaSession;
    if (!ms) return;
    ms.setActionHandler('play', () => this.toggle());
    ms.setActionHandler('pause', () => this.toggle());
    ms.setActionHandler('nexttrack', () => this.next());
    ms.setActionHandler('previoustrack', () => this.previous());
    ms.setActionHandler('seekto', (d) => d.seekTime !== undefined && this.seek(d.seekTime));
  }

  private updateMediaMetadata(t: Track): void {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album ?? '',
      artwork: t.cover_url ? [{ src: t.cover_url, sizes: '512x512' }] : [],
    });
  }
}

export const player = new Player();

export function usePlayer(): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}
