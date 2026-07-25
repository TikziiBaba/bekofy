// ===== Admin Module - Admin Paneli =====

window.initAdminActions = function() {
  if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'yetkili') return;

  document.getElementById('admin-users-tab')?.addEventListener('click', () => switchAdminTab('users'));
  document.getElementById('admin-songs-tab')?.addEventListener('click', () => switchAdminTab('songs'));
  document.getElementById('admin-artists-tab')?.addEventListener('click', () => switchAdminTab('artists'));
  document.getElementById('admin-requests-tab')?.addEventListener('click', () => switchAdminTab('requests'));

  document.getElementById('add-song-btn')?.addEventListener('click', openAddSongModal);
  document.getElementById('cancel-add-song')?.addEventListener('click', () => document.getElementById('add-song-modal').classList.remove('active'));
  document.getElementById('confirm-add-song')?.addEventListener('click', addSong);
  document.getElementById('cancel-delete-song')?.addEventListener('click', () => document.getElementById('delete-song-modal').classList.remove('active'));
  document.getElementById('cancel-delete-artist')?.addEventListener('click', () => document.getElementById('delete-artist-modal').classList.remove('active'));
  document.getElementById('cancel-delete-user')?.addEventListener('click', () => document.getElementById('delete-user-modal').classList.remove('active'));
  document.getElementById('cancel-delete-album')?.addEventListener('click', () => document.getElementById('delete-album-modal').classList.remove('active'));
};

window.initAdminModalListeners = function() {
  document.getElementById('confirm-delete-song')?.addEventListener('click', deleteSong);
  document.getElementById('confirm-delete-artist')?.addEventListener('click', deleteArtist);
  document.getElementById('confirm-delete-user')?.addEventListener('click', deleteUser);
  document.getElementById('confirm-delete-album')?.addEventListener('click', deleteAlbum);

  document.getElementById('admin-users-list')?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.btn-danger');
    if (deleteBtn) {
      const userId = deleteBtn.dataset.userId;
      const userCard = deleteBtn.closest('.admin-user-card');
      const username = userCard?.querySelector('h3')?.textContent || 'Kullanıcı';
      document.getElementById('delete-user-id-value').value = userId;
      document.getElementById('delete-user-name-value').textContent = username;
      document.getElementById('delete-user-modal').classList.add('active');
      return;
    }

    const roleSelect = e.target.closest('.admin-user-role-select');
    if (roleSelect) {
      await changeUserRole(roleSelect.dataset.userId, roleSelect.value);
    }
  });

  document.getElementById('admin-songs-list')?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.btn-danger');
    if (deleteBtn) {
      const songId = deleteBtn.dataset.songId;
      const songCard = deleteBtn.closest('.song-card');
      const songTitle = songCard?.querySelector('.song-card-title')?.textContent || 'Şarkı';
      document.getElementById('delete-song-id-value').value = songId;
      document.getElementById('delete-song-name-value').textContent = songTitle;
      document.getElementById('delete-song-modal').classList.add('active');
      return;
    }
    const row = e.target.closest('.admin-song-card, .song-card');
    if (row && !e.target.closest('.btn-danger') && !e.target.closest('.btn-play')) {
      const songId = row.dataset.songId;
      if (songId) playSongFromAny(songId);
    }
  });
};

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(panel => panel.style.display = 'none');
  document.getElementById(`admin-${tab}-tab`)?.classList.add('active');
  const panel = document.getElementById(`admin-${tab}-panel`);
  if (panel) panel.style.display = 'block';
  if (tab === 'users') loadAdminUsers();
  else if (tab === 'songs') loadAdminSongs();
  else if (tab === 'artists') loadAdminArtists();
  else if (tab === 'requests') loadAdminRequests();
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    container.innerHTML = users.map(u => `
      <div class="admin-user-card" data-user-id="${u.id}">
        <div class="admin-user-header">
          ${u.avatar_url
      ? `<img src="${u.avatar_url}" alt="${escapeHtml(u.username)}" class="admin-user-avatar">`
      : `<div class="admin-user-avatar-placeholder">${getInitials(u.username)}</div>`
    }
          <div class="admin-user-info">
            <h3>${escapeHtml(u.username)}${u.role === 'admin' ? ' <span style="color:var(--ts)">👑 Admin</span>' : u.role === 'yetkili' ? ' <span style="color:var(--ps)">⭐ Yetkili</span>' : u.role === 'artist' ? getVerifiedTick(u.username) : ''}</h3>
            <p>${escapeHtml(u.email || 'Email yok')}</p>
            <p class="admin-user-role">Kayıt: ${new Date(u.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>
        <div class="admin-user-actions">
          <select class="admin-user-role-select" data-user-id="${u.id}">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Kullanıcı</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="yetkili" ${u.role === 'yetkili' ? 'selected' : ''}>Yetkili</option>
            <option value="artist" ${u.role === 'artist' ? 'selected' : ''}>Sanatçı</option>
          </select>
          <button class="btn btn-danger btn-small" data-user-id="${u.id}">Kaldır</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadAdminUsers error:', err);
    container.innerHTML = '<p class="empty-state-text">Kullanıcılar yüklenemedi</p>';
  }
}

async function loadAdminSongs() {
  const container = document.getElementById('admin-songs-list');
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const { data: songs, error } = await sb.from('songs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    container.innerHTML = songs.map(song => {
      const coverHtml = song.cover_url
        ? `<img src="${song.cover_url}" alt="" style="width:50px;height:50px;border-radius:8px;object-fit:cover">`
        : `<div style="width:50px;height:50px;border-radius:8px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--ts)">🎵</div>`;
      return `
        <div class="admin-song-card song-card" data-song-id="${song.id}">
          ${coverHtml}
          <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(song.title)}</div>
            <div class="song-card-artist">${formatArtistLinks(song.artist)}</div>
          </div>
          <div class="song-card-actions">
            <button class="btn btn-small btn-play" data-song-id="${song.id}">▶</button>
            <button class="btn btn-small btn-danger" data-song-id="${song.id}">Kaldır</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSongFromAny(btn.dataset.songId);
      });
    });
  } catch (err) {
    console.error('loadAdminSongs error:', err);
    container.innerHTML = '<p class="empty-state-text">Şarkılar yüklenemedi</p>';
  }
}

async function loadAdminArtists() {
  const container = document.getElementById('admin-artists-list');
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const { data: artists, error } = await sb.from('artists').select('*').order('name');
    if (error) throw error;
    container.innerHTML = artists.map(a => `
      <div class="admin-song-card song-card" data-artist-id="${a.id}">
        <div style="display:flex;align-items:center;gap:12px">
          ${a.avatar_url
      ? `<img src="${a.avatar_url}" alt="" style="width:50px;height:50px;border-radius:50%;object-fit:cover">`
      : `<div style="width:50px;height:50px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:var(--ts)">${getInitials(a.name)}</div>`
    }
          <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(a.name)}</div>
            <div class="song-card-artist">${escapeHtml(a.bio || 'Biyografi yok')}</div>
          </div>
        </div>
        <div class="song-card-actions">
          <button class="btn btn-small btn-danger" data-artist-id="${a.id}">Kaldır</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const artistId = btn.dataset.artistId;
        const card = btn.closest('.admin-song-card');
        const artistName = card?.querySelector('.song-card-title')?.textContent || 'Sanatçı';
        document.getElementById('delete-artist-id-value').value = artistId;
        document.getElementById('delete-artist-name-value').textContent = artistName;
        document.getElementById('delete-artist-modal').classList.add('active');
      });
    });
  } catch (err) {
    console.error('loadAdminArtists error:', err);
    container.innerHTML = '<p class="empty-state-text">Sanatçılar yüklenemedi</p>';
  }
}

async function loadAdminRequests() {
  const container = document.getElementById('admin-requests-list');
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const { data: requests, error } = await sb.from('upload_requests').select('*, profiles:user_id(username)').order('created_at', { ascending: false });
    if (error) throw error;
    if (requests.length === 0) {
      container.innerHTML = '<p class="empty-state-text">Bekleyen istek yok 🎉</p>';
      return;
    }
    container.innerHTML = requests.map(r => `
      <div class="request-card" data-request-id="${r.id}">
        <div class="request-info">
          <h3>${escapeHtml(r.title)} - ${escapeHtml(r.artist)}</h3>
          <p>Talep Eden: ${escapeHtml(r.profiles?.username || 'Bilinmeyen')}</p>
          <p>Tarih: ${new Date(r.created_at).toLocaleDateString('tr-TR')}</p>
        </div>
        <div class="request-actions">
          <button class="btn btn-small btn-primary" data-action="approve" data-request-id="${r.id}">Onayla</button>
          <button class="btn btn-small btn-danger" data-action="reject" data-request-id="${r.id}">Reddet</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const requestId = btn.dataset.requestId;
        btn.disabled = true;
        try {
          if (action === 'approve') await approveUploadRequest(requestId);
          else await rejectUploadRequest(requestId);
          await loadAdminRequests();
        } catch (err) {
          showToast('İşlem başarısız', 'error');
        }
      });
    });
  } catch (err) {
    console.error('loadAdminRequests error:', err);
    container.innerHTML = '<p class="empty-state-text">İstekler yüklenemedi</p>';
  }
}

async function changeUserRole(userId, newRole) {
  try {
    const sb = getSupabase();
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) throw error;
    showToast('Rol güncellendi', 'success');
    if (userId === window.currentUserId) {
      window.currentUserRole = newRole;
      if (newRole !== 'admin' && newRole !== 'yetkili') {
        navigateTo('home');
        showToast('Admin yetkiniz alındı', 'error');
      }
    }
  } catch (err) {
    showToast('Rol güncellenemedi', 'error');
    loadAdminUsers();
  }
}

function openAddSongModal() {
  document.getElementById('add-song-modal').classList.add('active');
}

async function addSong() {
  const title = document.getElementById('song-title-input').value.trim();
  const artist = document.getElementById('song-artist-input').value.trim();
  const fileInput = document.getElementById('song-file-input');
  const coverInput = document.getElementById('song-cover-input');

  if (!title || !artist) {
    showToast('Başlık ve sanatçı gerekli', 'error');
    return;
  }

  try {
    const sb = getSupabase();
    let audioUrl = '';
    let coverUrl = '';

    if (fileInput.files[0]) {
      const file = fileInput.files[0];
      const ext = file.name.split('.').pop();
      const path = `songs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await sb.storage.from('media').upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = sb.storage.from('media').getPublicUrl(path);
      audioUrl = urlData.publicUrl;
    }

    if (coverInput.files[0]) {
      const file = coverInput.files[0];
      const ext = file.name.split('.').pop();
      const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await sb.storage.from('media').upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = sb.storage.from('media').getPublicUrl(path);
      coverUrl = urlData.publicUrl;
    }

    const { error: insertErr } = await sb.from('songs').insert({
      title,
      artist,
      audio_url: audioUrl,
      cover_url: coverUrl,
      added_by: window.currentUserId
    });
    if (insertErr) throw insertErr;

    showToast('Şarkı eklendi! 🎵', 'success');
    document.getElementById('add-song-modal').classList.remove('active');
    await loadAllSongs();
    loadAdminSongs();
  } catch (err) {
    console.error('addSong error:', err);
    showToast('Eklenemedi: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
}

async function deleteSong() {
  const songId = document.getElementById('delete-song-id-value').value;
  try {
    const sb = getSupabase();
    const { error } = await sb.from('songs').delete().eq('id', songId);
    if (error) throw error;
    showToast('Şarkı silindi', 'success');
    document.getElementById('delete-song-modal').classList.remove('active');
    await loadAllSongs();
    loadAdminSongs();
  } catch (err) {
    showToast('Silinemedi', 'error');
  }
}

async function deleteArtist() {
  const artistId = document.getElementById('delete-artist-id-value').value;
  try {
    const sb = getSupabase();
    const { error } = await sb.from('artists').delete().eq('id', artistId);
    if (error) throw error;
    showToast('Sanatçı silindi', 'success');
    document.getElementById('delete-artist-modal').classList.remove('active');
    loadAdminArtists();
  } catch (err) {
    showToast('Silinemedi', 'error');
  }
}

async function deleteUser() {
  const userId = document.getElementById('delete-user-id-value').value;
  try {
    const sb = getSupabase();
    const { error } = await sb.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    showToast('Kullanıcı silindi', 'success');
    document.getElementById('delete-user-modal').classList.remove('active');
    loadAdminUsers();
  } catch (err) {
    showToast('Silinemedi', 'error');
  }
}

async function deleteAlbum() {
  const albumId = document.getElementById('delete-album-id-value').value;
  try {
    const sb = getSupabase();
    const { error } = await sb.from('albums').delete().eq('id', albumId);
    if (error) throw error;
    showToast('Albüm silindi', 'success');
    document.getElementById('delete-album-modal').classList.remove('active');
  } catch (err) {
    showToast('Silinemedi', 'error');
  }
}

// admin.js - Admin paneli: kullanıcı/şarkı/sanatçı yönetimi, yükleme istekleri
