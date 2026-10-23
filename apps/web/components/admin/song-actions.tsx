'use client';

import { Button, buttonVariants, ConfirmDialog } from '@bekofy/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveSong, deleteSongAction, rejectSong } from '@/app/actions/admin';
import { showToast } from '@/components/toast';

type Pending = 'approve' | 'reject' | 'delete' | null;

/** Satır eylemleri: onayla, reddet (dosyalar silinir), düzenle, sil. Geri alınamayanlar onay ister. */
export function SongActions({
  id,
  title,
  status,
  showEdit = true,
  afterDelete,
}: {
  id: string;
  title: string;
  status: string;
  showEdit?: boolean;
  /** Silindikten sonra gidilecek sayfa (düzenleme sayfasında liste). */
  afterDelete?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'reject' | 'delete' | null>(null);
  const [busy, setBusy] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: Exclude<Pending, null>) {
    setBusy(kind);
    setError(null);
    const res = kind === 'approve' ? await approveSong(id) : kind === 'reject' ? await rejectSong(id) : await deleteSongAction(id);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDialog(null);
    const warning = res.data && typeof res.data === 'object' && 'warning' in res.data ? res.data.warning : null;
    showToast(warning ?? (kind === 'approve' ? `${title} yayına alındı.` : kind === 'reject' ? `${title} reddedildi, dosyaları silindi.` : `${title} silindi.`));
    if (kind === 'delete' && afterDelete) router.push(afterDelete);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === 'pending' ? (
        <>
          <Button size="sm" loading={busy === 'approve'} onClick={() => run('approve')} aria-label={`Onayla: ${title}`}>
            Onayla
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog('reject')} aria-label={`Reddet: ${title}`}>
            Reddet
          </Button>
        </>
      ) : null}
      {showEdit ? (
        <Link href={`/admin/songs/${id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })} aria-label={`Düzenle: ${title}`}>
          Düzenle
        </Link>
      ) : null}
      <Button size="sm" variant="ghost" className="text-danger-fg" onClick={() => setDialog('delete')} aria-label={`Sil: ${title}`}>
        Sil
      </Button>
      {error && !dialog ? (
        <p role="alert" className="w-full text-end type-body-sm text-danger-fg">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Şarkı reddedilsin mi?"
        description={`${title} yayına alınmayacak ve R2’deki ses ile kapak dosyaları silinecek. Bu geri alınamaz.`}
        confirmLabel="Reddet ve dosyaları sil"
        tone="destructive"
        busy={busy === 'reject'}
        error={dialog === 'reject' ? error : null}
        onConfirm={() => run('reject')}
        onClose={() => {
          setDialog(null);
          setError(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Şarkı silinsin mi?"
        description={`${title} kütüphaneden, çalma listelerinden ve beğenilerden kalkacak; dosyaları R2’den silinecek. Bu geri alınamaz.`}
        confirmLabel="Kalıcı olarak sil"
        tone="destructive"
        busy={busy === 'delete'}
        error={dialog === 'delete' ? error : null}
        onConfirm={() => run('delete')}
        onClose={() => {
          setDialog(null);
          setError(null);
        }}
      />
    </div>
  );
}
