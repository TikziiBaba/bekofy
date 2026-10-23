import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

const TONES = {
  info: { box: 'bg-info-bg text-info-fg border-info-line', Icon: Info },
  success: { box: 'bg-success-bg text-success-fg border-success-line', Icon: CircleCheck },
  warning: { box: 'bg-warning-bg text-warning-fg border-warning-line', Icon: TriangleAlert },
  danger: { box: 'bg-danger-bg text-danger-fg border-danger-line', Icon: CircleAlert },
} as const;

export interface NoticeProps {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  children?: ReactNode;
  /** Altta gösterilecek eylemler (düğmeler, bağlantılar). */
  actions?: ReactNode;
  className?: string;
  /** Hata varsayılan olarak "alert", diğerleri "status" olarak duyurulur. */
  role?: 'alert' | 'status' | 'none';
}

export function Notice({ tone = 'info', title, children, actions, className, role }: NoticeProps) {
  const { box, Icon } = TONES[tone];
  const ariaRole = role ?? (tone === 'danger' ? 'alert' : 'status');
  return (
    <div role={ariaRole === 'none' ? undefined : ariaRole} className={cn('flex items-start gap-3 rounded-ui-lg border p-4 type-body-sm', box, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-(--size-icon-sm) shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <strong className="type-label-md">{title}</strong> : null}
        {children ? <div className="[overflow-wrap:anywhere]">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
