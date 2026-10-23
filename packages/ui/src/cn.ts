import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge'e temanın adlarını öğretir; yoksa "rounded-ui-card rounded-pill" gibi çakışmalar ayıklanmaz.
const merge = extendTailwindMerge<'type-style'>({
  extend: {
    theme: {
      color: [
        'page', 'raised', 'sunken', 'inverse', 'fg', 'fg-muted', 'fg-subtle', 'fg-disabled', 'fg-inverse', 'line', 'line-strong',
        'fill', 'fill-strong', 'hover', 'pressed', 'accent', 'on-accent', 'accent-fg', 'ring', 'brand', 'danger', 'on-danger',
        'danger-fg', 'danger-bg', 'danger-line', 'warning-fg', 'warning-bg', 'warning-line', 'success-fg', 'success-bg',
        'success-line', 'info-fg', 'info-bg', 'info-line', 'glass', 'glass-soft', 'edge', 'hairline', 'backdrop',
      ],
      radius: ['ui-xs', 'ui-sm', 'ui-md', 'ui-lg', 'ui-xl', 'ui-2xl', 'pill', 'ui-card', 'ui-control', 'ui-sheet', 'art-sm', 'art-md', 'art-lg'],
      shadow: ['ui-sm', 'ui-md', 'ui-lg', 'ui-glass'],
      font: ['display', 'ui', 'code'],
      ease: ['standard', 'enter', 'exit', 'emphasized'],
    },
    classGroups: {
      'type-style': [{ type: ['display-xl', 'display-lg', 'title-xl', 'title-lg', 'title-md', 'title-sm', 'body-lg', 'body-md', 'body-sm', 'label-md', 'label-sm', 'caption', 'mono', 'hero', 'headline'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
