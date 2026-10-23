'use client';

import type { ComponentProps } from 'react';
import { cn } from './cn';

export type SwitchProps = Omit<ComponentProps<'button'>, 'onChange' | 'role'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Açma/kapama. Adını aria-label ya da aria-labelledby ile almalı. */
export function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group relative h-(--size-control-sm) w-[calc(var(--size-control-sm)*1.6)] shrink-0 rounded-pill border border-line-strong bg-fill-strong',
        'transition-colors duration-(--duration-base) ease-standard aria-checked:border-accent aria-checked:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute start-0.5 top-0.5 aspect-square h-[calc(var(--size-control-sm)-var(--space-1)-var(--size-border-hairline)*2)] rounded-pill bg-fg',
          'transition-transform duration-(--duration-base) ease-standard',
          'group-aria-checked:translate-x-[calc(var(--size-control-sm)*0.6)] group-aria-checked:bg-on-accent rtl:group-aria-checked:-translate-x-[calc(var(--size-control-sm)*0.6)]',
        )}
      />
    </button>
  );
}
