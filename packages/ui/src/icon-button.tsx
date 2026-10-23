import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export const iconButtonVariants = cva(
  [
    'inline-grid place-items-center shrink-0 rounded-pill text-fg-muted',
    'transition-colors duration-(--duration-fast) ease-standard',
    'hover:text-fg hover:bg-hover active:bg-pressed aria-pressed:text-accent-fg aria-expanded:text-accent-fg',
    'disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)',
    '[&_svg]:size-(--size-icon-sm) [&_svg]:shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'size-(--size-control-sm)',
        md: 'size-(--icon-button-size)',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type IconButtonProps = Omit<ComponentProps<'button'>, 'aria-label'> &
  VariantProps<typeof iconButtonVariants> & {
    /** Ekran okuyucunun okuyacağı ad; simge tek başına anlam taşımaz. */
    label: string;
  };

export function IconButton({ className, size, label, type = 'button', ...props }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} className={cn(iconButtonVariants({ size }), className)} {...props} />;
}
