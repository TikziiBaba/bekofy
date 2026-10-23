import { dark, light } from '@bekofy/tokens';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-bricolage', display: 'swap' });
const ui = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: müzik öne çıksın`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  openGraph: { type: 'website', locale: 'tr_TR', siteName: SITE_NAME, url: SITE_URL },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: dark.color.surface.page },
    { media: '(prefers-color-scheme: light)', color: light.color.surface.page },
  ],
};

// Tema, sayfa çizilmeden uygulanır (yanıp sönme olmaz). Varsayılan siyah; seçim tarayıcıda saklanır.
const themeScript = `try{var t=localStorage.getItem('bekofy-theme');if(t==='light'||t==='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="fixed start-2 top-2 z-(--z-toast) -translate-y-[200%] rounded-pill bg-inverse px-4 py-2 type-label-md text-fg-inverse focus:translate-y-0"
        >
          İçeriğe geç
        </a>
        {children}
      </body>
    </html>
  );
}
