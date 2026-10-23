'use client';

import { checkUsername, signUp, USERNAME_MESSAGES } from '@bekofy/core';
import { Button, Field, Input, Notice } from '@bekofy/ui';
import { MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { emailProblem, focusFirstError, newPasswordProblem } from '@/lib/validate';
import { OrDivider } from './divider';
import { GoogleButton } from './google-button';
import { PasswordInput } from './password-input';

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'busy' | 'done'>('idle');

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const found: Record<string, string | null> = {
      username: values.username.trim() ? null : 'Bir kullanıcı adı seç.',
      email: emailProblem(values.email),
      password: newPasswordProblem(values.password),
    };
    setErrors(found);
    const order = ['username', 'email', 'password'];
    if (order.some((k) => found[k])) return focusFirstError(formRef.current, order, found);

    setBusy(true);
    try {
      const sb = getBrowserClient();
      const problem = await checkUsername(sb, values.username);
      if (problem) {
        const withUsername = { ...found, username: USERNAME_MESSAGES[problem] };
        setErrors(withUsername);
        focusFirstError(formRef.current, order, withUsername);
        setBusy(false);
        return;
      }
      const { needsConfirmation } = await signUp(sb, { ...values, redirectTo: redirectTo() });
      if (needsConfirmation) {
        setSentTo(values.email.trim());
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Hesap oluşturulamadı. Tekrar dene.');
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <MailCheck aria-hidden="true" className="size-(--size-icon-lg) text-accent-fg" />
        <h2 className="type-title-md">E-postanı kontrol et</h2>
        <p className="text-fg-muted">
          <strong className="text-fg">{sentTo}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığında hesabın açılır. Birkaç dakika içinde gelmezse gereksiz klasörüne bak.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            loading={resend === 'busy'}
            disabled={resend === 'done'}
            onClick={async () => {
              setResend('busy');
              const { error } = await getBrowserClient().auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: redirectTo() } });
              setResend(error ? 'idle' : 'done');
              if (error) setFormError('Bağlantı yeniden gönderilemedi. Birkaç dakika sonra tekrar dene.');
            }}
          >
            {resend === 'done' ? 'Yeniden gönderildi' : 'Bağlantıyı yeniden gönder'}
          </Button>
        </div>
        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <GoogleButton next={next} onError={setFormError} />
      <OrDivider />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field id="username" label="Kullanıcı adı" hint="3-24 karakter: küçük harf, rakam, nokta ya da alt çizgi." error={errors.username}>
          {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" spellCheck={false} value={values.username} onChange={set('username')} />}
        </Field>
        <Field id="email" label="E-posta" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} />}
        </Field>
        <Field id="password" label="Şifre" hint="En az 8 karakter. Harf ve rakam karıştır." error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set('password')} />}
        </Field>
        <Button type="submit" size="lg" loading={busy} className="self-start">
          Hesap oluştur
        </Button>
      </form>
    </div>
  );
}
