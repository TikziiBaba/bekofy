// Discord durumu: "Bekofy dinliyor" + şarkı, sanatçı, kapak ve ilerleme.
// Discord kapalıysa sessizce bekler, açılınca bağlanır. Kullanıcı ayarlardan kapatabilir.

import { Client } from '@xhayper/discord-rpc';
import type { PlayerSnapshot } from '../shared/ipc';
import { DISCORD_CLIENT_ID, SITE_URL } from './config';

let client: Client | null = null;
let ready = false;
let enabled = true;
let retry: NodeJS.Timeout | null = null;
let lastSnapshot: PlayerSnapshot | null = null;

function connect(): void {
  if (!DISCORD_CLIENT_ID || !enabled || client) return;
  client = new Client({ clientId: DISCORD_CLIENT_ID, transport: { type: 'ipc' } });
  client.on('ready', () => {
    ready = true;
    void apply(lastSnapshot);
  });
  client.on('disconnected', () => {
    ready = false;
    client = null;
    schedule();
  });
  client.login().catch(() => {
    ready = false;
    client = null;
    schedule();
  });
}

function schedule(): void {
  if (retry || !enabled) return;
  retry = setTimeout(() => {
    retry = null;
    connect();
  }, 30_000);
}

async function apply(s: PlayerSnapshot | null): Promise<void> {
  if (!client || !ready) return;
  try {
    if (!s?.song || !s.isPlaying) {
      await client.user?.clearActivity();
      return;
    }
    const start = s.at - s.position * 1000;
    await client.user?.setActivity({
      type: 2, // "Dinliyor"
      details: s.song.title.slice(0, 128),
      state: s.song.artist.slice(0, 128),
      largeImageKey: s.song.coverUrl ?? 'bekofy',
      largeImageText: (s.song.album ?? 'Bekofy').slice(0, 128),
      smallImageKey: 'bekofy',
      smallImageText: 'Bekofy',
      startTimestamp: Math.round(start),
      endTimestamp: s.song.duration ? Math.round(start + s.song.duration * 1000) : undefined,
      buttons: [{ label: 'Bekofy’yi indir', url: SITE_URL }],
    });
  } catch {
    // Discord bağlantısı koptuysa bir sonraki güncellemede yeniden denenir.
  }
}

export const discord = {
  start: connect,
  update(s: PlayerSnapshot | null): void {
    lastSnapshot = s;
    void apply(s);
  },
  setEnabled(on: boolean): void {
    enabled = on;
    if (on) connect();
    else void this.stop();
  },
  async stop(): Promise<void> {
    if (retry) clearTimeout(retry);
    retry = null;
    const c = client;
    client = null;
    ready = false;
    await c?.user?.clearActivity().catch(() => undefined);
    await c?.destroy().catch(() => undefined);
  },
};
