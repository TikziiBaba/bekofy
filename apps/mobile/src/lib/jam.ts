// Jam: oturum sahibinin oynatıcısı herkeste aynı anda ilerler. Sahip olayları yayınlar, katılımcılar uygular.
// Sonradan katılan, oturumun veritabanındaki son durumuyla başlar. Ekrandan çıkınca Jam sürer.

import { endJam, findJamByCode, getSong, leaveJam, openJamChannel, updateJamState, type JamChannel, type JamSession } from '@bekofy/core';
import { useSyncExternalStore } from 'react';
import { player, type PlayerState, type Track } from './player';
import { sb } from './supabase';

/** Eski sürüm sahip yayından hemen sonra veritabanına yazar; okumadan önce bu kadar beklenir. */
const DB_SETTLE_MS = 800;

interface JamState {
  session: JamSession | null;
  isHost: boolean;
  connected: boolean;
}

let state: JamState = { session: null, isHost: false, connected: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<JamState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let channel: JamChannel | null = null;
let stopFollowing: (() => void) | null = null;
let userId: string | null = null;

async function applyRemote(songId: string, position: number, playing: boolean): Promise<void> {
  const s = player.getState();
  const track: Track = s.current?.id === songId ? s.current : await getSong(sb, songId);
  // İki saniyeden az fark varsa dokunma (takılma olmasın).
  const drift = Math.abs(s.position - position);
  if (s.current?.id !== songId || drift > 2 || s.isPlaying !== playing) await player.playRemote(track, position, playing);
}

/** Katılımcı: oturumun veritabanındaki son durumuna geç (çalıyorsa yazıldığından beri geçen süre kadar ileri). */
async function applySession(session: JamSession): Promise<void> {
  if (!session.current_song_id) return;
  const elapsed = session.is_playing ? Math.max(0, (Date.now() - new Date(session.updated_at).getTime()) / 1000) : 0;
  await applyRemote(session.current_song_id, session.current_position + elapsed, session.is_playing);
}

/** Katılımcı: şarkısı belirsiz bir olay geldi (eski sürüm sahip); son durumu veritabanından al. */
async function resync(): Promise<void> {
  const code = state.session?.code;
  if (!code) return;
  await new Promise((r) => setTimeout(r, DB_SETTLE_MS));
  const fresh = await findJamByCode(sb, code).catch(() => null);
  if (fresh && fresh.id === state.session?.id) await applySession(fresh);
}

/** Sahip: oynatıcı değiştikçe yayınla ve veritabanına yaz. */
function followHostPlayer(sessionId: string): () => void {
  const save = (s: PlayerState) => void updateJamState(sb, sessionId, { songId: s.current?.id ?? null, isPlaying: s.isPlaying, position: s.position }).catch(() => undefined);
  const first = player.getState();
  // Jam açılırken çalan (ya da duraklatılmış) şarkı hemen yazılır: koda sonradan katılan onunla başlar.
  if (first.current) save(first);
  let last = { id: first.current?.id ?? null, playing: first.isPlaying, position: first.position };
  return player.subscribe(() => {
    const s = player.getState();
    const id = s.current?.id ?? null;
    const song = id ? { songId: id } : {};
    const jumped = Math.abs(s.position - last.position) > 3;
    if (id !== last.id && id) channel?.sync({ type: 'track', songId: id, position: s.position, isPlaying: s.isPlaying });
    else if (s.isPlaying !== last.playing) channel?.sync({ type: s.isPlaying ? 'play' : 'pause', position: s.position, ...song });
    else if (jumped) channel?.sync({ type: 'seek', position: s.position, ...song });
    else {
      last.position = s.position;
      return;
    }
    last = { id, playing: s.isPlaying, position: s.position };
    save(s);
  });
}

export async function enterJam(uid: string, session: JamSession): Promise<void> {
  await leaveCurrent(false);
  userId = uid;
  const isHost = session.host_id === uid;
  set({ session, isHost, connected: false });
  channel = openJamChannel(sb, session.id, {
    onStatus: (ready) => set({ connected: ready }),
    onSync: (e) => {
      if (state.isHost || e.type === 'queue') return;
      const s = player.getState();
      const lag = Math.max(0, (Date.now() - e.at) / 1000);
      if (e.type === 'track') return void applyRemote(e.songId, e.position + (e.isPlaying ? lag : 0), e.isPlaying);
      // Şarkısı olmayan (yeni katılmış) katılımcı da çal/duraklat/sar olayıyla doğru şarkıya geçer.
      const songId = e.songId ?? s.current?.id;
      if (!songId) return void resync();
      if (e.type === 'play') void applyRemote(songId, e.position + lag, true);
      else if (e.type === 'pause') void applyRemote(songId, e.position, false);
      // Sarma olayı sahibin çalıp çalmadığını taşımaz: şarkı farklıysa tam durum veritabanından alınır.
      else if (s.current?.id !== songId) void resync();
      else player.seek(e.position + (s.isPlaying ? lag : 0));
    },
  });
  if (isHost) stopFollowing = followHostPlayer(session.id);
  else await applySession(session);
}

async function leaveCurrent(announce: boolean): Promise<void> {
  stopFollowing?.();
  stopFollowing = null;
  channel?.close();
  channel = null;
  const s = state.session;
  if (s && userId && announce) {
    if (state.isHost) await endJam(sb, s.id).catch(() => undefined);
    else await leaveJam(sb, s.id, userId).catch(() => undefined);
  }
  set({ session: null, isHost: false, connected: false });
}

/** Sahip için Jam'i bitirir, katılımcı için ayrılır. */
export const exitJam = () => leaveCurrent(true);

export function useJam(): JamState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
