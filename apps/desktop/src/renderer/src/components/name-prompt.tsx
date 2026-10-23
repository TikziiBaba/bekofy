import { Button, Field, Input } from '@bekofy/ui';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

/** Tek alanlı ad sorma penceresi (yeni liste, yeniden adlandırma). Yerleşik <dialog>: odak içeride, Escape kapatır. */
export function NamePrompt({
  open,
  title,
  label,
  initial = '',
  confirmLabel,
  busy = false,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirmLabel: string;
  busy?: boolean;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setValue(initial);
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return setError('Bir ad yaz.');
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi. Tekrar dene.');
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-full max-w-[calc(var(--size-layout-panel)*1.3)] rounded-ui-xl border border-hairline bg-raised p-0 text-fg shadow-ui-lg backdrop:bg-backdrop"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-6">
        <h2 id={titleId} className="type-title-md">
          {title}
        </h2>
        <Field id={`${titleId}-name`} label={label} error={error}>
          {(p) => <Input {...p} autoFocus maxLength={100} value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
