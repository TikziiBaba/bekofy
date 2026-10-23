import { describe, expect, it } from 'vitest';
import { artistSongProblem, audioProblem, MAX_AUDIO_BYTES } from './artist-songs';
import { containsPattern, DataError, likeExact, must, searchTerm, toDataError } from './errors';
import { formatJamCode, generateJamCode, JAM_CODE_ALPHABET, normalizeJamCode } from './jam';
import { activeLineIndex, fetchLyrics, parseLrc, storedLyrics } from './lyrics';
import { imageProblem } from './media';
import { isPremium, normalizeUsername, USERNAME_RULE } from './profiles';

describe('hatalar', () => {
  it('bilinen kodlar Türkçe açıklamaya çevrilir', () => {
    expect(toDataError({ code: '23505' }, 'Şarkı eklenemedi').message).toBe('Şarkı eklenemedi. Bu kayıt zaten var.');
    expect(toDataError({ code: '42501' }, 'Rol değiştirilemedi').message).toBe('Rol değiştirilemedi. Bu işlem için yetkin yok.');
    expect(toDataError({ message: 'TypeError: Failed to fetch' }, 'Şarkılar alınamadı').message).toContain('İnternetini kontrol et');
    expect(toDataError({ code: 'XX000', message: 'iç hata' }, 'Kaydedilemedi').message).toBe('Kaydedilemedi.');
  });
  it('must: veriyi açar, hatada ya da boş veride fırlatır', () => {
    expect(must({ data: [1], error: null }, 'x')).toEqual([1]);
    expect(() => must({ data: null, error: { code: '42501' } }, 'Okunamadı')).toThrow(DataError);
    expect(() => must({ data: null, error: null }, 'Okunamadı')).toThrow('Kayıt bulunamadı');
  });
  it('arama metni filtre sözdizimini bozamaz', () => {
    expect(searchTerm('  sezen,aksu)(%_*"  ')).toBe('sezen aksu');
    expect(searchTerm('title.eq.x')).toBe('title eq x');
    expect(searchTerm('a'.repeat(100)).length).toBe(64);
  });
  it('içerir araması: _ ve . korunur, jokerler kaçışlanır', () => {
    expect(containsPattern(' e2e_user.x ')).toBe('%e2e\\_user.x%');
    expect(containsPattern('100%')).toBe('%100\\%%');
    expect(containsPattern('  ')).toBeNull();
  });
  it('tam eşleşmede LIKE jokerleri kaçışlanır', () => {
    expect(likeExact('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
  });
});

describe('şarkı sözleri', () => {
  const lrc = '[ar:Deniz Ufku]\n[ti:Gündüz Düşleri]\n[00:07.50]Kahve soğuyor\n[00:00.00]Perdenin ardında ilk ışık\n[00:14.2][01:02.25]Nakarat\n\n[00:20]';
  it('LRC: bilgi etiketleri atlanır, çoklu damga açılır, sıralanır', () => {
    expect(parseLrc(lrc)).toEqual([
      { time: 0, text: 'Perdenin ardında ilk ışık' },
      { time: 7.5, text: 'Kahve soğuyor' },
      { time: 14.2, text: 'Nakarat' },
      { time: 20, text: '' },
      { time: 62.25, text: 'Nakarat' },
    ]);
  });
  it('LRC: offset uygulanır ve sıfırın altına düşmez', () => {
    expect(parseLrc('[offset:+500]\n[00:00.20]a\n[00:01.00]b').map((l) => l.time)).toEqual([0, 0.5]);
  });
  it('aktif satır (ikili arama)', () => {
    const lines = parseLrc(lrc);
    expect([-1, 0, 7.49, 7.5, 100].map((t) => activeLineIndex(lines, t))).toEqual([-1, 0, 0, 1, 4]);
    expect(activeLineIndex([], 5)).toBe(-1);
  });
  it('kayıtlı sözler', () => {
    expect(storedLyrics({ lyrics: null, synced_lyrics: null })).toBeNull();
    expect(storedLyrics({ lyrics: 'düz', synced_lyrics: '[00:01]a' })).toEqual({ plain: 'düz', synced: [{ time: 1, text: 'a' }] });
  });

  const song = { title: 'Yaz Sonu', artist: 'Ayaz Kaya', album: 'Ağustos', duration: 219 };
  const fakeFetch = (routes: Record<string, unknown>) => {
    const calls: string[] = [];
    const impl = async (url: string) => {
      calls.push(url);
      const key = Object.keys(routes).find((k) => url.includes(k));
      return key ? { ok: true, json: async () => routes[key] } : { ok: false, json: async () => null };
    };
    return { impl, calls };
  };
  it('lrclib: önce tam eşleşme denenir', async () => {
    const f = fakeFetch({ '/get?': { syncedLyrics: '[00:01]a', plainLyrics: 'a' } });
    expect(await fetchLyrics(song, f.impl)).toEqual({ plain: 'a', synced: [{ time: 1, text: 'a' }] });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toContain('album_name=A%C4%9Fustos');
  });
  it('lrclib: tam eşleşme yoksa aramada senkron sözlü sonuç seçilir', async () => {
    const f = fakeFetch({ 'search?track_name': [{ plainLyrics: 'düz' }, { syncedLyrics: '[00:02]b' }] });
    expect(await fetchLyrics(song, f.impl)).toEqual({ plain: null, synced: [{ time: 2, text: 'b' }] });
  });
  it('lrclib: hiçbir yerde yoksa ya da ağ hatasında null', async () => {
    expect(await fetchLyrics(song, fakeFetch({}).impl)).toBeNull();
    expect(await fetchLyrics(song, async () => { throw new Error('ağ yok'); })).toBeNull();
  });
});

describe('Jam kodu', () => {
  it('6 karakter, yalnız karışmayan harf ve rakamlar', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJamCode();
      expect(code).toMatch(new RegExp(`^[${JAM_CODE_ALPHABET}]{6}$`));
    }
    expect(JAM_CODE_ALPHABET).not.toMatch(/[01IO]/);
  });
  it('biçimleme ve kullanıcı girdisi', () => {
    expect(formatJamCode('K7Q2M4')).toBe('K7Q-2M4');
    expect(normalizeJamCode(' k7q-2m4 ')).toBe('K7Q2M4');
  });
});

describe('profil kuralları', () => {
  it('kullanıcı adı Türkçe kurala göre küçülür, kurala uyar', () => {
    expect(normalizeUsername('  IŞIL.Kaya ')).toBe('ışıl.kaya');
    expect(USERNAME_RULE.test('bekir_99')).toBe(true);
    expect(USERNAME_RULE.test('ışıl')).toBe(false);
    expect(USERNAME_RULE.test('ab')).toBe(false);
  });
  it('premium: role ya da is_premium, admin de sayılır', () => {
    expect(isPremium({ role: 'user', is_premium: true })).toBe(true);
    expect(isPremium({ role: 'premium', is_premium: false })).toBe(true);
    expect(isPremium({ role: 'yetkili', is_premium: false })).toBe(true);
    expect(isPremium({ role: 'user', is_premium: false })).toBe(false);
  });
});

describe('görsel denetimi', () => {
  it('tür ve boyut', () => {
    expect(imageProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(imageProblem({ type: 'image/gif', size: 1000 })).toContain('JPG, PNG ya da WebP');
    expect(imageProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toContain('5 MB');
  });
});

describe('sanatçı yüklemesi', () => {
  it('yalnızca MP3 kabul edilir; boyut sınırı uygulanır', () => {
    expect(audioProblem({ type: 'audio/mpeg', size: 5_000_000 })).toBeNull();
    expect(audioProblem({ type: 'audio/mp3', size: 5_000_000 })).toBeNull();
    expect(audioProblem({ type: '', size: 5_000_000, name: 'Şarkı.MP3' })).toBeNull();
    expect(audioProblem({ type: 'audio/wav', size: 5_000_000 })).toContain('MP3');
    expect(audioProblem({ type: 'audio/mpeg', size: MAX_AUDIO_BYTES + 1 })).toContain('30 MB');
    expect(audioProblem({ type: 'audio/mpeg', size: 0 })).toContain('boş');
  });
  it('alanlar denetlenir', () => {
    expect(artistSongProblem({ title: 'Yaz Sonu', duration: 219 })).toBeNull();
    expect(artistSongProblem({ title: '  ', duration: 219 })).toContain('adını');
    expect(artistSongProblem({ title: 'x'.repeat(201), duration: 219 })).toContain('200');
    expect(artistSongProblem({ title: 'A', genre: 'g'.repeat(61), duration: 219 })).toContain('Tür');
    expect(artistSongProblem({ title: 'A', duration: Number.NaN })).toContain('okunamadı');
    expect(artistSongProblem({ title: 'A', duration: 31 * 60 })).toContain('30 dakika');
  });
});
