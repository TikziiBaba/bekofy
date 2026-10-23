// Server Action sonuçları. Hata, kullanıcıya gösterilecek Türkçe metindir; ayrıntı sunucu günlüğünde kalır.

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Beklenmeyen hatayı günlüğe yazar, kullanıcıya genel bir mesaj döndürür. DataError mesajları zaten Türkçedir. */
export function failFrom(err: unknown, fallback: string): { ok: false; error: string } {
  if (err instanceof Error && err.name === 'DataError') return fail(err.message);
  console.error(fallback, err);
  return fail(fallback);
}
