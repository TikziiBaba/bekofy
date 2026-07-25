// ===== Context Menu Module - Sağ Tık Menüsü =====

var contextMenuSong = null;

window.initContextMenu = function() {
  document.addEventListener('click', () => hideContextMenu());

  document.getElementById('ctx-play-next')?.addEventListener('click', () => {
    if (!contextMenuSong) return;
    player.queue.splice(player.currentIndex + 1, 0, contextMenuSong);
    showToast('Sıraya eklendi', 'success');
  });

  document.getElementById('ctx-add-queue')?.addEventListener('click', () => {
    if (!contextMenuSong) return;
    player.queue.push(contextMenuSong);
    showToast('Sıraya eklendi', 'success');
  });

  document.getElementById('ctx-add-playlist')?.addEventListener('click', () => {
    if (!contextMenuSong) return;
    openAddToPlaylistModal(contextMenuSong);
  });

  document.getElementById('ctx-like')?.addEventListener('click', async () => {
    if (!contextMenuSong) return;
    await toggleLikeSong(contextMenuSong.id);
  });

  document.getElementById('ctx-share')?.addEventListener('click', () => {
    if (!contextMenuSong) return;
    shareSong(contextMenuSong);
  });
};

function showSongContextMenu(x, y, song) {
  contextMenuSong = song;
  const menu = document.getElementById('song-context-menu');
  if (!menu) return;

  const liked = userLikedSongIds.has(song.id);
  const likeBtn = document.getElementById('ctx-like');
  if (likeBtn) likeBtn.textContent = liked ? '💔 Beğeniyi Kaldır' : '❤️ Beğen';

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'block';
  requestAnimationFrame(() => menu.classList.add('active'));
}

function hideContextMenu() {
  const menu = document.getElementById('song-context-menu');
  if (menu) {
    menu.classList.remove('active');
    setTimeout(() => { menu.style.display = 'none'; }, 150);
  }
  contextMenuSong = null;
}

// context.js - Sağ tık menüsü: sıraya ekleme, beğenme, paylaşma
