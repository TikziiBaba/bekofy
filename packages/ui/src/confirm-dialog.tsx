'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button';
import { Notice } from './notice';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Silme gibi geri alınamaz işlemler "destructive"; düğme her yerde aynı renkte olur. */
  tone?: 'primary' | 'destructive';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Onay penceresi. Yerleşik <dialog> kullanılır: odak içeride kalır, Escape kapatır, kapanınca odak açan düğmeye döner.
 * İşlem sürerken (busy) Escape ve dışarı tıklama kapatmaz.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Vazgeç', tone = 'primary', busy = false, error, onConfirm, onClose }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="m-auto w-full max-w-[calc(var(--size-layout-panel)*1.4)] rounded-ui-xl border border-hairline bg-raised p-0 text-fg shadow-ui-lg backdrop:bg-backdrop"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="type-title-md">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="type-body-md text-fg-muted">
            {description}
          </div>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
