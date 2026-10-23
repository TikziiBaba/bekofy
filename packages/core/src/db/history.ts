// Dinleme geçmişi: bir dinleme en az 30 saniye çalınınca yazılır. Son çalınanlar, dönemin en çokları ve Wrapped.

import type { BekofyClient } from '../client';
import type { Platform } from '../platform';
import { check, must } from './errors';
import { SONG_FIELDS, type SongSummary } from './songs';

/** Bir çalmanın geçmişe yazılması için gereken en kısa süre (saniye). */
export const MIN_PLAY_SECONDS = 30;

/** Kısa şarkılarda yarısı yeterli: 40 saniyelik şarkı 20 saniyede sayılır. */
export function shouldRecordPlay(secondsPlayed: number, durationSeconds?: number | null): boolean {
  const need = durationSeconds ? Math.min(MIN_PLAY_SECONDS, durationSeconds / 2) : MIN_PLAY_SECONDS;
  return secondsPlayed >= need;
}

export async function recordPlay(
  sb: BekofyClient,
  { userId, songId, secondsPlayed, platform, contextId = null }: { userId: string; songId: string; secondsPlayed: number; platform: Platform; contextId?: string | null },
): Promise<void> {
  check(
    await sb.from('listening_history').insert({
      user_id: userId,
      song_id: songId,
      seconds_played: Math.max(0, Math.min(86400, Math.round(secondsPlayed))),
      platform,
      context_id: contextId,
    }),
    'Dinleme kaydedilemedi',
  );
}

/** Son çalınan farklı şarkılar, en yeni başta. */
export async function recentlyPlayed(sb: BekofyClient, userId: string, limit = 20): Promise<SongSummary[]> {
  const rows = must(
    await sb.from('listening_history').select(`played_at, song:songs(${SONG_FIELDS})`).eq('user_id', userId).order('played_at', { ascending: false }).limit(limit * 4),
    'Son çalınanlar alınamadı',
  );
  const seen = new Set<string>();
  const out: SongSummary[] = [];
  for (const r of rows) {
    if (!r.song || seen.has(r.song.id)) continue;
    seen.add(r.song.id);
    out.push(r.song);
    if (out.length === limit) break;
  }
  return out;
}

/* ---------- Özet (Wrapped, "bu ay en çok dinlediklerin") ---------- */

export interface PlayRow {
  played_at: string;
  seconds_played: number;
  song: { id: string; title: string; duration: number | null; song_artists: Array<{ position: number; artist: { id: string; name: string } | null }> } | null;
}

export interface ListeningSummary {
  totalMinutes: number;
  plays: number;
  topSongs: Array<{ id: string; title: string; plays: number }>;
  topArtists: Array<{ id: string; name: string; plays: number; minutes: number }>;
  /** 0-23 saat dilimine göre dinleme dakikası (yerel saat). */
  byHour: number[];
  /** Dinlemelerin en yoğun olduğu dilim; dinleme kişiliği için. */
  persona: 'gece-kusu' | 'sabahci' | 'gunduz' | 'aksamci' | null;
  /** O dilimdeki dinlemelerin yüzdesi (0-100). */
  personaShare: number;
}

const PERSONA_SLOTS: Array<[ListeningSummary['persona'] & string, number[]]> = [
  ['gece-kusu', [23, 0, 1, 2, 3, 4]],
  ['sabahci', [5, 6, 7, 8, 9, 10]],
  ['gunduz', [11, 12, 13, 14, 15, 16]],
  ['aksamci', [17, 18, 19, 20, 21, 22]],
];

/** Saf özet: geçmiş satırlarından toplam süre, en çok çalınanlar, saat dağılımı. Saat dilimi dışarıdan verilir. */
export function summarizeListening(rows: readonly PlayRow[], { top = 5, hourOf = (d: Date) => d.getHours() } = {}): ListeningSummary {
  const songs = new Map<string, { id: string; title: string; plays: number }>();
  const artists = new Map<string, { id: string; name: string; plays: number; minutes: number }>();
  const byHour = new Array<number>(24).fill(0);
  let seconds = 0;
  for (const row of rows) {
    seconds += row.seconds_played;
    byHour[hourOf(new Date(row.played_at))]! += row.seconds_played / 60;
    if (!row.song) continue;
    const s = songs.get(row.song.id) ?? { id: row.song.id, title: row.song.title, plays: 0 };
    s.plays += 1;
    songs.set(s.id, s);
    for (const link of row.song.song_artists) {
      if (!link.artist) continue;
      const a = artists.get(link.artist.id) ?? { id: link.artist.id, name: link.artist.name, plays: 0, minutes: 0 };
      a.plays += 1;
      a.minutes += row.seconds_played / 60;
      artists.set(a.id, a);
    }
  }
  const totalMinutesExact = seconds / 60;
  const slots = PERSONA_SLOTS.map(([name, hours]) => [name, hours.reduce((sum, h) => sum + (byHour[h] ?? 0), 0)] as const);
  const [personaName, personaMinutes] = slots.reduce((a, b) => (b[1] > a[1] ? b : a));
  const byPlays = <T extends { plays: number }>(a: T, b: T) => b.plays - a.plays;
  return {
    totalMinutes: Math.round(totalMinutesExact),
    plays: rows.length,
    topSongs: [...songs.values()].sort(byPlays).slice(0, top),
    topArtists: [...artists.values()].sort((a, b) => b.plays - a.plays || b.minutes - a.minutes).slice(0, top).map((a) => ({ ...a, minutes: Math.round(a.minutes) })),
    byHour: byHour.map((m) => Math.round(m)),
    persona: totalMinutesExact > 0 ? personaName : null,
    personaShare: totalMinutesExact > 0 ? Math.round((personaMinutes / totalMinutesExact) * 100) : 0,
  };
}

/** Kullanıcının [from, to) aralığındaki dinlemeleri. Büyük aralıklarda sayfa sayfa okur. */
export async function listeningRows(sb: BekofyClient, userId: string, from: Date, to: Date): Promise<PlayRow[]> {
  const pageSize = 1000;
  const out: PlayRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = must(
      await sb.from('listening_history')
        .select('played_at, seconds_played, song:songs(id, title, duration, song_artists(position, artist:artists(id, name)))')
        .eq('user_id', userId).gte('played_at', from.toISOString()).lt('played_at', to.toISOString())
        .order('played_at').range(offset, offset + pageSize - 1),
      'Dinleme geçmişi alınamadı',
    );
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

/** Takvim yılının özeti (Wrapped). */
export async function yearSummary(sb: BekofyClient, userId: string, year: number): Promise<ListeningSummary> {
  return summarizeListening(await listeningRows(sb, userId, new Date(year, 0, 1), new Date(year + 1, 0, 1)));
}

/** Son 30 günün özeti ("bu ay en çok dinlediklerin"). */
export async function recentSummary(sb: BekofyClient, userId: string, days = 30, now = new Date()): Promise<ListeningSummary> {
  return summarizeListening(await listeningRows(sb, userId, new Date(now.getTime() - days * 86400000), now));
}
