// İndirme bağlantıları: GitHub'daki son sürümün dosyaları. Saatte bir yenilenir.

import { GITHUB_REPO, RELEASES_URL } from './site';

export interface DownloadInfo {
  version: string | null;
  windowsUrl: string;
  /** Sürümde .apk yoksa null: Android düğmesi "yakında" olarak gösterilir. */
  androidUrl: string | null;
  sizeMb: number | null;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

const FALLBACK: DownloadInfo = { version: null, windowsUrl: RELEASES_URL, androidUrl: null, sizeMb: null };

/** GitHub yanıtından kurulum dosyalarını seçer. electron-builder adı: "Bekofy.Setup.1.4.1.exe". */
export function pickDownloads(release: { tag_name?: string; assets?: GitHubAsset[] } | null | undefined): DownloadInfo {
  const assets = release?.assets ?? [];
  const exe = assets.find((a) => /\.exe$/i.test(a.name));
  const apk = assets.find((a) => /\.apk$/i.test(a.name));
  const version = exe?.name.match(/(\d+\.\d+\.\d+)/)?.[1] ?? release?.tag_name?.match(/^v?(\d+\.\d+\.\d+)$/)?.[1] ?? null;
  return {
    version,
    windowsUrl: exe?.browser_download_url ?? RELEASES_URL,
    androidUrl: apk?.browser_download_url ?? null,
    sizeMb: exe ? Math.round(exe.size / 1_000_000) : null,
  };
}

export async function latestDownloads(): Promise<DownloadInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK;
    return pickDownloads(await res.json());
  } catch {
    return FALLBACK;
  }
}
