import { cn } from '@bekofy/ui';
import { useId, useRef, type ReactNode } from 'react';

/**
 * Açılır menü: tarayıcının popover özelliğiyle (dışarı tıklama ve Escape kapatır). Konum, açılırken
 * tetikleyicinin yanına hesaplanır ve pencereden taşmaz. İçerik düğme/bağlantı listesidir.
 */
export function Menu({ label, trigger, children, className }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = () => pop.current?.hidePopover();

  return (
    <>
      <button
        ref={btn}
        type="button"
        popoverTarget={`menu-${id}`}
        aria-label={label}
        title={label}
        className={cn(
          'inline-grid size-(--size-control-sm) shrink-0 place-items-center rounded-pill text-fg-muted hover:bg-hover hover:text-fg [&_svg]:size-(--size-icon-sm)',
          className,
        )}
      >
        {trigger}
      </button>
      <div
        ref={pop}
        id={`menu-${id}`}
        popover="auto"
        aria-label={label}
        onToggle={(e) => {
          if ((e as unknown as ToggleEvent).newState !== 'open' || !btn.current || !pop.current) return;
          const r = btn.current.getBoundingClientRect();
          const p = pop.current.getBoundingClientRect();
          const top = r.bottom + p.height + 8 > window.innerHeight ? Math.max(8, r.top - p.height - 4) : r.bottom + 4;
          const left = Math.min(Math.max(8, r.right - p.width), window.innerWidth - p.width - 8);
          pop.current.style.top = `${top}px`;
          pop.current.style.left = `${left}px`;
          pop.current.querySelector<HTMLElement>('button, a')?.focus();
        }}
        className="glass-chrome fixed m-0 max-h-[60vh] w-[calc(var(--size-layout-panel)*0.85)] overflow-y-auto rounded-ui-lg p-1.5 text-fg shadow-ui-lg"
      >
        {children(close)}
      </div>
    </>
  );
}

export const menuItem = 'flex min-h-(--size-touch) w-full items-center gap-3 rounded-ui-md px-3 text-start type-label-md hover:bg-hover [&_svg]:size-(--size-icon-sm) [&_svg]:shrink-0';
