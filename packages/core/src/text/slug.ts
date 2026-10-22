// Türkçe güvenli dosya/URL adı: "Ağustos Böceği" -> "agustos-bocegi".

const FOLD: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
};

/** Küçük harfe çevirir (Türkçe kuralıyla: I -> ı, İ -> i), aksanları ASCII'ye indirir, geri kalanı tireye çevirir. */
export function slugify(input: string, { maxLength = 80, fallback = 'adsiz' } = {}): string {
  const lowered = input.toLocaleLowerCase('tr-TR');
  const folded = [...lowered].map((ch) => FOLD[ch] ?? ch).join('');
  const ascii = folded.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || fallback;
}
