'use client';

import { cn } from '@bekofy/ui';
import { Upload } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Dosya seçici: gerçek <input type="file"> görünmez ama klavyeyle odaklanır; görünen etiket düğme gibi davranır.
 * Hata ve ipucu, input'un açıklamasına bağlanır.
 */
export function FilePicker({
  id,
  label,
  accept,
  hint,
  error,
  onFile,
  className,
}: {
  id: string;
  label: string;
  accept: string;
  hint?: ReactNode;
  error?: string | null;
  onFile: (file: File | null) => void;
  className?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="inline-flex min-h-(--size-control-sm) cursor-pointer items-center gap-2 self-start rounded-pill bg-fill px-3 type-label-sm hover:bg-fill-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
      >
        <Upload aria-hidden="true" className="size-(--size-icon-xs)" />
        {label}
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {hint ? (
        <span id={`${id}-hint`} className="type-body-sm text-fg-muted [overflow-wrap:anywhere]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="type-body-sm text-danger-fg">
          {error}
        </span>
      ) : null}
    </div>
  );
}
