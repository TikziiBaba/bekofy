const youtubedl = require('youtube-dl-exec');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function downloadToMp3(url) {
  const safeName = `audio-${Date.now()}`;
  const tempDir = os.tmpdir();
  const templatePath = path.join(tempDir, `${safeName}.%(ext)s`);

  // Run youtube-dl-exec to download and extract audio
  await youtubedl(url, {
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: 0,
    output: templatePath,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    addHeader: [
      'referer:youtube.com',
      'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
    ]
  });

  // Find the exact downloaded file (it might have an unexpected suffix if yt-dlp decided, but usually it's just .mp3)
  const files = fs.readdirSync(tempDir);
  const downloadedFile = files.find(f => f.startsWith(safeName) && f.endsWith('.mp3'));
  
  if (!downloadedFile) {
    throw new Error('İndirme tamamlandı ancak MP3 dosyası bulunamadı.');
  }

  return path.join(tempDir, downloadedFile);
}

module.exports = { downloadToMp3 };
