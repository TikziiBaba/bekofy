// Site genelinde kullanılan sabitler.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bekofy.bekirr.dev').replace(/\/+$/, '');
export const SITE_NAME = 'Bekofy';
export const SITE_DESCRIPTION =
  'Bekofy ile müzik dinle: kapaktan ışık alan arayüz, Jam ile arkadaşlarınla aynı anda dinleme, senkron şarkı sözleri. Windows için ücretsiz indir.';

/** Tek Premium plan. Ödeme PayTR ile sonraki fazda açılır. */
export const PREMIUM_PRICE = '₺29,99';
export const PREMIUM_PERIOD = 'ay';

export const GITHUB_REPO = 'TikziiBaba/bekofy';
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
