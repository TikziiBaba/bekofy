// Jam: oturum sahibinin oynatıcısı herkeste aynı anda ilerler. Sahip olayları yayınlar, katılımcılar uygular.
// Sonradan katılan, oturumun veritabanındaki son durumuyla başlar. Sayfadan çıkınca Jam sürer.

import { endJam, getSong, leaveJam, openJamChannel, updateJamState, type BekofyClient, type JamChannel, type JamSession } from '@bekofy/core';
import { useSyncExternalStore } from 'react';
import { player, type Track } from './player';

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
let ctx: { sb: BekofyClient; userId: string } | null = null;

async function applyRemote(sb: BekofyClient, songId: string, position: number, playing: boolean): Promise<void> {
  const current = player.getState().current;
  const track: Track = current?.id === songId ? current : await getSong(sb, songId);
  // Ağ gecikmesi kadar ileri sar; iki saniyeden az fark varsa dokunma (takılma olmasın).
  const drift = Math.abs(player.getState().position - position);
  if (current?.id !== songId || drift > 2 || player.getState().isPlaying !== playing) player.playRemote(track, position, playing);
}

/** Sahip: oynatıcı değiştikçe yayınla ve veritabanına yaz. */
function followHostPlayer(sb: BekofyClient, sessionId: string): () => void {
  let last = { id: player.getState().current?.id ?? null, playing: player.getState().isPlaying, position: player.getState().position };
  return player.subscribe(() => {
    const s = player.getState();
    const id = s.current?.id ?? null;
    const jumped = Math.abs(s.position - last.position) > 3;
    if (id !== last.id && id) channel?.sync({ type: 'track', songId: id, position: s.position, isPlaying: s.isPlaying });
    else if (s.isPlaying !== last.playing) channel?.sync({ type: s.isPlaying ? 'play' : 'pause', position: s.position });
    else if (jumped) channel?.sync({ type: 'seek', position: s.position });
    else {
      last.position = s.position;
      return;
    }
    last = { id, playing: s.isPlaying, position: s.position };
    void updateJamState(sb, sessionId, { songId: id, isPlaying: s.isPlaying, position: s.position }).catch(() => undefined);
  });
}

export async function enterJam(sb: BekofyClient, userId: string, session: JamSession): Promise<void> {
  await leaveCurrent(false);
  ctx = { sb, userId };
  const isHost = session.host_id === userId;
  set({ session, isHost, connected: false });
  channel = openJamChannel(sb, session.id, {
    onStatus: (ready) => set({ connected: ready }),
    onSync: (e) => {
      if (state.isHost) return;
      const s = player.getState();
      const lag = Math.max(0, (Date.now() - e.at) / 1000);
      if (e.type === 'track') void applyRemote(sb, e.songId, e.position + (e.isPlaying ? lag : 0), e.isPlaying);
      else if (e.type === 'play' && s.current) player.playRemote(s.current, e.position + lag, true);
      else if (e.type === 'pause' && s.current) player.playRemote(s.current, e.position, false);
      else if (e.type === 'seek' && s.current) player.seek(e.position + (s.isPlaying ? lag : 0));
    },
  });
  if (isHost) stopFollowing = followHostPlayer(sb, session.id);
  else if (session.current_song_id) {
    const elapsed = session.is_playing ? (Date.now() - new Date(session.updated_at).getTime()) / 1000 : 0;
    await applyRemote(sb, session.current_song_id, session.current_position + elapsed, session.is_playing);
  }
}

async function leaveCurrent(announce: boolean): Promise<void> {
  stopFollowing?.();
  stopFollowing = null;
  channel?.close();
  channel = null;
  const s = state.session;
  if (s && ctx && announce) {
    if (state.isHost) await endJam(ctx.sb, s.id).catch(() => undefined);
    else await leaveJam(ctx.sb, s.id, ctx.userId).catch(() => undefined);
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
