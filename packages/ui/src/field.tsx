import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/** Alanın denetimine (input, select, textarea) verilecek erişilebilirlik bağları. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Etiket + denetim + ipucu + hata. Hata, denetimin açıklamasına bağlanır ve ekran okuyucu onu okur. */
export function Field({ id, label, hint, error, optional = false, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="type-label-md">
        {label}
        {optional ? <span className="type-body-sm text-fg-muted"> (isteğe bağlı)</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <span id={hintId} className="type-body-sm text-fg-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="flex items-start gap-1.5 type-body-sm text-danger-fg">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-(--size-icon-xs) shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  );
}
