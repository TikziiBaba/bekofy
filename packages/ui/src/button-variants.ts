import { cva } from 'class-variance-authority';

// Düğme sınıfları ayrı dosyada: sunucu bileşenleri bağlantıları (Link) düğme gibi göstermek için çağırabilir.
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-pill type-label-md whitespace-nowrap select-none',
    'transition-[background-color,color,transform] duration-(--duration-fast) ease-standard active:scale-97',
    'disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) disabled:active:scale-100',
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-(--opacity-disabled) aria-disabled:active:scale-100',
    '[&_svg]:size-(--size-icon-sm) [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed',
        secondary: 'bg-fill text-fg hover:bg-fill-strong active:bg-pressed',
        ghost: 'text-fg hover:bg-hover active:bg-pressed',
        destructive: 'bg-danger text-on-danger hover:bg-danger-hover active:bg-danger-pressed',
      },
      size: {
        sm: 'min-h-(--size-control-sm) px-3 type-label-sm',
        md: 'min-h-(--button-height) px-5',
        lg: 'min-h-(--size-control-lg) px-6',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
