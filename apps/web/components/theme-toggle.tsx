'use client';

import { IconButton } from '@bekofy/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
const ORDER: Theme[] = ['dark', 'light', 'system'];
const META = {
  dark: { Icon: Moon, label: 'Koyu' },
  light: { Icon: Sun, label: 'Açık' },
  system: { Icon: Monitor, label: 'Sistem' },
} as const;

/** Koyu, açık ve sisteme uy arasında geçiş. Seçim tarayıcıda saklanır; kök düzendeki betik ilk çizimde uygular. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light' || current === 'system') setTheme(current);
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'dark';
  const { Icon, label } = META[theme];

  return (
    <IconButton
      label={`Tema: ${label}. ${META[next].label} temaya geç`}
      onClick={() => {
        if (next === 'dark') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', next);
        try {
          localStorage.setItem('bekofy-theme', next);
        } catch {
          // Depolama kapalıysa seçim yalnızca bu sayfada geçerli olur.
        }
        setTheme(next);
      }}
    >
      <Icon aria-hidden="true" />
    </IconButton>
  );
}
