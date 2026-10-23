'use client';

import { Button, ConfirmDialog } from '@bekofy/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reviewRequest } from '@/app/actions/admin';
import { showToast } from '@/components/toast';

export function RequestActions({ id, artistName, username }: { id: string; artistName: string; username: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(approve: boolean) {
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    const res = await reviewRequest(id, approve);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setConfirm(false);
    showToast(approve ? `${artistName} onaylandı; @${username} artık sanatçı.` : `${artistName} başvurusu reddedildi.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" loading={busy === 'approve'} onClick={() => run(true)}>
        Onayla
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
        Reddet
      </Button>
      {error && !confirm ? (
        <p role="alert" className="w-full type-body-sm text-danger-fg">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Başvuru reddedilsin mi?"
        description={`@${username} kullanıcısının “${artistName}” başvurusu reddedilecek. Kullanıcı yeniden başvurabilir.`}
        confirmLabel="Reddet"
        tone="destructive"
        busy={busy === 'reject'}
        error={confirm ? error : null}
        onConfirm={() => run(false)}
        onClose={() => {
          setConfirm(false);
          setError(null);
        }}
      />
    </div>
  );
}
