import { describe, expect, it } from 'vitest';
import { parseEnv } from './config';
import { HttpError } from './errors';
import { hostAllowed, originStatus } from './http';
import { overallPercent, parseImportRequest, suggestionFor } from './importer';
import { decodeImageDataUrl } from './media';
import { explainYtDlpError, parseProgressLine, videoProblem, type VideoInfo } from './ytdlp';

const info = (over: Partial<VideoInfo> = {}): VideoInfo => ({
  id: 'dQw4w9WgXcQ', title: 'Ayaz Kaya - Yaz Sonu (Official Audio)', channel: 'Ayaz Kaya', duration: 219, thumbnail: null,
  isLive: false, track: null, artist: null, album: null, ...over,
});

describe('yt-dlp çıktısı', () => {
  it('ilerleme satırları', () => {
    expect(parseProgressLine('BKF 512/1024')).toEqual({ kind: 'download', ratio: 0.5 });
    expect(parseProgressLine('BKF 2048/1024')).toEqual({ kind: 'download', ratio: 1 });
    expect(parseProgressLine('BKF 10/NA')).toBeNull();
    expect(parseProgressLine('[ExtractAudio] Destination: x/audio.mp3')).toEqual({ kind: 'convert' });
    expect(parseProgressLine('[ThumbnailsConvertor] Converting thumbnail')).toEqual({ kind: 'thumbnail' });
    expect(parseProgressLine('[youtube] Extracting URL')).toBeNull();
  });
  it('hatalar Türkçeye çevrilir', () => {
    expect(explainYtDlpError('ERROR: [youtube] x: Private video. Sign in')).toBe('Gizli videolar içe aktarılamaz.');
    expect(explainYtDlpError('ERROR: [youtube] x: Video unavailable')).toBe('Video bulunamadı ya da kaldırılmış.');
    expect(explainYtDlpError("ERROR: Sign in to confirm you're not a bot")).toContain('robot');
    expect(explainYtDlpError('ERROR: tuhaf bir şey')).toBe("YouTube'dan alınamadı. (tuhaf bir şey)");
  });
  it('şarkı olarak eklenemeyen videolar', () => {
    expect(videoProblem(info())).toBeNull();
    expect(videoProblem(info({ isLive: true }))).toContain('Canlı');
    expect(videoProblem(info({ duration: 0 }))).toContain('süresi okunamadı');
    expect(videoProblem(info({ duration: 21 * 60 }))).toContain('20 dakikadan uzun');
  });
});

describe('öneri', () => {
  it('YouTube Music bilgisi varsa onu kullanır, çoklu sanatçıyı ayırır', () => {
    expect(suggestionFor(info({ track: 'Gece', artist: 'Motive, UZİ', album: 'Albüm' }))).toEqual({ title: 'Gece', artists: ['Motive', 'UZİ'], album: 'Albüm' });
  });
  it('yoksa başlığı "Sanatçı - Şarkı" olarak ayırır', () => {
    expect(suggestionFor(info())).toEqual({ title: 'Yaz Sonu', artists: ['Ayaz Kaya'], album: null });
  });
});

describe('içe aktarma isteği', () => {
  const valid = { url: 'https://youtu.be/dQw4w9WgXcQ', title: ' Yaz Sonu ', artists: ['Ayaz Kaya', ' Selin Aras'], album: '' };
  it('geçerli istek temizlenir, varsayılan kapak YouTube', () => {
    expect(parseImportRequest(valid)).toEqual({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Yaz Sonu', artists: ['Ayaz Kaya', 'Selin Aras'], album: null, cover: { kind: 'youtube' } });
  });
  it.each([
    [null, 'İstek gövdesi okunamadı.'],
    [{ ...valid, url: 'https://vimeo.com/1' }, 'Bu bir YouTube bağlantısı değil'],
    [{ ...valid, title: '  ' }, 'Şarkı adı boş olamaz.'],
    [{ ...valid, title: 'a'.repeat(201) }, 'en fazla 200'],
    [{ ...valid, artists: [] }, 'En az bir sanatçı yaz.'],
    [{ ...valid, artists: Array(6).fill('a') }, 'En fazla 5 sanatçı'],
    [{ ...valid, artists: ['a', 3] }, 'Sanatçı adı metin olmalı.'],
    [{ ...valid, cover: { kind: 'baska' } }, 'Kapak seçimi geçersiz.'],
  ])('%j', (body, message) => {
    expect(() => parseImportRequest(body)).toThrow(HttpError);
    expect(() => parseImportRequest(body)).toThrow(message);
  });
  it('genel yüzde aşamalara bölünür', () => {
    expect([overallPercent('download', 0), overallPercent('download', 0.5), overallPercent('convert', 0), overallPercent('upload', 1), overallPercent('save', 1)]).toEqual([0, 30, 60, 95, 100]);
  });
});

describe('güvenlik yardımcıları', () => {
  it('Host yalnızca localhost', () => {
    expect(hostAllowed('127.0.0.1:4317', 4317)).toBe(true);
    expect(hostAllowed('localhost:4317', 4317)).toBe(true);
    expect(hostAllowed('evil.example:4317', 4317)).toBe(false);
    expect(hostAllowed('127.0.0.1:80', 4317)).toBe(false);
    expect(hostAllowed(undefined, 4317)).toBe(false);
  });
  it('Origin izin listesi', () => {
    const allowed = ['https://bekofy.bekirr.dev'];
    expect(originStatus(undefined, allowed)).toBe('none');
    expect(originStatus('https://bekofy.bekirr.dev', allowed)).toBe('allowed');
    expect(originStatus('https://bekofy.bekirr.dev.evil.com', allowed)).toBe('denied');
  });
  it('kapak görseli: tür ve boyut', () => {
    expect(decodeImageDataUrl(`data:image/png;base64,${Buffer.from('abc').toString('base64')}`).bytes.toString()).toBe('abc');
    expect(() => decodeImageDataUrl('data:text/html;base64,PHA+')).toThrow('JPG, PNG ya da WebP');
    expect(() => decodeImageDataUrl(`data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`)).toThrow('5 MB');
    expect(() => decodeImageDataUrl('bozuk')).toThrow('okunamadı');
  });
  it('.env okuyucu', () => {
    expect(parseEnv('# yorum\nA=1\nB = "iki" \nC=\'üç\'\nbozuk satır')).toEqual({ A: '1', B: 'iki', C: 'üç' });
  });
});
