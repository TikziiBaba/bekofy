'use client';

import { formatDuration, imageProblem, parseYouTubeLink, splitArtistNames, YOUTUBE_LINK_MESSAGES } from '@bekofy/core';
import { Button, buttonVariants, cn, Field, Input, Notice, Progress, Spinner, StatusPill } from '@bekofy/ui';
import { CircleCheck, Clock3, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FilePicker } from '@/components/file-picker';
import { getBrowserClient } from '@/lib/supabase/client';
import { health, preview, runImport, type Health, type ImportEvent, type Preview } from '@/lib/yt-server';

type Stage = Extract<ImportEvent, { type: 'progress' }>['stage'];
const STAGES: Array<{ id: Stage; label: string }> = [
  { id: 'download', label: 'YouTube’dan indiriliyor' },
  { id: 'convert', label: 'MP3’e dönüştürülüyor' },
  { id: 'cover', label: 'Kapak hazırlanıyor' },
  { id: 'upload', label: 'R2’ye yükleniyor' },
  { id: 'save', label: 'Kütüphaneye kaydediliyor' },
];

type State =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'preview'; data: Preview }
  | { phase: 'importing'; data: Preview; stage: Stage; percent: number }
  | { phase: 'done'; song: { id: string; title: string } };

async function accessToken(): Promise<string> {
  const { data } = await getBrowserClient().auth.getSession();
  if (!data.session) throw new Error('Oturumun sona erdi. Sayfayı yenileyip tekrar giriş yap.');
  return data.session.access_token;
}

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Görsel okunamadı.'));
    r.readAsDataURL(file);
  });

export function YouTubeImport() {
  const router = useRouter();
  const [server, setServer] = useState<{ status: 'checking' | 'online' | 'offline'; info?: Health }>({ status: 'checking' });
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', artists: '', album: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [cover, setCover] = useState<File | null>(null);
  const [useOwnCover, setUseOwnCover] = useState(false);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );
  const urlRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const check = useCallback(async () => {
    setServer({ status: 'checking' });
    try {
      setServer({ status: 'online', info: await health() });
    } catch {
      setServer({ status: 'offline' });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Aşama değişince başlığa odak: klavye ve ekran okuyucu kullanıcısı yeni bölümü kaçırmaz.
  useEffect(() => {
    if (state.phase === 'preview' || state.phase === 'done') headingRef.current?.focus();
  }, [state.phase]);

  async function onFetch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = parseYouTubeLink(url);
    if (!parsed.ok) {
      setUrlError(YOUTUBE_LINK_MESSAGES[parsed.reason]);
      urlRef.current?.focus();
      return;
    }
    setUrlError(null);
    setState({ phase: 'fetching' });
    try {
      const data = await preview(await accessToken(), parsed.url);
      setForm({ title: data.suggestion.title, artists: data.suggestion.artists.join(', '), album: data.suggestion.album ?? '' });
      setCover(null);
      setUseOwnCover(false);
      setFieldErrors({});
      setState({ phase: 'preview', data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilgiler alınamadı. Tekrar dene.');
      setState({ phase: 'idle' });
      if (err instanceof Error && err.message.startsWith('Yerel sunucuya bağlanılamadı')) setServer({ status: 'offline' });
    }
  }

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.phase !== 'preview') return;
    setError(null);
    const artists = splitArtistNames(form.artists);
    const found: Record<string, string | null> = {
      'imp-title': form.title.trim() ? (form.title.trim().length > 200 ? 'Şarkı adı en fazla 200 karakter olabilir.' : null) : 'Şarkı adını yaz.',
      'imp-artists': !artists.length ? 'En az bir sanatçı yaz.' : artists.length > 5 ? 'En fazla 5 sanatçı yazabilirsin.' : artists.some((a) => a.length > 80) ? 'Her sanatçı adı en fazla 80 karakter olabilir.' : null,
      'imp-cover': useOwnCover ? (cover ? imageProblem(cover) : 'Bir kapak görseli seç ya da YouTube kapağını kullan.') : null,
    };
    setFieldErrors(found);
    const first = ['imp-cover', 'imp-title', 'imp-artists'].find((k) => found[k]);
    if (first) return document.getElementById(first)?.focus();

    const data = state.data;
    try {
      const coverBody = useOwnCover && cover ? { kind: 'upload' as const, dataUrl: await readDataUrl(cover) } : { kind: 'youtube' as const };
      setState({ phase: 'importing', data, stage: 'download', percent: 0 });
      let finished = false;
      await runImport(await accessToken(), { url: data.url, title: form.title.trim(), artists, album: form.album.trim() || null, cover: coverBody }, (ev) => {
        if (ev.type === 'progress') setState({ phase: 'importing', data, stage: ev.stage, percent: ev.percent });
        else if (ev.type === 'done') {
          finished = true;
          setState({ phase: 'done', song: { id: ev.song.id, title: ev.song.title } });
          router.refresh();
        } else {
          finished = true;
          setError(ev.message);
          setState({ phase: 'preview', data });
        }
      });
      if (!finished) {
        setError('Bağlantı yarıda kesildi. Şarkı eklenmiş olabilir; listeyi kontrol et.');
        setState({ phase: 'preview', data });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçe aktarma başlatılamadı. Tekrar dene.');
      setState({ phase: 'preview', data });
    }
  }

  const reset = () => {
    setState({ phase: 'idle' });
    setUrl('');
    setError(null);
    setTimeout(() => urlRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {server.status === 'checking' ? (
          <StatusPill>Yerel sunucu denetleniyor</StatusPill>
        ) : server.status === 'online' ? (
          <StatusPill tone="ok">Yerel sunucu: bağlı{server.info?.version ? ` (${server.info.version})` : ''}</StatusPill>
        ) : (
          <StatusPill tone="off">Yerel sunucu: bağlı değil</StatusPill>
        )}
        {server.status !== 'checking' ? (
          <Button variant="ghost" size="sm" onClick={check}>
            Yeniden denetle
          </Button>
        ) : null}
      </div>

      {server.status === 'offline' ? (
        <Notice tone="danger" title="Yerel sunucuya bağlanılamadı">
          Bilgisayarında proje klasöründe <code className="type-mono">npm run yt-server</code> komutunu çalıştır, sonra “Yeniden denetle”ye bas. Chrome yerel ağ erişimi için izin isterse onay ver.
        </Notice>
      ) : null}
      {server.status === 'online' && server.info && (!server.info.ytDlp || !server.info.ffmpeg || !server.info.r2.configured) ? (
        <Notice tone="warning" title="Yerel sunucu eksik kurulmuş">
          {!server.info.ytDlp || !server.info.ffmpeg ? 'yt-dlp ya da ffmpeg bulunamadı: "npm run yt-server:setup" çalıştır. ' : ''}
          {!server.info.r2.configured ? `R2 ayarları eksik (${server.info.r2.missing.join(', ')}): kökteki .env dosyasını doldur.` : ''}
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {state.phase === 'idle' || state.phase === 'fetching' ? (
        <form onSubmit={onFetch} noValidate className="flex flex-col gap-3">
          <Field id="yt-url" label="YouTube bağlantısı" hint="youtube.com, youtu.be, Shorts ve YouTube Music bağlantıları desteklenir." error={urlError}>
            {(p) => (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input {...p} ref={urlRef} type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} className="sm:flex-1" />
                <Button type="submit" loading={state.phase === 'fetching'}>
                  {state.phase === 'fetching' ? null : <Search aria-hidden="true" />}
                  {state.phase === 'fetching' ? 'Bilgiler getiriliyor' : 'Bilgileri getir'}
                </Button>
              </div>
            )}
          </Field>
        </form>
      ) : null}

      {state.phase === 'preview' || state.phase === 'importing' ? (
        <form onSubmit={onImport} noValidate aria-labelledby="pv-title" className="glass-panel grid grid-cols-1 gap-6 rounded-ui-xl p-5 sm:p-6 md:grid-cols-[var(--size-artwork-xl)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {state.data.thumbnail && !useOwnCover ? (
              <img src={state.data.thumbnail} alt="YouTube kapağı" className="aspect-square w-full max-w-(--size-artwork-xl) rounded-art-lg object-cover" />
            ) : coverPreview && useOwnCover ? (
              <img src={coverPreview} alt="Seçtiğin kapak" className="aspect-square w-full max-w-(--size-artwork-xl) rounded-art-lg object-cover" />
            ) : (
              <div aria-hidden="true" className="art art-1 max-w-(--size-artwork-xl) rounded-art-lg" />
            )}
            <fieldset className="flex flex-col gap-2" disabled={state.phase === 'importing'}>
              <legend className="type-label-md">Kapak</legend>
              <label className="flex items-center gap-2 type-body-sm">
                <input type="radio" name="cover" checked={!useOwnCover} onChange={() => setUseOwnCover(false)} className="size-4 accent-(--color-accent-default)" />
                YouTube kapağı (kare kırpılır)
              </label>
              <label className="flex items-center gap-2 type-body-sm">
                <input type="radio" name="cover" checked={useOwnCover} onChange={() => setUseOwnCover(true)} className="size-4 accent-(--color-accent-default)" />
                Kendi görselim
              </label>
              {useOwnCover ? (
                <FilePicker
                  id="imp-cover"
                  label="Görsel seç"
                  accept="image/jpeg,image/png,image/webp"
                  hint={cover ? cover.name : 'JPG, PNG ya da WebP, en fazla 5 MB.'}
                  error={fieldErrors['imp-cover']}
                  onFile={(f) => {
                    setCover(f);
                    setFieldErrors((x) => ({ ...x, 'imp-cover': f ? imageProblem(f) : null }));
                  }}
                />
              ) : null}
            </fieldset>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <h2 id="pv-title" ref={headingRef} tabIndex={-1} className="type-title-lg outline-none">
              Bilgileri kontrol et
            </h2>
            <p className="type-body-sm text-fg-muted [overflow-wrap:anywhere]">
              Kaynak: “{state.data.rawTitle}” · {state.data.channel} · {formatDuration(state.data.duration)}
            </p>
            {state.data.existing ? (
              <Notice tone="warning" title="Bu video zaten eklenmiş" actions={<Link href={`/admin/songs/${state.data.existing.id}`} className="type-label-md underline">Kaydı aç</Link>}>
                {state.data.existing.title} adıyla kütüphanede.
              </Notice>
            ) : null}
            {state.data.problem ? <Notice tone="danger">{state.data.problem}</Notice> : null}
            <fieldset disabled={state.phase === 'importing'} className="flex flex-col gap-5">
              <Field id="imp-title" label="Şarkı adı" error={fieldErrors['imp-title']}>
                {(p) => <Input {...p} maxLength={200} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />}
              </Field>
              <Field id="imp-artists" label="Sanatçılar" hint="Birden fazlaysa virgülle ayır." error={fieldErrors['imp-artists']}>
                {(p) => <Input {...p} value={form.artists} onChange={(e) => setForm((f) => ({ ...f, artists: e.target.value }))} />}
              </Field>
              <Field id="imp-album" label="Albüm" optional>
                {(p) => <Input {...p} maxLength={200} value={form.album} onChange={(e) => setForm((f) => ({ ...f, album: e.target.value }))} />}
              </Field>
            </fieldset>

            {state.phase === 'importing' ? (
              <div className="flex flex-col gap-4" aria-live="polite">
                <ol className="flex flex-col gap-2">
                  {STAGES.map((s, i) => {
                    const current = STAGES.findIndex((x) => x.id === state.stage);
                    const st = i < current ? 'done' : i === current ? 'active' : 'todo';
                    return (
                      <li key={s.id} className={cn('flex items-center gap-3 type-body-sm', st === 'todo' ? 'text-fg-muted' : 'text-fg')}>
                        {st === 'done' ? (
                          <CircleCheck aria-hidden="true" className="size-(--size-icon-sm) text-success-fg" />
                        ) : st === 'active' ? (
                          <Spinner className="size-(--size-icon-sm) text-accent-fg" />
                        ) : (
                          <Clock3 aria-hidden="true" className="size-(--size-icon-sm) text-fg-subtle" />
                        )}
                        {s.label}
                        <span className="sr-only">{st === 'done' ? ' (tamam)' : st === 'active' ? ' (sürüyor)' : ' (sırada)'}</span>
                      </li>
                    );
                  })}
                </ol>
                <Progress value={state.percent} label="İçe aktarma" />
                <p className="flex justify-between type-body-sm text-fg-muted">
                  <span>{STAGES.find((s) => s.id === state.stage)?.label}</span>
                  <span>%{state.percent}</span>
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={Boolean(state.data.existing || state.data.problem)}>
                  Kütüphaneye ekle
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Vazgeç
                </Button>
              </div>
            )}
          </div>
        </form>
      ) : null}

      {state.phase === 'done' ? (
        <div className="flex flex-col gap-4">
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            Sonuç
          </h2>
          <Notice
            tone="success"
            title={`${state.song.title} eklendi`}
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={reset}>
                  Başka şarkı ekle
                </Button>
                <Link href={`/admin/songs/${state.song.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Kaydı aç
                </Link>
              </>
            }
          >
            Şarkı yayında; uygulamada aramada görünür.
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
