import { describe, expect, it } from 'vitest';
import { ownsKey, uploadKeys } from './artist-upload';
import { pickDownloads } from './releases';
import { safeNext } from './safe-next';
import { emailProblem, newPasswordProblem } from './validate';

describe('girişten sonra yönlendirme', () => {
  it('yalnızca site içi yollar', () => {
    expect(safeNext('/admin/songs?status=pending')).toBe('/admin/songs?status=pending');
    expect(safeNext(null)).toBe('/account');
    expect(safeNext('https://kotu.site')).toBe('/account');
    expect(safeNext('//kotu.site')).toBe('/account');
    expect(safeNext('/\\kotu.site')).toBe('/account');
    expect(safeNext('/a\nb')).toBe('/account');
    expect(safeNext('javascript:alert(1)')).toBe('/account');
  });
});

describe('indirme bağlantıları', () => {
  it('exe ve apk seçilir, sürüm dosya adından okunur', () => {
    const d = pickDownloads({
      tag_name: 'ota',
      assets: [
        { name: 'Bekofy.Setup.1.4.1.exe.blockmap', browser_download_url: 'https://x/b', size: 1 },
        { name: 'Bekofy.Setup.1.4.1.exe', browser_download_url: 'https://x/exe', size: 158_000_000 },
        { name: 'latest.yml', browser_download_url: 'https://x/y', size: 1 },
      ],
    });
    expect(d).toEqual({ version: '1.4.1', windowsUrl: 'https://x/exe', androidUrl: null, sizeMb: 158 });
  });
  it('yanıt yoksa sürüm sayfasına düşer', () => {
    expect(pickDownloads(null).windowsUrl).toContain('/releases/latest');
  });
});

describe('sanatçı yükleme yolları', () => {
  const { audioKey, coverKey } = uploadKeys('Ayaz Kaya', 'Yaz Sonu', '3f2a9c1e-77aa-4b1c-9e0d-1234567890ab', 'image/png');
  it('yollar sanatçı klasöründe ve benzersiz', () => {
    expect(audioKey).toMatch(/^music\/ayaz-kaya\/yaz-sonu-[a-z0-9-]+\.mp3$/);
    expect(coverKey).toMatch(/^music\/ayaz-kaya\/covers\/yaz-sonu-[a-z0-9-]+\.png$/);
  });
  it('başka sanatçının ya da biçimsiz yol reddedilir', () => {
    expect(ownsKey('Ayaz Kaya', audioKey, 'audio')).toBe(true);
    expect(ownsKey('Ayaz Kaya', coverKey!, 'cover')).toBe(true);
    expect(ownsKey('Selin Aras', audioKey, 'audio')).toBe(false);
    expect(ownsKey('Ayaz Kaya', 'music/ayaz-kaya/../selin/x.mp3', 'audio')).toBe(false);
    expect(ownsKey('Ayaz Kaya', 'music/ayaz-kaya/covers/x.jpg', 'audio')).toBe(false);
    expect(ownsKey('Ayaz Kaya', coverKey!, 'audio')).toBe(false);
  });
});

describe('form denetimleri', () => {
  it('e-posta ve şifre', () => {
    expect(emailProblem('ad@ornek.com')).toBeNull();
    expect(emailProblem('ad@ornek')).toContain('Geçerli');
    expect(emailProblem(' ')).toContain('yaz');
    expect(newPasswordProblem('1234567')).toContain('8');
    expect(newPasswordProblem('abcd1234')).toBeNull();
  });
});
