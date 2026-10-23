import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const control = [
  'w-full rounded-ui-control border border-line-strong bg-fill text-fg',
  'placeholder:text-fg-subtle hover:bg-fill-strong',
  'aria-invalid:border-danger-fg',
  'disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)',
];

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'min-h-(--input-height) px-4', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-28 px-4 py-3 resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className="relative flex w-full">
      <select className={cn(control, 'min-h-(--input-height) appearance-none ps-4 pe-10 cursor-pointer', className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-3 top-1/2 size-(--size-icon-sm) -translate-y-1/2 text-fg-muted" />
    </span>
  );
}
