// ===== Songs Module - Şarkı Renderleme =====

function createSongCard(song) {
  const coverHtml = song.cover_url
    ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`
    : `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3" width="48" height="48"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  return `
    <div class="song-card" data-song-id="${song.id}">
      <div class="song-card-cover">${coverHtml}
        <button class="song-card-play btn-play-song" data-song-id="${song.id}">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="song-card-info">
        <div class="song-card-title">${escapeHtml(song.title)}</div>
        <div class="song-card-artist">${formatArtistLinks(song.artist)}</div>
      </div>
    </div>`;
}

window.createSongCard = createSongCard;

function renderSongs(songs) {
  const container = document.getElementById('songs-list');
  if (!container) return;
  if (songs.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Şarkı bulunamadı</p></div>`;
    return;
  }
  container.innerHTML = songs.map(song => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="" class="song-row-cover" onerror="this.style.display='none'">`
      : `<div class="song-row-cover-placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" opacity="0.3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`;
    const liked = userLikedSongIds.has(song.id);
    return `
      <div class="song-row" data-song-id="${song.id}" draggable="true">
        <div class="song-row-cover">${coverHtml}</div>
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${formatArtistLinks(song.artist)}</div>
        </div>
        <div class="song-row-duration">${formatDuration(song.duration)}</div>
        <div class="song-row-actions">
          <button class="btn-icon btn-like-song ${liked ? 'liked' : ''}" data-song-id="${song.id}">
            <svg viewBox="0 0 24 24" fill="${liked ? 'var(--ts)' : 'none'}" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          <button class="btn-icon btn-add-to-queue" data-song-id="${song.id}" title="Sıraya Ekle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

window.renderSongs = renderSongs;

function renderSearchResults(songs, query, playlists = [], users = []) {
  const container = document.getElementById('search-results');
  let html = '';

  if (users.length > 0) {
    html += `
      <h2 class="section-title">👤 Kullanıcılar</h2>
      <div class="users-grid" style="display:flex;gap:12px;margin-bottom:24px;overflow-x:auto;padding-bottom:8px">
        ${users.map(u => {
      let frameClass = '';
      if (u.avatar_frame && u.avatar_frame !== 'none') {
        frameClass = ' ' + getAvatarFrameClass(u.avatar_frame);
      }
      const avatarHtml = u.avatar_url
        ? `<div class="search-avatar-wrapper${frameClass}" style="width:50px;height:50px;position:relative"><img src="${u.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;position:relative;z-index:2"></div>`
        : `<div class="search-avatar-wrapper${frameClass}" style="width:50px;height:50px;position:relative"><span style="width:100%;height:100%;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--ts);position:relative;z-index:2">${getInitials(u.username)}</span></div>`;
      return `
          <div class="user-search-card" data-user-id="${u.id}" data-user-role="${u.role}" data-user-name="${escapeHtml(u.username)}" style="background:var(--bg-card);padding:12px;border-radius:12px;display:flex;flex-direction:column;align-items:center;min-width:140px;border:1px solid var(--border)">
            ${avatarHtml}
            <div style="font-weight:600;margin-top:8px">${escapeHtml(u.username)}${u.role === 'artist' ? getVerifiedTick(u.username) : ''}</div>
            ${u.role === 'artist'
          ? `<button class="btn-primary-small btn-view-artist" data-artist-name="${escapeHtml(u.username)}" style="margin-top:12px;width:100%;padding:6px;background:var(--bg-card-hover);border:1px solid var(--border);color:var(--tp)">Profili Gör</button>`
          : `<button class="btn-primary-small btn-add-friend" data-user-id="${u.id}" style="margin-top:12px;width:100%;padding:6px">Arkadaş Ekle</button>`
        }
          </div>`;
    }).join('')}
      </div>
    `;
  }

  if (playlists.length > 0) {
    html += `
      <h2 class="section-title">🌐 Çalma Listeleri</h2>
      <div class="songs-grid">
        ${playlists.map(pl => {
      const coverHtml = pl.cover_url
        ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">`
        : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      const ownerName = pl.profiles?.username || 'Kullanıcı';
      return `
          <div class="song-card playlist-card" data-playlist-id="${pl.id}">
            <div class="song-card-cover">
              ${coverHtml}
            </div>
            <div class="song-card-title">${escapeHtml(pl.name)}</div>
            <div class="song-card-artist">${escapeHtml(ownerName)} <span class="playlist-card-public">🌐</span></div>
          </div>`;
    }).join('')}
      </div>
    `;
  }

  if (songs.length > 0) {
    html += `
      <h2 class="section-title">"${escapeHtml(query)}" için ${songs.length} şarkı</h2>
      <div class="songs-grid">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    `;
  }

  if (!html) {
    html = `<div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
  }

  container.innerHTML = html;
}

window.renderSearchResults = renderSearchResults;

async function toggleLikeSong(songId) {
  try {
    const sb = getSupabase();
    if (userLikedSongIds.has(songId)) {
      const { error } = await sb.from('liked_songs').delete()
        .eq('user_id', currentUserId).eq('song_id', songId);
      if (error) throw error;
      userLikedSongIds.delete(songId);
      showToast('Beğeni kaldırıldı', 'success');
    } else {
      const { error } = await sb.from('liked_songs').insert({ user_id: currentUserId, song_id: songId });
      if (error) throw error;
      userLikedSongIds.add(songId);
      showToast('Şarkı beğenildi! ❤️', 'success');
    }
    document.querySelectorAll(`[data-song-id="${songId}"].btn-like-song`).forEach(btn => {
      btn.classList.toggle('liked', userLikedSongIds.has(songId));
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', userLikedSongIds.has(songId) ? 'var(--green)' : 'none');
    });
  } catch (err) {
    showToast('İşlem başarısız', 'error');
  }
}

window.toggleLikeSong = toggleLikeSong;

function shareSong(song) {
  const shareText = `🎵 ${song.title} - ${song.artist} | Bekofy'de dinle`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      showToast('Panoya kopyalandı! 📋', 'success');
    });
  }
}

window.shareSong = shareSong;

async function loadLibraryPage() {
  try {
    const sb = getSupabase();
    const { data: likedSongs } = await sb.from('liked_songs')
      .select('song_id, songs!inner(*)')
      .eq('user_id', currentUserId);
    const songs = (likedSongs || []).map(ls => ls.songs);
    const container = document.getElementById('library-songs');
    if (container) {
      if (songs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Henüz şarkı beğenmedin</p></div>';
      } else {
        container.innerHTML = `<div class="songs-list">${songs.map(song => {
          const coverHtml = song.cover_url
            ? `<img src="${song.cover_url}" alt="" class="song-row-cover" onerror="this.style.display='none'">`
            : `<div class="song-row-cover-placeholder">🎵</div>`;
          return `
            <div class="song-row" data-song-id="${song.id}">
              <div class="song-row-cover">${coverHtml}</div>
              <div class="song-row-info">
                <div class="song-row-title">${escapeHtml(song.title)}</div>
                <div class="song-row-artist">${formatArtistLinks(song.artist)}</div>
              </div>
              <div class="song-row-duration">${formatDuration(song.duration)}</div>
            </div>`;
        }).join('')}</div>`;
      }
    }
    await loadUserPlaylists();
  } catch (err) {
    console.error('loadLibraryPage error:', err);
  }
}

window.loadLibraryPage = loadLibraryPage;

window.playSongFromAny = function(songId) {
  const song = allSongs.find(s => s.id == songId);
  if (!song) return;
  const idx = allSongs.indexOf(song);
  player.currentIndex = idx >= 0 ? idx : 0;
  searchResultSongs = allSongs;
  playSongFromPlaylist(allSongs, player.currentIndex);
};

// songs.js - Şarkı renderleme: kart oluşturma, liste gösterimi, beğenme, paylaşma, kütüphane
