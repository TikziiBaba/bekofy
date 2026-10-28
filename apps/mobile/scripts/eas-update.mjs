// Uygulama içi güncelleme gönderir: npm run update -w @bekofy/mobile [-- <kanal>] (varsayılan production)
// Önce src/lib/changelog.json'a yeni kayıt ekleyin; uygulama açılışta onu "Uygulama güncellendi" penceresinde gösterir,
// güncelleme mesajı da o kayıttan alınır.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const changelog = JSON.parse(readFileSync(new URL('../src/lib/changelog.json', import.meta.url), 'utf8'));

const channel = process.argv[2] ?? 'production';
const entry = changelog.reduce((a, b) => (b.id > a.id ? b : a));
const message = `#${entry.id} ${entry.items.join(' · ')}`;
console.log(`Gönderilecek yenilikler (${channel}): ${message}\n`);

const { status } = spawnSync('npx', ['eas-cli@latest', 'update', '--channel', channel, '--environment', channel, '--message', JSON.stringify(message)], {
  cwd: APP,
  stdio: 'inherit',
  shell: true,
});
process.exit(status ?? 1);
