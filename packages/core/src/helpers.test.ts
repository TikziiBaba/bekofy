import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, formatRelative, formatTotalDuration, parseDuration } from './format/time';
import { publicUrl, songAudioPath, songCoverPath } from './media/paths';
import { cleanChannelName, parseYouTubeLink, parseYouTubeTitle } from './media/youtube';
import { joinArtistNames, splitArtistNames } from './text/artists';
import { slugify } from './text/slug';

describe('sanatçı adları', () => {
  it.each([
    ['Motive, UZİ', ['Motive', 'UZİ']],
    ['Sezen Aksu & Tarkan', ['Sezen Aksu', 'Tarkan']],
    ['Ayaz Kaya feat. Selin Aras', ['Ayaz Kaya', 'Selin Aras']],
    ['Ayaz Kaya ft Selin Aras', ['Ayaz Kaya', 'Selin Aras']],
    ['Kafthan', ['Kafthan']],
    ['A, a, , B', ['A', 'B']],
  ])('%s', (text, names) => expect(splitArtistNames(text)).toEqual(names));
  it('birleştirme', () => expect(joinArtistNames([' Motive', 'UZİ ', ''])).toBe('Motive, UZİ'));
});

describe('slugify', () => {
  it.each([
    ['Ağustos Böceği', 'agustos-bocegi'],
    ['IŞIK İÇİN', 'isik-icin'],
    ['Çatı Katı', 'cati-kati'],
    ['Şarkı: "Gündüz Düşleri" (2026)', 'sarki-gunduz-dusleri-2026'],
    ['  --Kâr  Hâlâ--  ', 'kar-hala'],
    ['Beyoncé & Jay-Z', 'beyonce-jay-z'],
  ])('%s -> %s', (input, out) => expect(slugify(input)).toBe(out));

  it('boş ya da yalnız simge girdide yedek ad verir', () => {
    expect(slugify('')).toBe('adsiz');
    expect(slugify('!!!')).toBe('adsiz');
  });

  it('uzunluğu sınırlar ve sonda tire bırakmaz', () => {
    const s = slugify('a'.repeat(79) + ' b', { maxLength: 80 });
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('parseYouTubeLink', () => {
  const ok = (url: string) => parseYouTubeLink(url);
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  ])('kabul: %s', (url) => {
    expect(ok(url)).toEqual({ ok: true, videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['https://vimeo.com/123', 'not-youtube'],
    ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'not-youtube'],
    ['ht!tp://??', 'not-youtube'],
    ['https://www.youtube.com/playlist?list=PL123', 'playlist'],
    ['https://www.youtube.com/watch?v=kisa', 'no-video-id'],
    ['https://www.youtube.com/@kanal', 'no-video-id'],
  ])('ret: %s -> %s', (url, reason) => expect(ok(url)).toEqual({ ok: false, reason }));
});

describe('parseYouTubeTitle', () => {
  it.each([
    ['Ayaz Kaya - Yaz Sonu (Official Audio)', '', { artist: 'Ayaz Kaya', title: 'Yaz Sonu' }],
    ['Deniz Ufku – Gündüz Düşleri [Official Video]', '', { artist: 'Deniz Ufku', title: 'Gündüz Düşleri' }],
    ['Bant 9 - Lacivert (Lyrics) | Official Channel', '', { artist: 'Bant 9', title: 'Lacivert' }],
    ['Saat Üç (Resmi Klip)', 'Bant 9 - Topic', { artist: 'Bant 9', title: 'Saat Üç' }],
    ['Mektup', 'GecePostasiVEVO', { artist: 'GecePostasi', title: 'Mektup' }],
    ['Kâr-Zarar (Remastered 2024)', 'Selin Aras', { artist: 'Selin Aras', title: 'Kâr-Zarar' }],
  ])('%s', (raw, channel, out) => expect(parseYouTubeTitle(raw, channel)).toEqual(out));

  it('kanal adını temizler', () => {
    expect(cleanChannelName('Lale Kıyısı - Topic')).toBe('Lale Kıyısı');
    expect(cleanChannelName('Kuzey Ekspresi Official')).toBe('Kuzey Ekspresi');
  });
});

describe('R2 yolları', () => {
  const input = { artist: 'Ayaz Kaya', title: 'Ağustos Böceği', uniqueId: 'dQw4w9WgXcQ' };
  it('ses ve kapak aynı sanatçı klasöründe, Türkçe karakterler katlanmış', () => {
    expect(songAudioPath(input)).toBe('music/ayaz-kaya/agustos-bocegi-dqw4w9wgxcq.mp3');
    expect(songCoverPath(input, '.PNG')).toBe('music/ayaz-kaya/covers/agustos-bocegi-dqw4w9wgxcq.png');
  });
  it('aynı adlı iki şarkı farklı yola yazılır', () => {
    expect(songAudioPath({ ...input, uniqueId: 'a1' })).not.toBe(songAudioPath({ ...input, uniqueId: 'b2' }));
  });
  it('genel adres', () => {
    expect(publicUrl('https://cdn.ornek.com/', '/music/a.mp3')).toBe('https://cdn.ornek.com/music/a.mp3');
    expect(publicUrl('cdn.ornek.com', 'music/a.mp3')).toBe('https://cdn.ornek.com/music/a.mp3');
  });
});

describe('zaman biçimleri', () => {
  it('süre', () => {
    expect(formatDuration(214)).toBe('3:34');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(5.9)).toBe('0:05');
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
  it('süre çözme', () => {
    expect(parseDuration('3:34')).toBe(214);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('3.34')).toBeNull();
    expect(parseDuration('a:b')).toBeNull();
  });
  it('toplam süre', () => {
    expect(formatTotalDuration(1380)).toBe('23 dk');
    expect(formatTotalDuration(3900)).toBe('1 sa 5 dk');
    expect(formatTotalDuration(7200)).toBe('2 sa');
  });
  it('göreli zaman', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    const ago = (s: number) => formatRelative(new Date(now.getTime() - s * 1000), now);
    expect([ago(10), ago(240), ago(3 * 3600), ago(2 * 86400), ago(15 * 86400)]).toEqual(['Şimdi', '4 dk', '3 sa', '2 g', '2 hf']);
  });
  it('sayı', () => expect(formatCount(412380)).toBe('412.380'));
});
