// Jam: birlikte dinleme oturumları. Durum veritabanında, anlık eşitleme realtime yayın kanalında.

import type { BekofyClient } from '../client';
import type { Rng } from '../player/queue';
import type { Tables } from './database.types';
import { check, DataError, must } from './errors';

export type JamSession = Tables<'jam_sessions'>;

/** Karışmayan karakterler (0/O, 1/I yok). */
export const JAM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJamCode(rng: Rng = Math.random): string {
  return Array.from({ length: 6 }, () => JAM_CODE_ALPHABET[Math.floor(rng() * JAM_CODE_ALPHABET.length)]).join('');
}

/** Ekranda okunaklı gösterim: "K7Q2M4" -> "K7Q-2M4". */
export const formatJamCode = (code: string): string => `${code.slice(0, 3)}-${code.slice(3)}`;

/** Kullanıcının yazdığı kodu standartlaştırır: boşluk ve tire atılır, büyük harfe çevrilir. */
export const normalizeJamCode = (input: string): string => input.replace(/[\s-]/g, '').toUpperCase();

/** Oturum açar; kod çakışırsa yeni kodla en çok 3 kez dener. Oturum sahibi katılımcı olarak eklenir. */
export async function createJam(sb: BekofyClient, hostId: string, rng: Rng = Math.random): Promise<JamSession> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await sb.from('jam_sessions').insert({ code: generateJamCode(rng), host_id: hostId }).select('*').single();
    if (res.error?.code === '23505') continue;
    const session = must(res, 'Jam başlatılamadı');
    check(await sb.from('jam_participants').insert({ session_id: session.id, user_id: hostId }), 'Jam başlatılamadı');
    return session;
  }
  throw new DataError('Jam başlatılamadı. Tekrar dene.');
}

export async function findJamByCode(sb: BekofyClient, input: string): Promise<JamSession | null> {
  const code = normalizeJamCode(input);
  if (code.length !== 6) return null;
  const res = await sb.from('jam_sessions').select('*').eq('code', code).maybeSingle();
  if (res.error) must(res, 'Jam bulunamadı');
  return res.data;
}

export async function joinJam(sb: BekofyClient, sessionId: string, userId: string): Promise<void> {
  check(await sb.from('jam_participants').upsert({ session_id: sessionId, user_id: userId }, { onConflict: 'session_id,user_id', ignoreDuplicates: true }), "Jam'e katılınamadı");
}

export async function leaveJam(sb: BekofyClient, sessionId: string, userId: string): Promise<void> {
  check(await sb.from('jam_participants').delete().eq('session_id', sessionId).eq('user_id', userId), "Jam'den çıkılamadı");
}

/** Yalnızca oturum sahibi: oturum ve katılımcılar silinir. */
export async function endJam(sb: BekofyClient, sessionId: string): Promise<void> {
  check(await sb.from('jam_sessions').delete().eq('id', sessionId), 'Jam bitirilemedi');
}

export async function updateJamState(sb: BekofyClient, sessionId: string, state: { songId: string | null; isPlaying: boolean; position: number }): Promise<void> {
  check(
    await sb.from('jam_sessions').update({ current_song_id: state.songId, is_playing: state.isPlaying, current_position: state.position, updated_at: new Date().toISOString() }).eq('id', sessionId),
    'Jam durumu güncellenemedi',
  );
}

/** Katılımcılar ve profilleri (jam_participants auth.users'a bağlı olduğundan iki adımda). */
export async function jamParticipants(sb: BekofyClient, sessionId: string) {
  const rows = must(await sb.from('jam_participants').select('user_id, joined_at').eq('session_id', sessionId).order('joined_at'), 'Katılımcılar alınamadı');
  const ids = rows.flatMap((r) => (r.user_id ? [r.user_id] : []));
  if (!ids.length) return [];
  const profiles = must(await sb.from('profiles').select('id, username, avatar_url').in('id', ids), 'Katılımcılar alınamadı');
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const p = r.user_id ? byId.get(r.user_id) : undefined;
    return p ? [{ ...p, joined_at: r.joined_at }] : [];
  });
}

/* ---------- Anlık eşitleme ---------- */

/**
 * play/pause/seek, çalan şarkıyı da taşır: henüz şarkısı olmayan (yeni katılmış) katılımcı da doğru şarkıyı başlatır.
 * Eski sürüm sahipler songId göndermez; katılımcı o zaman oturumun veritabanındaki son durumuna bakar.
 */
export type JamSync =
  | { type: 'track'; songId: string; position: number; isPlaying: boolean }
  | { type: 'play'; position: number; songId?: string }
  | { type: 'pause'; position: number; songId?: string }
  | { type: 'seek'; position: number; songId?: string }
  | { type: 'queue'; songIds: string[] };

export type JamMessage = { type: 'chat'; userId: string; text: string };

export interface JamChannel {
  sync(event: JamSync): void;
  chat(userId: string, text: string): void;
  close(): void;
}

/** Oturumun yayın kanalına bağlanır. Kendi gönderdiğin olaylar sana geri gelmez. */
export function openJamChannel(
  sb: BekofyClient,
  sessionId: string,
  handlers: { onSync(event: JamSync & { at: number }): void; onChat?(message: JamMessage & { at: number }): void; onStatus?(ready: boolean): void },
): JamChannel {
  const channel = sb.channel(`jam:${sessionId}`, { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'jam_sync' }, ({ payload }) => handlers.onSync(payload as JamSync & { at: number }))
    .on('broadcast', { event: 'jam_chat' }, ({ payload }) => handlers.onChat?.(payload as JamMessage & { at: number }))
    .subscribe((status) => handlers.onStatus?.(status === 'SUBSCRIBED'));
  return {
    sync: (event) => void channel.send({ type: 'broadcast', event: 'jam_sync', payload: { ...event, at: Date.now() } }),
    chat: (userId, text) => void channel.send({ type: 'broadcast', event: 'jam_chat', payload: { type: 'chat', userId, text: text.slice(0, 500), at: Date.now() } }),
    close: () => void sb.removeChannel(channel),
  };
}
