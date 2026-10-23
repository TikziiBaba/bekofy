/**
 * Girişten sonra gidilecek yol. Yalnızca site içi göreli yollar kabul edilir;
 * böylece ?next=https://kotu.site gibi bir bağlantı kullanıcıyı başka siteye götüremez.
 */
export function safeNext(value: string | null | undefined, fallback = '/account'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
