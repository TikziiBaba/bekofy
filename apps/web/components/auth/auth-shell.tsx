import type { ReactNode } from 'react';

/** Giriş, kayıt ve şifre sayfalarının ortak kartı. */
export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[calc(var(--size-layout-panel)*1.5)] flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="glass-panel flex flex-col gap-6 rounded-ui-xl p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="type-title-xl">{title}</h1>
          {description ? <p className="text-fg-muted">{description}</p> : null}
        </div>
        {children}
      </div>
      {footer ? <div className="text-center type-body-sm text-fg-muted">{footer}</div> : null}
    </div>
  );
}
