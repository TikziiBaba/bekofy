'use client';

import { updatePassword } from '@bekofy/core';
import { Button, Field, Notice } from '@bekofy/ui';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { focusFirstError, newPasswordProblem } from '@/lib/validate';
import { PasswordInput } from './password-input';

export function ResetForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = {
      password: newPasswordProblem(password),
      repeat: repeat === password ? null : 'Şifreler aynı değil. İkinci alana aynı şifreyi yaz.',
    };
    setErrors(found);
    setFormError(null);
    if (found.password || found.repeat) return focusFirstError(ref.current, ['password', 'repeat'], found);
    setBusy(true);
    try {
      await updatePassword(getBrowserClient(), password);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Şifre değiştirilemedi. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Notice tone="success" title="Şifren değişti" actions={<Link href="/account" className="type-label-md underline">Hesabıma git</Link>}>
        Bundan sonra yeni şifrenle giriş yaparsın.
      </Notice>
    );
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field id="password" label="Yeni şifre" hint="En az 8 karakter. Harf ve rakam karıştır." error={errors.password}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field id="repeat" label="Yeni şifre (tekrar)" error={errors.repeat}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={busy} className="self-start">
        Şifreyi değiştir
      </Button>
    </form>
  );
}
