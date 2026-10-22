// Süre ve zaman biçimleri (Türkçe).

/** 214 -> "3:34", 3723 -> "1:02:03". Geçersiz değerde "0:00". */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const s = Number.isFinite(totalSeconds) && (totalSeconds as number) > 0 ? Math.floor(totalSeconds as number) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "3:34" ya da "1:02:03" -> saniye. Biçim bozuksa null. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

/** Toplam süre: 1380 -> "23 dk", 3900 -> "1 sa 5 dk". */
export function formatTotalDuration(totalSeconds: number): string {
  const minutes = Math.round(Math.max(totalSeconds, 0) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Arkadaş etkinliği gibi yerler için kısa göreli zaman: "Şimdi", "4 dk", "3 sa", "2 g", "5 hf". */
export function formatRelative(date: Date | string | number, now: Date = new Date()): string {
  const diff = Math.max(0, (now.getTime() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Şimdi';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} g`;
  return `${Math.floor(diff / (86400 * 7))} hf`;
}

const NUMBER = new Intl.NumberFormat('tr-TR');

/** 412380 -> "412.380". */
export function formatCount(n: number): string {
  return NUMBER.format(n);
}
