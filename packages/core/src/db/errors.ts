// Veri katmanı hataları: Supabase/PostgREST hatası Türkçe, kullanıcıya gösterilebilir bir mesaja çevrilir.
// Ham hata `cause` içinde kalır (günlük ve hata ayıklama için).

export class DataError extends Error {
  readonly code: string | undefined;
  override readonly cause: unknown;

  constructor(message: string, code?: string, cause?: unknown) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.cause = cause;
  }
}

interface RawError {
  code?: string;
  message?: string;
}

const BY_CODE: Record<string, string> = {
  '23505': 'Bu kayıt zaten var.',
  '23503': 'Bağlı olduğu kayıt bulunamadı.',
  '23514': 'Girilen değer kurallara uymuyor.',
  '42501': 'Bu işlem için yetkin yok.',
  PGRST116: 'Kayıt bulunamadı.',
  PGRST301: 'Oturumun sona erdi. Tekrar giriş yap.',
};

/** Ham hatayı DataError'a çevirir. `what`: neyin başarısız olduğu ("Şarkılar alınamadı"). */
export function toDataError(error: RawError, what: string): DataError {
  const detail = (error.code && BY_CODE[error.code]) ?? (/fetch|network/i.test(error.message ?? '') ? 'Bağlantı kurulamadı. İnternetini kontrol et.' : null);
  return new DataError(detail ? `${what}. ${detail}` : `${what}.`, error.code, error);
}

/** Supabase sonucunu açar: hata varsa fırlatır, yoksa veriyi döndürür. */
export function must<T>(result: { data: T; error: RawError | null }, what: string): NonNullable<T> {
  if (result.error) throw toDataError(result.error, what);
  if (result.data === null || result.data === undefined) throw new DataError(`${what}. Kayıt bulunamadı.`, 'PGRST116');
  return result.data as NonNullable<T>;
}

/** Yalnızca hatayı denetler (silme, güncelleme gibi veri döndürmeyen işlemler). */
export function check(result: { error: RawError | null }, what: string): void {
  if (result.error) throw toDataError(result.error, what);
}

/** ilike ile büyük/küçük harf duyarsız TAM eşleşme: LIKE jokerleri (% _) ve kaçış karakteri kaçışlanır. */
export function likeExact(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

/** Arama metnini PostgREST filtresi için güvenli hale getirir (joker ve ayraç karakterleri atılır). */
export function searchTerm(input: string): string {
  return input.replace(/[%_*\\,()".:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
}
