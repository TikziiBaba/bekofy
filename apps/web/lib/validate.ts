// Formlardaki ortak alan denetimleri. Mesajlar ne olduğunu ve nasıl düzeltileceğini söyler.

import { MIN_PASSWORD_LENGTH } from '@bekofy/core';

export function emailProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return 'E-posta adresini yaz.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Geçerli bir e-posta adresi yaz. Örnek: ad@ornek.com';
  return null;
}

export function newPasswordProblem(value: string): string | null {
  if (!value) return 'Bir şifre belirle.';
  if (value.length < MIN_PASSWORD_LENGTH) return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı. Harf ve rakam karıştır.`;
  return null;
}

/** Hata alan ilk alana odaklanır; ekran okuyucu alanın hatasını açıklamasından okur. */
export function focusFirstError(form: HTMLFormElement | null, order: string[], errors: Record<string, string | null | undefined>): void {
  const first = order.find((name) => errors[name]);
  if (first) form?.querySelector<HTMLElement>(`#${first}`)?.focus();
}
