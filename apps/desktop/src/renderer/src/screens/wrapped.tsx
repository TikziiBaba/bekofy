// Yılın özeti: hikaye kartları. Klavye: sol/sağ ok, Escape kapatır.

import { formatCount, yearSummary, type ListeningSummary } from '@bekofy/core';
import { Button, cn, IconButton } from '@bekofy/ui';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthed } from '../lib/session';
import { setUi } from '../lib/ui';

const PERSONA: Record<NonNullable<ListeningSummary['persona']>, [string, string]> = {
  'gece-kusu': ['Gece kuşu', 'Müziğin çoğunu gece yarısından sonra dinledin.'],
  sabahci: ['Sabahçı', 'Günün ilk saatleri senin müzik zamanın.'],
  gunduz: ['Gündüz dinleyicisi', 'Öğle ve ikindi saatlerinde müzik hep açık.'],
  aksamci: ['Akşamcı', 'Akşamları müzikle kapatıyorsun.'],
};

export function Wrapped() {
  const { sb, user } = useAuthed();
  const year = new Date().getFullYear();
  const q = useQuery({ queryKey: ['wrapped', user.id, year], queryFn: () => yearSummary(sb, user.id, year) });
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  const close = () => setUi({ wrapped: false });

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const s = q.data;
  const stories: Array<{ inverse?: boolean; body: ReactNode }> = !s
    ? []
    : s.plays === 0
      ? [{ body: <><h2 className="font-display text-(length:--font-size-3xl) font-bold">{year} özetin henüz boş</h2><p className="type-body-lg">Şarkı dinledikçe burada yılın birikir.</p></> }]
      : [
          { body: <><p className="type-body-lg">{year} yılında</p><p className="story-big">{formatCount(s.totalMinutes)}</p><p className="type-body-lg">dakika müzik dinledin.</p></> },
          ...(s.topSongs[0] ? [{ inverse: true, body: <><p className="type-body-lg">En çok dinlediğin şarkı</p><h2 className="font-display text-(length:--font-size-4xl) leading-(--font-line-height-tight) font-bold">{s.topSongs[0].title}</h2><p className="type-body-lg">{s.topSongs[0].plays} kez</p></> }] : []),
          ...(s.topArtists[0] ? [{ body: <><p className="type-body-lg">Yılın sanatçısı</p><h2 className="font-display text-(length:--font-size-4xl) leading-(--font-line-height-tight) font-bold">{s.topArtists[0].name}</h2><p className="type-body-lg">{s.topArtists[0].minutes} dakika</p></> }] : []),
          ...(s.persona ? [{ inverse: true, body: <><p className="type-body-lg">Dinleme kişiliğin</p><h2 className="font-display text-(length:--font-size-4xl) leading-(--font-line-height-tight) font-bold">{PERSONA[s.persona][0]}</h2><p className="type-body-lg">{PERSONA[s.persona][1]} Dinlemelerinin %{s.personaShare}'i bu saatlerde.</p></> }] : []),
          { body: <><p className="type-body-lg">En çok dinlediğin şarkılar</p><ol className="flex flex-col gap-2 type-title-sm">{s.topSongs.map((t, n) => <li key={t.id}>{n + 1}. {t.title}</li>)}</ol></> },
        ];
  const story = stories[Math.min(i, stories.length - 1)];

  return (
    <dialog
      ref={ref}
      aria-label={`${year} özetin`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, stories.length - 1));
        if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
      }}
      className="m-auto bg-transparent p-0 backdrop:bg-backdrop"
    >
      <div
        className={cn(
          'flex h-[min(calc(100dvh-var(--space-8)),calc(var(--size-artwork-2xl)*2))] w-[min(calc(100vw-var(--space-8)),calc(var(--size-artwork-2xl)+var(--space-16)))] flex-col gap-4 overflow-hidden rounded-ui-sheet p-6 shadow-ui-lg',
          story?.inverse ? 'bg-inverse text-fg-inverse' : 'bg-accent text-on-accent',
        )}
      >
        <div className="flex gap-1" aria-hidden="true">
          {stories.map((_, n) => (
            <span key={n} className={cn('h-1 flex-1 rounded-pill bg-current', n <= i ? 'opacity-100' : 'opacity-30')} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="type-label-md">Bekofy {year}</span>
          <IconButton label="Kapat" onClick={close} className="text-current hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] hover:text-current" autoFocus>
            <X aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-4 [&_.story-big]:font-display [&_.story-big]:text-[clamp(var(--font-size-5xl),14vw,var(--font-size-7xl))] [&_.story-big]:leading-(--font-line-height-display) [&_.story-big]:font-bold" aria-live="polite">
          {q.isLoading ? <p className="type-body-lg">Özetin hazırlanıyor</p> : q.error ? <p className="type-body-lg">Özet alınamadı. Daha sonra tekrar dene.</p> : story?.body}
        </div>
        <div className="flex justify-between gap-3">
          <Button variant="ghost" className="text-current hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]" disabled={i === 0} onClick={() => setI((v) => Math.max(v - 1, 0))}>
            Önceki
          </Button>
          {i < stories.length - 1 ? (
            <Button variant="ghost" className="text-current hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]" onClick={() => setI((v) => v + 1)}>
              Sonraki
            </Button>
          ) : (
            <Button variant="ghost" className="text-current hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]" onClick={close}>
              Bitir
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}
