/** HTTP durum koduyla birlikte, kullanıcıya gösterilecek Türkçe hata. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
