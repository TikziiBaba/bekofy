'use client';

import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { buttonVariants } from './button-variants';
import { cn } from './cn';
import { Spinner } from './spinner';

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Süren işlem: düğme odakta kalır ama tıklanmaz; ekran okuyucuya "meşgul" bildirilir. */
    loading?: boolean;
  };

export function Button({ className, variant, size, loading = false, type = 'button', onClick, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || props['aria-disabled'] || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
