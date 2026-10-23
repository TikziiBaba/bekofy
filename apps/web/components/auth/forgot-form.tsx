'use client';

import { requestPasswordReset } from '@bekofy/core';
import { Button, Field, Input, Notice } from '@bekofy/ui';
import { useRef, useState, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { emailProblem } from '@/lib/validate';

export function ForgotForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = emailProblem(email);
    setError(problem);
    setFormError(null);
    if (problem) return ref.current?.querySelector<HTMLElement>('#email')?.focus();
    setBusy(true);
    try {
      await requestPasswordReset(getBrowserClient(), email, `${window.location.origin}/auth/callback?next=%2Freset-password`);
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sıfırlama e-postası gönderilemedi. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  // Adresin kayıtlı olup olmadığı söylenmez: yanıt her durumda aynı.
  if (sent) {
    return (
      <Notice tone="success" title="E-postanı kontrol et">
        Bu adres kayıtlıysa birkaç dakika içinde şifre sıfırlama bağlantısı gelecek. Gelmezse gereksiz klasörüne bak.
      </Notice>
    );
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field id="email" label="E-posta" error={error}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={busy} className="self-start">
        Sıfırlama bağlantısı gönder
      </Button>
    </form>
  );
}
