// Giriş ve kayıt. Şifre sıfırlama sitede yapılır (e-posta bağlantısı siteye gelir).

import { checkUsername, MIN_PASSWORD_LENGTH, USERNAME_MESSAGES } from '@bekofy/core';
import { BekofyLogo, Button, cn, Field, Input, Notice } from '@bekofy/ui';
import { MailCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { PasswordInput } from '../components/password-input';
import { bridge } from '../lib/bridge';
import { useSession } from '../lib/session';

const emailProblem = (v: string) => (!v.trim() ? 'E-posta adresini yaz.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Geçerli bir e-posta adresi yaz. Örnek: ad@ornek.com' : null);

export function AuthScreen() {
  const session = useSession();
  const s = session.state.status === 'signed-out' ? session.state : null;
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="relative isolate flex h-full flex-col">
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-0 -z-10" />
      <div className="drag h-(--title-bar-height) shrink-0" />
      <main id="main" className="scroll-thin flex flex-1 items-start justify-center overflow-y-auto px-4 pb-12 pt-6">
        <div className="flex w-full max-w-[calc(var(--size-layout-panel)*1.4)] flex-col gap-6 motion-safe:animate-[rise_var(--duration-slow)_var(--easing-emphasized)]">
          <BekofyLogo className="self-center" />
          <div className="glass-panel flex flex-col gap-6 rounded-ui-xl p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="type-title-xl">{mode === 'login' ? (s?.adding ? 'Hesap ekle' : 'Tekrar hoş geldin') : 'Ücretsiz hesap aç'}</h1>
              <p className="text-fg-muted">{mode === 'login' ? 'Bekofy hesabınla giriş yap.' : 'Tek hesapla masaüstünde, telefonda ve sitede giriş yaparsın.'}</p>
            </div>
            <div role="group" aria-label="Giriş ya da kayıt" className="flex gap-1 rounded-pill bg-fill p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn('flex-1 min-h-(--size-control-sm) rounded-pill type-label-md text-fg-muted hover:text-fg', mode === m && 'bg-glass text-fg shadow-ui-sm')}
                >
                  {m === 'login' ? 'Giriş yap' : 'Kayıt ol'}
                </button>
              ))}
            </div>
            {s?.notice ? <Notice tone="danger">{s.notice}</Notice> : null}
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
          {s?.adding ? (
            <Button variant="ghost" className="self-center" onClick={session.cancelAdd}>
              Vazgeç, hesabıma dön
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function GoogleButton({ onError }: { onError: (m: string) => void }) {
  const { signInWithGoogle } = useSession();
  const [waiting, setWaiting] = useState(false);
  if (!bridge) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        loading={waiting}
        onClick={async () => {
          setWaiting(true);
          try {
            await signInWithGoogle();
          } catch (e) {
            onError(e instanceof Error ? e.message : 'Google girişi açılamadı.');
            setWaiting(false);
          }
        }}
      >
        Google ile devam et
      </Button>
      {waiting ? (
        <p className="type-body-sm text-fg-muted" role="status">
          Tarayıcında Google girişini tamamla; bitince buraya dönülür.{' '}
          <button type="button" className="text-accent-fg underline" onClick={() => setWaiting(false)}>
            Vazgeç
          </button>
        </p>
      ) : null}
    </div>
  );
}

function LoginForm() {
  const { signIn } = useSession();
  const ref = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = { 'login-email': emailProblem(email), 'login-password': password ? null : 'Şifreni yaz.' };
    setErrors(found);
    setFormError(null);
    const first = Object.entries(found).find(([, v]) => v)?.[0];
    if (first) return ref.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Giriş yapılamadı. Tekrar dene.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <GoogleButton onError={setFormError} />
      <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field id="login-email" label="E-posta" error={errors['login-email']}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field id="login-password" label="Şifre" error={errors['login-password']}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" size="lg" loading={busy}>
            Giriş yap
          </Button>
          <button type="button" className="type-label-md text-accent-fg hover:underline" onClick={() => void bridge?.openExternal('https://bekofy.bekirr.dev/forgot-password')}>
            Şifremi unuttum
          </button>
        </div>
      </form>
    </div>
  );
}

function RegisterForm() {
  const { signUp, state } = useSession();
  const ref = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const found: Record<string, string | null> = {
      'reg-username': values.username.trim() ? null : 'Bir kullanıcı adı seç.',
      'reg-email': emailProblem(values.email),
      'reg-password': values.password.length >= MIN_PASSWORD_LENGTH ? null : `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı. Harf ve rakam karıştır.`,
    };
    const focusFirst = (f: Record<string, string | null>) => {
      const first = Object.entries(f).find(([, v]) => v)?.[0];
      if (first) ref.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return Boolean(first);
    };
    setErrors(found);
    if (focusFirst(found)) return;
    setBusy(true);
    try {
      if (state.status === 'signed-out') {
        const problem = await checkUsername(state.sb, values.username);
        if (problem) {
          const next = { ...found, 'reg-username': USERNAME_MESSAGES[problem] };
          setErrors(next);
          focusFirst(next);
          setBusy(false);
          return;
        }
      }
      const res = await signUp(values);
      if (res.needsConfirmation) setSentTo(values.email.trim());
      setBusy(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Hesap oluşturulamadı. Tekrar dene.');
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <MailCheck aria-hidden="true" className="size-(--size-icon-lg) text-accent-fg" />
        <h2 className="type-title-md">E-postanı kontrol et</h2>
        <p className="text-fg-muted">
          <strong className="text-fg">{sentTo}</strong> adresine doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra burada giriş yap.
        </p>
      </div>
    );
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field id="reg-username" label="Kullanıcı adı" hint="3-24 karakter: küçük harf, rakam, nokta ya da alt çizgi." error={errors['reg-username']}>
        {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" spellCheck={false} value={values.username} onChange={set('username')} />}
      </Field>
      <Field id="reg-email" label="E-posta" error={errors['reg-email']}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={set('email')} />}
      </Field>
      <Field id="reg-password" label="Şifre" hint="En az 8 karakter. Harf ve rakam karıştır." error={errors['reg-password']}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set('password')} />}
      </Field>
      <Button type="submit" size="lg" loading={busy} className="self-start">
        Hesap oluştur
      </Button>
    </form>
  );
}
