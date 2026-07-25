// ===== Lyrics Module - Sözler =====

window.initLyricsToggle = function() {
  const lyricsToggle = document.getElementById('lyrics-toggle');
  if (!lyricsToggle) return;
  lyricsToggle.addEventListener('click', async () => {
    if (!player.getCurrentSong()) return;
    const content = document.getElementById('lyrics-content');
    const icon = lyricsToggle.querySelector('.lyrics-icon');
    const text = lyricsToggle.querySelector('.lyrics-text');
    if (content.style.display === 'block') {
      content.style.display = 'none';
      icon.textContent = '🎤';
      text.textContent = 'Sözler';
      return;
    }
    icon.textContent = '⏳';
    text.textContent = 'Yükleniyor...';
    content.style.display = 'block';
    try {
      const currentSong = player.getCurrentSong();
      const result = await fetchLyrics(currentSong.title, currentSong.artist);
      if (result.error) {
        content.innerHTML = `<div class="lyrics-empty">Bu şarkı için söz bulunamadı 😔</div>`;
      } else {
        const lines = result.lyrics.split('\n').filter(l => l.trim());
        content.innerHTML = `<div class="lyrics-text-container">${lines.map((line, i) => `<p class="lyric-line" data-index="${i}">${line}</p>`).join('')}</div>`;
      }
      icon.textContent = '🎤';
      text.textContent = 'Sözler';
    } catch (err) {
      content.innerHTML = `<div class="lyrics-empty">Şarkı sözleri alınamadı</div>`;
      icon.textContent = '🎤';
      text.textContent = 'Sözler';
    }
  });
};

window.initLyricShare = function() {
  document.addEventListener('click', (e) => {
    const line = e.target.closest('.lyric-line');
    if (!line) return;
    const text = line.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Satır kopyalandı! 📋', 'success');
      });
    }
  });
};

window.initLyricsSyncControls = function() {};
