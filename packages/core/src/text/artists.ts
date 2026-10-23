// Sanatçı metnini adlara ayırır: "Motive, UZİ", "A & B", "A feat. B", "A ft B".
// Veritabanındaki song_artists eşlemesi (migration 20261023000000) aynı kuralı kullanır.

const SEPARATOR = /\s*(?:,|&|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i;

export function splitArtistNames(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(SEPARATOR)
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLocaleLowerCase('tr-TR');
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Görüntülenecek sanatçı metni: ["Motive", "UZİ"] -> "Motive, UZİ". */
export function joinArtistNames(names: readonly string[]): string {
  return names.map((n) => n.trim()).filter(Boolean).join(', ');
}
