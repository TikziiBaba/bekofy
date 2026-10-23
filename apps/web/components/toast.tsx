'use client';

import { useEffect, useState } from 'react';

const EVENT = 'bekofy:toast';

/** Kısa bildirim gösterir. Liste yenilenip satır kaybolsa da mesaj ekranda kalır. */
export function showToast(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }));
}

/** Sayfada bir kez: bildirimleri gösterir ve ekran okuyucuya duyurur. */
export function ToastRegion() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 5000);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-(--z-toast) flex justify-center px-4">
      {text ? (
        <p className="pointer-events-auto max-w-full rounded-pill bg-inverse px-5 py-3 type-label-md text-fg-inverse shadow-ui-lg motion-safe:animate-[toast-in_var(--duration-base)_var(--easing-enter)]">
          {text}
        </p>
      ) : null}
    </div>
  );
}
