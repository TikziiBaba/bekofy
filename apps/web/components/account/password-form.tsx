'use client';

import { updatePassword } from '@bekofy/core';
import { Button, Field, Notice } from '@bekofy/ui';
import { useRef, useState, type FormEvent } from 'react';
import { PasswordInput } from '@/components/auth/password-input';
import { getBrowserClient } from '@/lib/supabase/client';
import { focusFirstError, newPasswordProblem } from '@/lib/validate';

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const found = {
      'new-password': newPasswordProblem(password),
      'repeat-password': repeat === password ? null : 'Şifreler aynı değil. İkinci alana aynı şifreyi yaz.',
    };
    setErrors(found);
    if (found['new-password'] || found['repeat-password']) return focusFirstError(ref.current, ['new-password', 'repeat-password'], found);
    setBusy(true);
    try {
      await updatePassword(getBrowserClient(), password);
      setPassword('');
      setRepeat('');
      setStatus({ tone: 'success', text: 'Şifren değişti.' });
    } catch (err) {
      setStatus({ tone: 'danger', text: err instanceof Error ? err.message : 'Şifre değiştirilemedi. Tekrar dene.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field id="new-password" label="Yeni şifre" hint="En az 8 karakter. Harf ve rakam karıştır." error={errors['new-password']}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field id="repeat-password" label="Yeni şifre (tekrar)" error={errors['repeat-password']}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
      </Field>
      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}
      <Button type="submit" variant="secondary" loading={busy} className="self-start">
        Şifreyi değiştir
      </Button>
    </form>
  );
}
