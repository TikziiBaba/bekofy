'use client';

import { logAccess, signIn } from '@bekofy/core';
import { Button, Field, Input, Notice } from '@bekofy/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { emailProblem, focusFirstError } from '@/lib/validate';
import { OrDivider } from './divider';
import { GoogleButton } from './google-button';
import { PasswordInput } from './password-input';

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = { email: emailProblem(email), password: password ? null : 'Şifreni yaz.' };
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return focusFirstError(formRef.current, ['email', 'password'], found);

    setBusy(true);
    try {
      const sb = getBrowserClient();
      const { session } = await signIn(sb, email, password);
      void logAccess(sb, session.user.id, { platform: 'web', userAgent: navigator.userAgent }).catch(() => undefined);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Giriş yapılamadı. Tekrar dene.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <GoogleButton next={next} onError={setFormError} />
      <OrDivider />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field id="email" label="E-posta" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field id="password" label="Şifre" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" size="lg" loading={busy}>
            Giriş yap
          </Button>
          <Link href="/forgot-password" className="type-label-md text-accent-fg hover:underline">
            Şifremi unuttum
          </Link>
        </div>
      </form>
    </div>
  );
}
