'use client';

import { Button, Field, Input, Notice, Textarea } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { saveSong } from '@/app/actions/admin';
import { showToast } from '@/components/toast';

export interface SongFormValues {
  title: string;
  artists: string;
  album: string;
  genre: string;
  lyrics: string;
  syncedLyrics: string;
}

export function SongForm({ id, initial }: { id: string; initial: SongFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof SongFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await saveSong(id, values);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    showToast('Şarkı kaydedildi.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field id="title" label="Şarkı adı">
        {(p) => <Input {...p} required maxLength={200} value={values.title} onChange={set('title')} />}
      </Field>
      <Field id="artists" label="Sanatçılar" hint="Birden fazlaysa virgülle ayır: Ayaz Kaya, Selin Aras. Yoksa yeni sanatçı kaydı açılır.">
        {(p) => <Input {...p} required value={values.artists} onChange={set('artists')} />}
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="album" label="Albüm" optional>
          {(p) => <Input {...p} maxLength={200} value={values.album} onChange={set('album')} />}
        </Field>
        <Field id="genre" label="Tür" optional>
          {(p) => <Input {...p} maxLength={60} value={values.genre} onChange={set('genre')} />}
        </Field>
      </div>
      <Field id="lyrics" label="Şarkı sözleri" optional hint="Düz metin; her satır ayrı.">
        {(p) => <Textarea {...p} rows={6} value={values.lyrics} onChange={set('lyrics')} />}
      </Field>
      <Field id="synced" label="Senkron sözler (LRC)" optional hint="[01:23.45] satır biçiminde. Varsa uygulama bunu kullanır.">
        {(p) => <Textarea {...p} rows={6} spellCheck={false} className="type-mono" value={values.syncedLyrics} onChange={set('syncedLyrics')} />}
      </Field>
      <Button type="submit" loading={busy} className="self-start">
        Kaydet
      </Button>
    </form>
  );
}
