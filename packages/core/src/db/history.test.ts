import { describe, expect, it } from 'vitest';
import { artistRequestProblem } from './artist-requests';
import { shouldRecordPlay, summarizeListening, type PlayRow } from './history';

const motive = { id: 'a1', name: 'Motive' };
const uzi = { id: 'a2', name: 'UZİ' };
const sezen = { id: 'a3', name: 'Sezen Aksu' };
const song = (id: string, title: string, ...artists: Array<{ id: string; name: string }>) => ({
  id, title, duration: 200, song_artists: artists.map((artist, position) => ({ position, artist })),
});
const row = (hour: number, s: PlayRow['song'], seconds = 180): PlayRow => ({ played_at: `2026-03-01T${String(hour).padStart(2, '0')}:30:00Z`, seconds_played: seconds, song: s });
const utc = { hourOf: (d: Date) => d.getUTCHours() };

describe('dinleme sayılır mı', () => {
  it('30 saniye kuralı, kısa şarkılarda yarısı', () => {
    expect(shouldRecordPlay(29)).toBe(false);
    expect(shouldRecordPlay(30)).toBe(true);
    expect(shouldRecordPlay(20, 40)).toBe(true);
    expect(shouldRecordPlay(19, 40)).toBe(false);
    expect(shouldRecordPlay(30, 600)).toBe(true);
  });
});

describe('dinleme özeti', () => {
  const a = song('s1', 'Gece', motive, uzi);
  const b = song('s2', 'Yaz', sezen);
  const rows = [row(23, a), row(0, a), row(1, a), row(14, b), row(2, b, 120), row(22, null, 60)];
  const sum = summarizeListening(rows, utc);

  it('toplam süre ve çalma sayısı (silinmiş şarkı da süreye girer)', () => {
    expect(sum.plays).toBe(6);
    expect(sum.totalMinutes).toBe(Math.round((180 * 4 + 120 + 60) / 60));
  });
  it('en çok çalınan şarkılar ve sanatçılar; ortak şarkı iki sanatçıya da sayılır', () => {
    expect(sum.topSongs).toEqual([{ id: 's1', title: 'Gece', plays: 3 }, { id: 's2', title: 'Yaz', plays: 2 }]);
    expect(sum.topArtists.map((x) => [x.name, x.plays])).toEqual([['Motive', 3], ['UZİ', 3], ['Sezen Aksu', 2]]);
  });
  it('saat dağılımı ve dinleme kişiliği', () => {
    expect(sum.byHour).toHaveLength(24);
    expect(sum.byHour[23]).toBe(3);
    expect(sum.persona).toBe('gece-kusu');
    expect(sum.personaShare).toBe(Math.round(((180 * 3 + 120) / 60 / ((180 * 4 + 120 + 60) / 60)) * 100));
  });
  it('boş geçmiş', () => {
    expect(summarizeListening([], utc)).toMatchObject({ totalMinutes: 0, plays: 0, topSongs: [], persona: null, personaShare: 0 });
  });
});

describe('sanatçı başvurusu doğrulaması', () => {
  it.each([
    [{ artistName: '  ' }, 'Sanatçı adını yaz.'],
    [{ artistName: 'a'.repeat(81) }, 'Sanatçı adı en fazla 80 karakter olabilir.'],
    [{ artistName: 'Bant 9', links: ['http://ornek.com'] }, 'Bağlantılar https:// ile başlamalı.'],
    [{ artistName: 'Bant 9', links: Array(6).fill('https://a.com') }, 'En fazla 5 bağlantı ekleyebilirsin.'],
  ])('%j', (input, message) => expect(artistRequestProblem(input)).toBe(message));
  it('geçerli başvuru', () => {
    expect(artistRequestProblem({ artistName: 'Bant 9', message: 'Merhaba', links: ['https://open.spotify.com/artist/x'] })).toBeNull();
  });
});
