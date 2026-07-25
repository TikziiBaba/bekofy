// ===== Artist Module - Sanatçı Profili =====

window.initArtistPage = function() {
  console.log('[DEBUG] initArtistPage called');
  const uploadForm = document.getElementById('artist-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('artist-song-title');
      const audioInput = document.getElementById('artist-song-file');
      const coverInput = document.getElementById('artist-song-cover');
      const title = titleInput?.value.trim();
      const audioFile = audioInput?.files[0];
      if (!title) { showToast('Şarkı adı gerekli', 'error'); return; }
      if (!audioFile) { showToast('Ses dosyası seçin', 'error'); return; }
      try {
        const sb = getSupabase();
        const audioPath = `songs/${window.currentUserId}_${Date.now()}_${audioFile.name}`;
        const { error: uploadErr } = await sb.storage.from('media').upload(audioPath, audioFile, { contentType: audioFile.type });
        if (uploadErr) throw uploadErr;
        const { data: audioUrlData } = sb.storage.from('media').getPublicUrl(audioPath);
        let coverUrl = '';
        if (coverInput?.files[0]) {
          const coverFile = coverInput.files[0];
          const coverPath = `covers/${window.currentUserId}_${Date.now()}_${coverFile.name}`;
          const { error: coverErr } = await sb.storage.from('media').upload(coverPath, coverFile, { contentType: coverFile.type });
          if (coverErr) throw coverErr;
          const { data: coverUrlData } = sb.storage.from('media').getPublicUrl(coverPath);
          coverUrl = coverUrlData.publicUrl;
        }
        const { error: insertErr } = await sb.from('songs').insert({
          title, artist: window.currentUserProfile?.username || 'Sanatçı',
          audio_url: audioUrlData.publicUrl, cover_url: coverUrl, added_by: window.currentUserId
        });
        if (insertErr) throw insertErr;
        showToast('Şarkı yüklendi! 🎵', 'success');
        titleInput.value = '';
        audioInput.value = '';
        coverInput.value = '';
        document.getElementById('artist-song-title-display') && (document.getElementById('artist-song-title-display').textContent = '');
        document.getElementById('artist-song-cover-preview') && (document.getElementById('artist-song-cover-preview').innerHTML = '');
        await loadAllSongs();
      } catch (err) {
        showToast('Yükleme başarısız: ' + (err.message || ''), 'error');
      }
    });
  }

  document.getElementById('artist-song-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const display = document.getElementById('artist-song-title-display');
    if (display) display.textContent = file ? file.name : '';
  });
};

async function loadArtistPage() {
  const container = document.getElementById('artist-uploaded-songs');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const { data: songs, error } = await sb.from('songs')
      .select('*')
      .eq('artist', window.currentUserProfile?.username || '')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (songs.length === 0) {
      container.innerHTML = '<p class="empty-state-text">Henüz şarkı yüklenmemiş</p>';
      return;
    }
    container.innerHTML = songs.map(song => {
      const coverHtml = song.cover_url
        ? `<img src="${song.cover_url}" alt="" style="width:50px;height:50px;border-radius:8px;object-fit:cover">`
        : `<div style="width:50px;height:50px;border-radius:8px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center">🎵</div>`;
      return `
        <div class="artist-song-item" data-song-id="${song.id}">
          ${coverHtml}
          <div class="artist-song-info">
            <div class="artist-song-title">${escapeHtml(song.title)}</div>
            <div class="artist-song-stats">Eklenme: ${new Date(song.created_at).toLocaleDateString('tr-TR')}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('loadArtistPage error:', err);
    container.innerHTML = '<p class="empty-state-text">Şarkılar yüklenemedi</p>';
  }
}

async function loadArtistProfile(artistName) {
  try {
    const sb = getSupabase();
    const { data: profile } = await sb.from('profiles')
      .select('id, username, avatar_url, avatar_frame, bio, role, created_at')
      .eq('username', artistName)
      .eq('role', 'artist')
      .single();
    if (!profile) {
      showToast('Sanatçı profili bulunamadı', 'error');
      return;
    }
    let songCount = 0;
    const { count } = await sb.from('songs')
      .select('*', { count: 'exact', head: true })
      .eq('artist', artistName);
    songCount = count || 0;
    let listenerCount = 0;
    try {
      const result = await getArtistListenerCount(artistName);
      if (result && result.count !== undefined) listenerCount = result.count;
    } catch { }
    const createdAt = new Date(profile.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });

    const popup = document.createElement('div');
    popup.className = 'artist-popup-overlay';
    popup.id = 'artist-popup-overlay';
    let frameClass = '';
    if (profile.avatar_frame && profile.avatar_frame !== 'none') {
      frameClass = ' ' + getAvatarFrameClass(profile.avatar_frame);
    }
    const avatarHtml = profile.avatar_url
      ? `<div class="artist-popup-avatar-wrapper${frameClass}"><img src="${profile.avatar_url}" alt="${escapeHtml(artistName)}" class="artist-popup-avatar"></div>`
      : `<div class="artist-popup-avatar-wrapper${frameClass}"><div class="artist-popup-avatar-placeholder">${getInitials(artistName)}</div></div>`;

    popup.innerHTML = `
      <div class="artist-popup-card" id="artist-popup-card">
        <button class="artist-popup-close" id="artist-popup-close-btn">✕</button>
        <div class="artist-popup-header">
          ${avatarHtml}
          <h2 class="artist-popup-name">${escapeHtml(artistName)}${getVerifiedTick(artistName, true)}</h2>
          <div class="artist-popup-subtitle">
            <span class="artist-popup-badge">🎤 Sanatçı</span>
          </div>
        </div>
        <div class="artist-popup-stats">
          <div class="artist-popup-stat">
            <div class="artist-popup-stat-value">${songCount}</div>
            <div class="artist-popup-stat-label">Şarkı</div>
          </div>
          <div class="artist-popup-stat">
            <div class="artist-popup-stat-value">${listenerCount}</div>
            <div class="artist-popup-stat-label">Dinleyici</div>
          </div>
        </div>
        <div class="artist-popup-meta">
          ${profile.bio ? `<p class="artist-popup-bio">${escapeHtml(profile.bio)}</p>` : ''}
          <p class="artist-popup-joined">📅 ${createdAt} katıldı</p>
        </div>
        <div class="artist-popup-actions">
          <button class="btn-primary artist-popup-play-btn" id="artist-popup-play-btn">🎵 Şarkıları Dinle</button>
          <button class="btn-secondary artist-popup-close-action" id="artist-popup-close-action-btn">Kapat</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    requestAnimationFrame(() => { popup.style.opacity = '1'; document.getElementById('artist-popup-card').style.transform = 'scale(1)'; });

    const closePopup = () => {
      popup.style.opacity = '0';
      document.getElementById('artist-popup-card').style.transform = 'scale(0.9)';
      setTimeout(() => { popup.remove(); }, 300);
    };

    document.getElementById('artist-popup-close-btn').addEventListener('click', closePopup);
    document.getElementById('artist-popup-close-action-btn').addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
    document.getElementById('artist-popup-play-btn').addEventListener('click', () => {
      closePopup();
      playArtistProfile(artistName);
    });
  } catch (err) {
    console.error('loadArtistProfile error:', err);
    showToast('Profil yüklenemedi', 'error');
  }
}

async function playArtistProfile(artistName) {
  const artistSongs = window.allSongs.filter(s => s.artist === artistName);
  if (artistSongs.length === 0) {
    showToast('Bu sanatçının şarkıları bulunamadı', 'error');
    return;
  }
  window.searchResultSongs = artistSongs;
  player.currentIndex = 0;
  playSongFromPlaylist(artistSongs, 0);
  navigateTo('search');
}

async function loadPublicUserProfile(userId) {
  try {
    const sb = getSupabase();
    const { data: profile } = await sb.from('profiles')
      .select('id, username, avatar_url, avatar_frame, bio, role, created_at')
      .eq('id', userId)
      .single();
    if (!profile) {
      showToast('Kullanıcı bulunamadı', 'error');
      return;
    }
    let songCount = 0;
    const { count } = await sb.from('songs')
      .select('*', { count: 'exact', head: true })
      .eq('added_by', userId);
    songCount = count || 0;
    let listenerCount = 0;
    try {
      const result = await getArtistListenerCount(profile.username);
      if (result && result.count !== undefined) listenerCount = result.count;
    } catch { }
    const createdAt = new Date(profile.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });

    const popup = document.createElement('div');
    popup.className = 'artist-popup-overlay';
    popup.id = 'artist-popup-overlay';
    let frameClass = '';
    if (profile.avatar_frame && profile.avatar_frame !== 'none') {
      frameClass = ' ' + getAvatarFrameClass(profile.avatar_frame);
    }
    const avatarHtml = profile.avatar_url
      ? `<div class="artist-popup-avatar-wrapper${frameClass}"><img src="${profile.avatar_url}" alt="${escapeHtml(profile.username)}" class="artist-popup-avatar"></div>`
      : `<div class="artist-popup-avatar-wrapper${frameClass}"><div class="artist-popup-avatar-placeholder">${getInitials(profile.username)}</div></div>`;
    const isArtist = profile.role === 'artist';
    const roleLabel = isArtist ? '🎤 Sanatçı' : profile.role === 'admin' ? '👑 Admin' : '👤 Kullanıcı';

    popup.innerHTML = `
      <div class="artist-popup-card" id="artist-popup-card">
        <button class="artist-popup-close" id="artist-popup-close-btn">✕</button>
        <div class="artist-popup-header">
          ${avatarHtml}
          <h2 class="artist-popup-name">${escapeHtml(profile.username)}${isArtist ? getVerifiedTick(profile.username, true) : ''}</h2>
          <div class="artist-popup-subtitle"><span class="artist-popup-badge">${roleLabel}</span></div>
        </div>
        <div class="artist-popup-stats">
          <div class="artist-popup-stat">
            <div class="artist-popup-stat-value">${songCount}</div>
            <div class="artist-popup-stat-label">Şarkı</div>
          </div>
          <div class="artist-popup-stat">
            <div class="artist-popup-stat-value">${listenerCount}</div>
            <div class="artist-popup-stat-label">Dinleyici</div>
          </div>
        </div>
        <div class="artist-popup-meta">
          ${profile.bio ? `<p class="artist-popup-bio">${escapeHtml(profile.bio)}</p>` : ''}
          <p class="artist-popup-joined">📅 ${createdAt} katıldı</p>
        </div>
        <div class="artist-popup-actions">
          ${isArtist ? '<button class="btn-primary artist-popup-play-btn" id="artist-popup-play-btn">🎵 Şarkıları Dinle</button>' : ''}
          <button class="btn-secondary artist-popup-close-action" id="artist-popup-close-action-btn">Kapat</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    requestAnimationFrame(() => { popup.style.opacity = '1'; document.getElementById('artist-popup-card').style.transform = 'scale(1)'; });

    const closePopup = () => {
      popup.style.opacity = '0';
      document.getElementById('artist-popup-card').style.transform = 'scale(0.9)';
      setTimeout(() => { popup.remove(); }, 300);
    };

    document.getElementById('artist-popup-close-btn').addEventListener('click', closePopup);
    document.getElementById('artist-popup-close-action-btn').addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
    if (isArtist) {
      document.getElementById('artist-popup-play-btn').addEventListener('click', () => {
        closePopup();
        playArtistProfile(profile.username);
      });
    }
  } catch (err) {
    console.error('loadPublicUserProfile error:', err);
    showToast('Profil yüklenemedi', 'error');
  }
}

// artist.js - Sanatçı: yükleme formu, profil popup, şarkı listeleme
