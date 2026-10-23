'use client';

import { IconButton, Input } from '@bekofy/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

/** Şifre alanı: göster/gizle düğmeli. Şifre yöneticileri ve yapıştırma serbest (WCAG 3.3.8). */
export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative flex">
      <Input {...props} type={visible ? 'text' : 'password'} className="pe-12" />
      <IconButton
        size="sm"
        label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute end-1 top-1/2 -translate-y-1/2 aria-pressed:text-fg-muted"
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </IconButton>
    </span>
  );
}
