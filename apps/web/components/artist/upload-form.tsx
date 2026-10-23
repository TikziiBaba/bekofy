'use client';

import { artistSongProblem, audioProblem, imageProblem } from '@bekofy/core';
import { Button, Field, Input, Notice, Progress } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { discardArtistUpload, finishArtistUpload, prepareArtistUpload } from '@/app/actions/artist';
import { FilePicker } from '@/components/file-picker';
import { focusFirstError } from '@/lib/validate';

type Phase = { kind: 'idle' } | { kind: 'uploading'; label: string; percent: number } | { kind: 'done'; title: string };

/** Dosyanın süresini tarayıcıda okur (saniye); okunamazsa NaN. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const finish = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(Number.NaN);
    audio.src = url;
  });
}

/** İmzalı adrese PUT; ilerleme yüzdesi bildirilir. fetch yükleme ilerlemesi vermediği için XHR. */
function put(url: string, file: File, headers: Record<string, string>, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
}

export function UploadForm({ artistName }: { artistName: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [audio, setAudio] = useState<{ file: File; duration: number } | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [values, setValues] = useState({ title: '', album: '', genre: '' });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const busy = phase.kind === 'uploading';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fields = { title: values.title, album: values.album, genre: values.genre, duration: audio?.duration ?? Number.NaN };
    const songProblem = artistSongProblem(fields);
    const found: Record<string, string | null> = {
      'song-audio': audio ? audioProblem(audio.file) : 'Bir MP3 dosyası seç.',
      'song-cover': cover ? imageProblem(cover) : null,
      'song-title': values.title.trim() ? null : 'Şarkı adını yaz.',
      'song-album': values.album.trim().length > 200 ? 'Albüm adı en fazla 200 karakter olabilir.' : null,
      'song-genre': values.genre.trim().length > 60 ? 'Tür en fazla 60 karakter olabilir.' : null,
    };
    if (!found['song-audio'] && songProblem && !found['song-title']) found['song-audio'] = songProblem;
    setErrors(found);
    const order = ['song-audio', 'song-cover', 'song-title', 'song-album', 'song-genre'];
    if (order.some((k) => found[k]) || !audio) return focusFirstError(ref.current, order, found);

    setPhase({ kind: 'uploading', label: 'Yükleme hazırlanıyor', percent: 0 });
    const prepared = await prepareArtistUpload({
      title: values.title,
      audio: { type: audio.file.type, size: audio.file.size, name: audio.file.name },
      cover: cover ? { type: cover.type, size: cover.size } : null,
    });
    if (!prepared.ok) {
      setFormError(prepared.error);
      setPhase({ kind: 'idle' });
      return;
    }
    const { audio: signedAudio, cover: signedCover } = prepared.data;
    const keys = { audioKey: signedAudio.key, coverKey: signedCover?.key ?? null };
    try {
      // Ses %0-85, kapak %85-95, kayıt %95-100.
      await put(signedAudio.url, audio.file, signedAudio.headers, (r) => setPhase({ kind: 'uploading', label: 'Ses dosyası yükleniyor', percent: Math.round(r * 85) }));
      if (signedCover && cover) {
        await put(signedCover.url, cover, signedCover.headers, (r) => setPhase({ kind: 'uploading', label: 'Kapak yükleniyor', percent: 85 + Math.round(r * 10) }));
      }
    } catch {
      await discardArtistUpload(keys);
      setFormError('Dosya yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'uploading', label: 'Kaydediliyor', percent: 97 });
    const finished = await finishArtistUpload({ ...fields, ...keys });
    if (!finished.ok) {
      setFormError(finished.error);
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'done', title: values.title.trim() });
    setAudio(null);
    setCover(null);
    setValues({ title: '', album: '', genre: '' });
    ref.current?.reset();
    router.refresh();
  }

  if (phase.kind === 'done') {
    return (
      <Notice tone="success" title={`${phase.title} gönderildi`} actions={<Button variant="secondary" size="sm" onClick={() => setPhase({ kind: 'idle' })}>Başka şarkı yükle</Button>}>
        Şarkın onay bekliyor. Onaylanınca uygulamada {artistName} adıyla görünür; reddedilirse dosya silinir.
      </Notice>
    );
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={busy || undefined}>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FilePicker
          id="song-audio"
          label="MP3 dosyası seç"
          accept="audio/mpeg,.mp3"
          hint={audio ? `${audio.file.name} (${(audio.file.size / 1_000_000).toFixed(1)} MB)` : 'Yalnızca MP3, en fazla 30 MB.'}
          error={errors['song-audio']}
          onFile={async (file) => {
            if (!file) return setAudio(null);
            const duration = await readDuration(file);
            setAudio({ file, duration });
            setErrors((x) => ({ ...x, 'song-audio': audioProblem(file) }));
            if (!values.title.trim()) setValues((v) => ({ ...v, title: file.name.replace(/\.[^.]+$/, '').slice(0, 200) }));
          }}
        />
        <FilePicker
          id="song-cover"
          label="Kapak seç"
          accept="image/jpeg,image/png,image/webp"
          hint={cover ? cover.name : 'İsteğe bağlı. Kare JPG, PNG ya da WebP, en fazla 5 MB.'}
          error={errors['song-cover']}
          onFile={(file) => {
            setCover(file);
            setErrors((x) => ({ ...x, 'song-cover': file ? imageProblem(file) : null }));
          }}
        />
      </div>
      <Field id="song-title" label="Şarkı adı" error={errors['song-title']}>
        {(p) => <Input {...p} value={values.title} maxLength={200} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />}
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="song-album" label="Albüm" optional error={errors['song-album']}>
          {(p) => <Input {...p} value={values.album} maxLength={200} onChange={(e) => setValues((v) => ({ ...v, album: e.target.value }))} />}
        </Field>
        <Field id="song-genre" label="Tür" optional hint="Örnek: Pop, Rap, Akustik" error={errors['song-genre']}>
          {(p) => <Input {...p} value={values.genre} maxLength={60} onChange={(e) => setValues((v) => ({ ...v, genre: e.target.value }))} />}
        </Field>
      </div>
      {phase.kind === 'uploading' ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <Progress value={phase.percent} label="Yükleme" />
          <div className="flex justify-between type-body-sm text-fg-muted">
            <span>{phase.label}</span>
            <span>%{phase.percent}</span>
          </div>
        </div>
      ) : null}
      <Button type="submit" loading={busy} className="self-start">
        Onaya gönder
      </Button>
    </form>
  );
}
