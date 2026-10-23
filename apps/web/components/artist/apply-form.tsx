'use client';

import { artistRequestProblem } from '@bekofy/core';
import { Button, Field, Input, Notice, Textarea } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { applyAsArtist } from '@/app/actions/artist';

export function ApplyForm() {
  const router = useRouter();
  const [values, setValues] = useState({ artistName: '', message: '', links: '' });
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const input = { artistName: values.artistName, message: values.message, links: values.links.split(/\s+/).filter(Boolean) };
    const problem = artistRequestProblem(input);
    const forName = input.artistName.trim() ? null : 'Sanatçı adını yaz.';
    setNameError(forName);
    if (forName) return document.getElementById('artist-name')?.focus();
    if (problem) return setError(problem);
    setBusy(true);
    const res = await applyAsArtist(input);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field id="artist-name" label="Sanatçı adı" hint="Şarkılarında görünecek ad." error={nameError}>
        {(p) => <Input {...p} maxLength={80} value={values.artistName} onChange={(e) => setValues((v) => ({ ...v, artistName: e.target.value }))} />}
      </Field>
      <Field id="artist-message" label="Kendini tanıt" optional hint="Ne tür müzik yapıyorsun, nerede yayınlıyorsun? En fazla 1000 karakter.">
        {(p) => <Textarea {...p} rows={4} maxLength={1000} value={values.message} onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))} />}
      </Field>
      <Field id="artist-links" label="Bağlantılar" optional hint="Spotify, YouTube, Instagram gibi sayfaların. Her satıra bir https:// adresi, en fazla 5.">
        {(p) => <Textarea {...p} rows={3} spellCheck={false} value={values.links} onChange={(e) => setValues((v) => ({ ...v, links: e.target.value }))} />}
      </Field>
      <Button type="submit" loading={busy} className="self-start">
        Başvuruyu gönder
      </Button>
    </form>
  );
}
