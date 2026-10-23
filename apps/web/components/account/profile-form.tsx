'use client';

import { checkUsername, imageProblem, updateProfile, uploadAvatar, USERNAME_MESSAGES } from '@bekofy/core';
import { Button, Field, Input, Notice, Textarea } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { FilePicker } from '@/components/file-picker';
import { getBrowserClient } from '@/lib/supabase/client';
import { focusFirstError } from '@/lib/validate';

const BIO_MAX = 300;

export function ProfileForm({ userId, username, bio, avatarUrl }: { userId: string; username: string | null; bio: string; avatarUrl: string | null }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ username: username ?? '', bio });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const found: Record<string, string | null> = {
      avatar: file ? imageProblem(file) : null,
      username: values.username.trim() ? null : 'Bir kullanıcı adı seç.',
      bio: values.bio.length > BIO_MAX ? `Hakkında en fazla ${BIO_MAX} karakter olabilir.` : null,
    };
    setErrors(found);
    const order = ['avatar', 'username', 'bio'];
    if (order.some((k) => found[k])) return focusFirstError(ref.current, order, found);

    setBusy(true);
    try {
      const sb = getBrowserClient();
      const problem = await checkUsername(sb, values.username, userId);
      if (problem) {
        const withName = { ...found, username: USERNAME_MESSAGES[problem] };
        setErrors(withName);
        focusFirstError(ref.current, order, withName);
        return;
      }
      const avatarUrlNew = file ? await uploadAvatar(sb, userId, file) : null;
      await updateProfile(sb, userId, {
        username: values.username.trim().toLocaleLowerCase('tr-TR'),
        bio: values.bio.trim(),
        ...(avatarUrlNew ? { avatar_url: avatarUrlNew } : {}),
      });
      setFile(null);
      setStatus({ tone: 'success', text: 'Profilin kaydedildi.' });
      router.refresh();
    } catch (err) {
      setStatus({ tone: 'danger', text: err instanceof Error ? err.message : 'Profil kaydedilemedi. Tekrar dene.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={preview ?? avatarUrl} name={values.username || username} className="size-(--size-artwork-md)" />
        <FilePicker
          id="avatar"
          label="Profil görseli seç"
          accept="image/jpeg,image/png,image/webp"
          hint={file ? `${file.name} seçildi; kaydedince yüklenir.` : 'JPG, PNG ya da WebP, en fazla 5 MB.'}
          error={errors.avatar}
          onFile={(f) => {
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
            setErrors((x) => ({ ...x, avatar: f ? imageProblem(f) : null }));
          }}
        />
      </div>
      <Field id="username" label="Kullanıcı adı" hint="3-24 karakter: küçük harf, rakam, nokta ya da alt çizgi." error={errors.username}>
        {(p) => (
          <Input
            {...p}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
          />
        )}
      </Field>
      <Field id="bio" label="Hakkında" optional hint={`${values.bio.length}/${BIO_MAX} karakter`} error={errors.bio}>
        {(p) => <Textarea {...p} rows={3} value={values.bio} onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))} />}
      </Field>
      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}
      <Button type="submit" loading={busy} className="self-start">
        Profili kaydet
      </Button>
    </form>
  );
}
