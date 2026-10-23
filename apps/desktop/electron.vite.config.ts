import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const SUPABASE = 'dtdsawyynetqlbosrvqo.supabase.co';
const MEDIA = 'music.bekirr.dev';

/**
 * İçerik güvenlik politikası yalnızca derlenmiş uygulamaya yazılır (geliştirme sunucusunun anlık yenileme
 * betikleri satır içidir). Betik yalnızca uygulamanın kendisinden; ağ yalnızca Supabase ve şarkı sözü servisi.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `media-src 'self' https://${MEDIA} https://${SUPABASE} bekofy-media:`,
  `connect-src 'self' https://${SUPABASE} wss://${SUPABASE} https://lrclib.net`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'bekofy-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<!-- CSP -->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } },
  },
  preload: {
    // Sandbox'lı preload CommonJS olmalı ve tek dosya olmalı.
    build: {
      externalizeDeps: false,
      rollupOptions: { input: { index: resolve('src/preload/index.ts') }, output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss(), csp()],
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html'), mini: resolve('src/renderer/mini.html') } },
    },
  },
});
