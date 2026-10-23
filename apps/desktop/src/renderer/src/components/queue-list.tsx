import { IconButton } from '@bekofy/ui';
import { X } from 'lucide-react';
import { player, usePlayer } from '../lib/player';
import { Cover } from './cover';

/** Şimdi çalan ve sıradaki şarkılar. Elle eklenenler ("Sıradaki") kaldırılabilir. */
export function QueueList() {
  const p = usePlayer();
  const upNext = p.queue.upNext;
  const rest = player.upcoming(40).slice(upNext.length);

  if (!p.current) return <p className="text-fg-muted">Sıra boş. Bir şarkı ya da liste çal.</p>;

  const Row = ({ title, artist, cover, onRemove }: { title: string; artist: string; cover: string | null; onRemove?: () => void }) => (
    <li className="flex min-w-0 items-center gap-3 rounded-ui-md p-2 hover:bg-hover">
      <Cover src={cover} className="size-(--size-artwork-sm) rounded-art-sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label-md">{title}</span>
        <span className="truncate type-body-sm text-fg-muted">{artist}</span>
      </span>
      {onRemove ? (
        <IconButton size="sm" label={`Sıradan çıkar: ${title}`} onClick={onRemove}>
          <X aria-hidden="true" />
        </IconButton>
      ) : null}
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="q-now" className="flex flex-col gap-2">
        <h3 id="q-now" className="type-label-md text-fg-muted">
          Şimdi çalıyor
        </h3>
        <ul>
          <Row title={p.current.title} artist={p.current.artist} cover={p.current.cover_url} />
        </ul>
      </section>
      {upNext.length ? (
        <section aria-labelledby="q-up" className="flex flex-col gap-2">
          <h3 id="q-up" className="type-label-md text-fg-muted">
            Sıradaki (elle eklenenler)
          </h3>
          <ul className="flex flex-col gap-1">
            {upNext.map((t, i) => (
              <Row key={`${t.id}-${i}`} title={t.title} artist={t.artist} cover={t.cover_url} onRemove={() => player.removeUpNext(i)} />
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="q-rest" className="flex flex-col gap-2">
        <h3 id="q-rest" className="type-label-md text-fg-muted">
          Sonra çalacak
        </h3>
        {rest.length ? (
          <ul className="flex flex-col gap-1">
            {rest.map((t, i) => (
              <Row key={`${t.id}-r${i}`} title={t.title} artist={t.artist} cover={t.cover_url} />
            ))}
          </ul>
        ) : (
          <p className="type-body-sm text-fg-muted">{p.queue.repeat === 'all' ? 'Liste baştan çalacak.' : 'Bu şarkıdan sonra çalacak şarkı yok.'}</p>
        )}
      </section>
    </div>
  );
}
