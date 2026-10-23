import { useEffect, useState } from 'react';

const EVENT = 'bekofy:toast';

/** Kısa bildirim; ekran okuyucuya da duyurulur. */
export function showToast(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }));
}

export function ToastRegion() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 3500);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--size-layout-player)+var(--space-6))] z-(--z-toast) flex justify-center px-4">
      {text ? <p className="max-w-full rounded-pill bg-inverse px-5 py-3 type-label-md text-fg-inverse shadow-ui-lg motion-safe:animate-[toast-in_var(--duration-base)_var(--easing-enter)]">{text}</p> : null}
    </div>
  );
}
