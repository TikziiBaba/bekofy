import { Button } from '@bekofy/ui';
import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../../shared/ipc';
import { bridge } from '../lib/bridge';

/** Yeni sürüm indirildiğinde içerik alanının üstünde görünür. */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  useEffect(() => bridge?.updates.onStatus(setStatus), []);
  if (status.state !== 'ready' && status.state !== 'downloading') return null;
  return (
    <div role="status" className="sticky top-0 z-(--z-sticky) flex flex-wrap items-center justify-between gap-3 border-b border-success-line bg-success-bg px-6 py-3 type-body-sm text-success-fg">
      {status.state === 'downloading' ? (
        <span>
          Bekofy {status.version} indiriliyor: %{status.percent}
        </span>
      ) : (
        <>
          <span>Bekofy {status.version} hazır. Yeniden başlatınca yüklenir.</span>
          <Button size="sm" onClick={() => bridge?.updates.install()}>
            Yeniden başlat ve güncelle
          </Button>
        </>
      )}
    </div>
  );
}
