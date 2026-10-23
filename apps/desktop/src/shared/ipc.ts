// Ana süreç ile arayüz arasındaki sözleşme. Preload yalnızca bu dar API'yi açar; arayüz Node'a erişemez.

export interface NowPlaying {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  duration: number;
}

/** Oynatıcının anlık durumu: mini oynatıcıya ve Discord'a gider. */
export interface PlayerSnapshot {
  song: NowPlaying | null;
  isPlaying: boolean;
  /** Saniye. */
  position: number;
  /** Ölçüldüğü an (Date.now()); karşı taraf ilerlemeyi buradan hesaplar. */
  at: number;
}

export type MiniCommand = 'toggle-play' | 'next' | 'previous' | 'open-main' | 'close';

export interface OfflineSong {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  duration: number | null;
  downloaded_at: string;
}

export interface DownloadRequest {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  duration: number | null;
  /** Şarkının genel adresi (R2 ya da Supabase depolama). */
  url: string;
}

export type DownloadEvent = { id: string; state: 'progress'; percent: number } | { id: string; state: 'done' } | { id: string; state: 'error'; message: string };

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string };

export interface BekofyBridge {
  platform: string;
  version: string;
  window: {
    /** Başlık çubuğundaki pencere düğmelerinin renkleri temaya uyar. */
    setTheme(mode: 'dark' | 'light'): void;
  };
  openExternal(url: string): Promise<boolean>;
  auth: {
    /** bekofy://auth/callback?code=... dönüşleri (Google girişi). */
    onCallback(cb: (url: string) => void): () => void;
  };
  mini: {
    toggle(): void;
    publish(snapshot: PlayerSnapshot): void;
    onCommand(cb: (command: MiniCommand) => void): () => void;
    onVisibility(cb: (open: boolean) => void): () => void;
  };
  /** Yalnızca mini oynatıcı penceresinde. */
  miniWindow: {
    onSnapshot(cb: (snapshot: PlayerSnapshot) => void): () => void;
    command(command: MiniCommand): void;
  };
  discord: {
    setActivity(snapshot: PlayerSnapshot | null): void;
    setEnabled(enabled: boolean): void;
  };
  offline: {
    list(): Promise<OfflineSong[]>;
    download(request: DownloadRequest): Promise<{ ok: true } | { ok: false; error: string }>;
    remove(id: string): Promise<void>;
    onEvent(cb: (event: DownloadEvent) => void): () => void;
    /** İndirilmiş şarkının çalınabilir adresi (bekofy-media://). */
    mediaUrl(id: string): string;
  };
  covers: {
    /** Kapak görselinin baskın rengi (#rrggbb); okunamazsa null. Ana süreçte hesaplanır (CORS gerekmez). */
    seed(url: string): Promise<string | null>;
  };
  updates: {
    onStatus(cb: (status: UpdateStatus) => void): () => void;
    install(): void;
  };
}

export const CHANNELS = {
  setTheme: 'window:set-theme',
  openExternal: 'shell:open-external',
  authCallback: 'auth:callback',
  miniToggle: 'mini:toggle',
  miniPublish: 'mini:publish',
  miniSnapshot: 'mini:snapshot',
  miniCommand: 'mini:command',
  miniVisibility: 'mini:visibility',
  discordActivity: 'discord:activity',
  discordEnabled: 'discord:enabled',
  offlineList: 'offline:list',
  offlineDownload: 'offline:download',
  offlineRemove: 'offline:remove',
  offlineEvent: 'offline:event',
  coverSeed: 'covers:seed',
  updateStatus: 'updates:status',
  updateInstall: 'updates:install',
} as const;

export const MEDIA_SCHEME = 'bekofy-media';
export const DEEP_LINK_SCHEME = 'bekofy';
export const OAUTH_REDIRECT = `${DEEP_LINK_SCHEME}://auth/callback`;

/** Supabase kimlikleri ve şarkı kimlikleri: uuid biçimi. Dosya yolu oluşturmadan önce denetlenir. */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
