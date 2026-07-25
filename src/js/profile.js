// ===== Profile Module - Yeni Tasarım =====

var currentProfileTabsLoaded = {};
var selectedInlineFrame = 'none';

// Toggle the inline edit panel open/closed and load data from Supabase
async function toggleInlineEditPanel(forceState) {
  const panel = document.getElementById('profile-inline-edit-panel');
  if (!panel) return;

  const isOpen = panel.style.display !== 'none';
  const shouldOpen = forceState !== undefined ? forceState : !isOpen;

  if (shouldOpen) {
    // Load current profile data into form
    await loadInlineProfileData();
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

async function loadInlineProfileData() {
  const userId = window.currentUserId;
  if (!userId) return;

  try {
    const sb = getSupabase();
    const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!profile) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('inline-edit-username', profile.username);
    setVal('inline-edit-city', profile.city);
    setVal('inline-edit-bio', profile.bio);
    setVal('inline-edit-website', profile.website);

    // Update bio counter
    const bioCount = document.getElementById('inline-edit-bio-count');
    if (bioCount) bioCount.textContent = (profile.bio || '').length;

    // Frame
    selectedInlineFrame = profile.avatar_frame || 'none';
    updateInlineFrameUI(selectedInlineFrame);

    // Social links
    const sl = profile.social_links || {};
    ['spotify', 'instagram', 'twitter', 'youtube', 'github', 'discord'].forEach(p => {
      setVal(`inline-social-${p}`, sl[p]);
    });
  } catch (err) {
    console.error('loadInlineProfileData error:', err);
  }
}

function updateInlineFrameUI(frame) {
  document.querySelectorAll('.pie-frame-card').forEach(card => {
    card.classList.toggle('active', card.dataset.frame === frame);
  });
}

window.initProfilePage = function() {
  initProfileTabs();
  initProfileForm();
};

function initProfileTabs() {
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
  });
  
  // Song filter change handler
  document.getElementById('profile-song-filter')?.addEventListener('change', (e) => {
    loadProfileSongs(e.target.value);
  });
  
  // Playlist filter change handler
  document.getElementById('profile-playlist-filter')?.addEventListener('change', (e) => {
    loadProfilePlaylists(e.target.value);
  });
}

function switchProfileTab(tabName) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.profile-tab[data-tab="${tabName}"]`);
  const panel = document.getElementById(`tab-${tabName}`);

  if (tab) tab.classList.add('active');
  if (panel) {
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
  }

  // Lazy load tab content
  if (panel && !panel.dataset.loaded) {
    panel.dataset.loaded = 'true';
    loadProfileTabContent(tabName);
  }
  
  // Re-init media editor when profile tab is shown (for edit buttons)
  if (tabName === 'overview' && typeof initMediaEditor === 'function') {
    setTimeout(initMediaEditor, 100);
  }
}

async function loadProfileTabContent(tabName) {
  switch (tabName) {
    case 'songs': loadProfileSongs(); break;
    case 'playlists': loadProfilePlaylists(); break;
    case 'badges': loadProfileBadges(); break;
  }
}

async function loadProfilePage() {
  const userId = window.currentUserId || (await getCurrentUser())?.id;
  if (!userId) return;

  try {
    const sb = getSupabase();
    const [profileRes, playlistsRes, likedRes] = await Promise.all([
      fetchProfile(userId),
      sb.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('liked_songs').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    ]);
    loadHeaderBadges(userId);

    const profile = profileRes.data || window.currentUserProfile || {};

    // Username & Title
    const username = profile.username || 'bekir';
    const titleEl = document.getElementById('own-profile-title');
    if (titleEl) titleEl.textContent = username;

    // Role Display
    const roleText = { admin: '👑 Admin', yetkili: '🛡️ Yetkili', artist: '🎤 Sanatçı', premium: '⭐ Premium' }[profile.role] || '👤 Kullanıcı';
    const roleEl = document.getElementById('profile-role-display');
    if (roleEl) roleEl.textContent = roleText;

    // Location & Date
    const locEl = document.querySelector('#profile-location span');
    if (locEl) locEl.textContent = profile.city || 'Belirtilmedi';

    const dateEl = document.getElementById('profile-date');
    if (dateEl) dateEl.textContent = profile.created_at ? new Date(profile.created_at).toLocaleDateString('tr-TR') : '2026';

    // Avatar & Frame
    const avatarEl = document.getElementById('profile-avatar-large');
    const avatarWrapper = document.getElementById('own-avatar-wrapper');

    const avatarUrl = profile.avatar_url || window.currentUserProfile?.avatar_url;
    if (avatarEl) {
      if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        avatarEl.innerHTML = `<span class="avatar-initials" style="font-size:40px;font-weight:700;color:rgba(255,255,255,0.75);display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:rgba(255,255,255,0.08)">${getInitials(username)}</span>`;
      }
    }

    if (avatarWrapper) {
      const frame = profile.avatar_frame || 'none';
      avatarWrapper.className = 'profile-avatar-wrapper' + (frame !== 'none' ? ` frame-${frame}` : '');
    }

    // Banner
    const bannerImg = document.getElementById('own-profile-banner-img');
    const bannerUrl = profile.banner_url || window.currentUserProfile?.banner_url;
    if (bannerImg) {
      if (bannerUrl) {
        bannerImg.src = bannerUrl;
        bannerImg.style.display = 'block';
      } else {
        bannerImg.style.display = 'none';
      }
    }

    // Bio
    const bioEl = document.getElementById('profile-bio-display');
    if (bioEl) bioEl.textContent = profile.bio || 'Henüz bir biyografi eklenmedi.';

    // Social Links
    renderSocialLinks(profile.social_links || {}, 'profile-social-links');

    // Update Stat Cards
    const playlistsStat = document.getElementById('profile-stat-playlists');
    if (playlistsStat) playlistsStat.textContent = playlistsRes.count || 0;

    const likedStat = document.getElementById('profile-stat-liked');
    if (likedStat) likedStat.textContent = likedRes.count || 0;

    const followersStat = document.getElementById('profile-stat-followers');
    if (followersStat) followersStat.textContent = followersRes.count || 0;

    const followingStat = document.getElementById('profile-stat-following');
    if (followingStat) followingStat.textContent = followingRes.count || 0;

    loadUserInfo();

    if (typeof initMediaEditor === 'function') {
      initMediaEditor();
    }
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

function showProfileSkeleton() {
  const skeleton = `
    <div class="profile-skeleton" style="animation:pulse 1.5s ease-in-out infinite">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
        <div style="width:120px;height:120px;border-radius:16px;background:var(--bg-elevated);flex-shrink:0"></div>
        <div style="flex:1">
          <div style="width:160px;height:18px;background:var(--bg-elevated);border-radius:6px;margin-bottom:8px"></div>
          <div style="width:120px;height:14px;background:var(--bg-elevated);border-radius:6px;margin-bottom:8px"></div>
          <div style="width:80px;height:22px;background:var(--bg-elevated);border-radius:12px"></div>
        </div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:16px">
        <div style="width:60px;height:14px;background:var(--bg-elevated);border-radius:6px"></div>
        <div style="width:60px;height:14px;background:var(--bg-elevated);border-radius:6px"></div>
        <div style="width:60px;height:14px;background:var(--bg-elevated);border-radius:6px"></div>
      </div>
    </div>
  `;
  const dateEl = document.getElementById('profile-date');
  if (dateEl && !dateEl.textContent) {
    const container = dateEl.closest('.section') || dateEl.parentElement;
    if (container) container.insertAdjacentHTML('afterbegin', skeleton);
  }
}

function renderProfileStats(stats) {
  const container = document.getElementById('profile-stats-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-value">${stats.playlists}</div><div class="stat-label">Çalma Listesi</div></div>
    <div class="stat-card"><div class="stat-value">${stats.liked}</div><div class="stat-label">Beğenilen</div></div>
    <div class="stat-card"><div class="stat-value">${stats.followers}</div><div class="stat-label">Takipçi</div></div>
    <div class="stat-card"><div class="stat-value">${stats.following}</div><div class="stat-label">Takip Edilen</div></div>
  `;
}

function renderGenres(genres, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!genres?.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('');
}

function renderSocialLinks(links, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const platforms = {
    spotify: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.52 19.17c-.47.28-1.04.44-1.66.44-.72 0-1.3-.23-1.78-.66l-2.98-2.59c-1.25 1.03-2.76 1.65-4.45 1.65-3.87 0-7-3.13-7-7s3.13-7 7-7c2.05 0 3.88.88 5.14 2.22l2.81-2.81C17.5 2.93 15.14 2 12.5 2 6.47 2 2 6.48 2 12.5S6.47 23 12.5 23c2.69 0 5.09-.97 6.88-2.59l-2.84-2.84z"/></svg>', color: '#1DB954' },
    instagram: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>', color: '#E1306C' },
    twitter: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>', color: '#1DA1F2' },
    youtube: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', color: '#FF0000' },
    github: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>', color: '#333' },
    discord: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-2.567.867-5.075 1.999-7.472 3.229a.077.077 0 0 0-.018.043l-.03.076.026.068c.783 1.984 1.923 4.217 3.35 6.137a.077.077 0 0 1 0 .112c-1.856 2.643-4.817 3.983-6.747 3.279a.077.077 0 0 1-.086-.045l-.021-.042a.073.073 0 0 0-.112-.006L2.907 20.54a.076.076 0 0 0 .021.114c1.55.579 3.206.54 4.747.112a.076.076 0 0 0 .021-.044l.02-.063c.084-.247.372-.631.683-.813 2.26-1.306 4.293-3.329 5.828-5.935a.077.077 0 0 0-.003-.115c-1.454-2.455-3.213-5.215-3.492-6.107a.077.077 0 0 1 .032-.128c2.605-1.388 5.509-2.412 7.704-3.172a.077.077 0 0 1 .117-.007l.04.022.043-.022a19.744 19.744 0 0 1 4.888-1.397.061.061 0 0 1 .084.042 17.324 17.324 0 0 1 3.32 1.253.061.061 0 0 1 .018.105zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418z"/></svg>', color: '#5865F2' },
    soundcloud: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9zm5.843 16.32c-.37.47-.82.89-1.35 1.22-2.12 1.23-4.71 1.12-6.97-.52-.46-.34-.85-.74-1.16-1.22-2.25-3.52-2.58-8.01-.81-11.45.66-1.27 1.52-2.33 2.47-3.3 2.22-2.97 7.11-2.62 10.04.82 2.53 3.01 2.76 8.35.77 11.77zm1.91-10.7c-.17-.44-.4-.83-.66-1.18-1.95-2.64-5.53-2.7-8.06-.26-.38.35-.7.76-.95 1.21-2.54 4.87-2.29 8.62.52 10.54.32.6.63 1.22.85 1.91.06-.16.12-.33.17-.5 1.67-5.05 4.64-9.81 10.7-9.9 1.66-.03 3.2.97 3.86 2.58.26.62.39 1.27.39 1.94 0 .47-.09.91-.25 1.32-1.66.88-4.2 1.16-6.3.57-.36-.1-.72-.25-1.09-.44zm-3.33 9.31c.06-.49.17-.95.32-1.38.64-1.82 2.1-4.24 4.12-5.45.23-.14.48-.26.74-.36.64-.23 1.27-.4 1.93-.52.48-.09.94-.16 1.39-.19.41-.03.83-.04 1.23-.04.43 0 .86.02 1.28.06 1.98.17 4.07 1.86 4.54 4.76.05.32.08.65.08.99 0 .68-.08 1.35-.22 1.99-.5 2.2-2.15 4.02-4.18 5.22-.2.11-.4.2-.6.29-.21.09-.42.18-.64.28-.71.34-1.44.58-2.18.7-.57.09-1.16.15-1.74.18-.44.03-.88.05-1.31.05-.46 0-.92-.02-1.39-.06-1.84-.17-3.73-1.58-4.22-4.5zm3.41-4.48c-.02.42-.04.84-.04 1.26 0 .69.04 1.38.1 2.05.47 4.68 2.67 9.04 6.5 9.91.17.04.34.06.51.07.24.02.49.02.73.02.42 0 .85-.02 1.27-.06 1.53-.14 2.82-.8 3.62-1.85.42-.57.66-1.23.7-1.95.02-.47.03-.94.03-1.41 0-.7-.02-1.41-.07-2.11-.42-4.91-2.79-9.3-6.74-10.23-.18-.05-.36-.07-.53-.08-.2-.02-.4-.02-.6-.02-.37 0-.74.01-1.1.03-.94.06-1.7.37-2.3.92-.35.33-.56.7-.65 1.09z"/></svg>', color: '#FF5500' }
  };

  container.innerHTML = Object.entries(links).map(([platform, url]) => {
    const p = platforms[platform];
    if (!p) return '';
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="social-link" style="color:${p.color}" title="${platform}">${p.icon}</a>`;
  }).join('');
}

function renderBadgeDashboard(badges) {
  const container = document.getElementById('profile-badges-grid');
  if (!container) return;

  const earned = badges.filter(b => b.earned_at).length;
  const total = badges.length;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <span class="stat-value" style="font-size:24px">${earned}</span>
      <span style="color:var(--ts)">/ ${total} Rozet</span>
      <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
        <div style="width:${Math.round(earned/total*100)}%;height:100%;background:linear-gradient(90deg,var(--green),var(--green-h));border-radius:3px;transition:width .5s"></div>
      </div>
    </div>
    <div class="badges-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px">
      ${badges.slice(0, 6).map(b => `
        <div class="badge-card ${b.earned_at ? 'earned' : 'locked'}" style="padding:16px 12px">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name" style="font-size:11px">${escapeHtml(b.name)}</div>
          <div class="badge-progress"><div class="badge-progress-fill" style="width:${b.progress}%"></div></div>
        </div>
      `).join('')}
    </div>
    <button class="btn-secondary" style="margin-top:16px;width:100%" onclick="switchProfileTab('badges')">Tüm Rozetleri Göster</button>
  `;
}

function renderListeningChart(metrics) {
  const ctx = document.getElementById('listening-chart');
  if (!ctx) return;

  const labels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const data = metrics.weekly_plays || Array(7).fill(0).map(() => Math.floor(Math.random() * 50));

  if (window.listeningChart) window.listeningChart.destroy();

  window.listeningChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Dinlenme', data, borderColor: 'var(--green)', backgroundColor: 'rgba(29,185,84,.1)', fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'var(--tm)', font: { size: 11 } } },
        y: { display: false, grid: { display: false } }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

async function loadProfileSongs(filter = 'liked') {
  const container = document.getElementById('profile-songs-list');
  if (!container) return;

  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Yükleniyor...</p></div>';

  try {
    const sb = getSupabase();
    let songs = [];

    if (filter === 'liked') {
      const { data: liked } = await sb.from('liked_songs').select('song_id').eq('user_id', window.currentUserId);
      const ids = liked?.map(l => l.song_id).filter(Boolean) || [];
      if (ids.length) {
        const { data } = await sb.from('songs').select('*').in('id', ids);
        songs = data || [];
      }
    } else if (filter === 'recent') {
      const { data: history } = await sb.from('listening_history').select('song_id').eq('user_id', window.currentUserId).order('played_at', { ascending: false }).limit(50);
      const ids = [...new Set(history?.map(h => h.song_id))].filter(Boolean);
      if (ids.length) {
        const { data } = await sb.from('songs').select('*').in('id', ids);
        songs = data || [];
      }
    } else if (filter === 'top') {
      const { data } = await sb.from('songs').select('*').order('play_count', { ascending: false }).limit(50);
      songs = data || [];
    }

    renderSongsList(songs, container, true);
  } catch (err) {
    console.error('loadProfileSongs error:', err);
    container.innerHTML = '<div class="empty-state"><p>Şarkılar yüklenemedi</p></div>';
  }
}

async function loadProfilePlaylists(filter = 'own') {
  const container = document.getElementById('profile-playlists-grid');
  if (!container) return;

  try {
    const sb = getSupabase();
    let query = sb.from('playlists').select('*');

    if (filter === 'own') {
      query = query.eq('user_id', window.currentUserId);
    } else if (filter === 'followed') {
      const { data: followed } = await sb.from('playlist_follows').select('playlist_id').eq('user_id', window.currentUserId);
      const ids = followed?.map(f => f.playlist_id) || [];
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (filter === 'artist-follow') {
      const { data: links } = await sb.from('artist_follow_playlists').select('playlist_id').eq('user_id', window.currentUserId);
      const ids = links?.map(l => l.playlist_id) || [];
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data: playlists } = await query;
    renderPlaylistsGrid(playlists || [], container);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state"><p>Listeler yüklenemedi</p></div>';
  }
}

async function loadProfileBadges() {
  const container = document.getElementById('badges-categories');
  if (!container) return;

  try {
    const definitions = await loadBadgeDefinitions();
    const metrics = await getUserMetrics(window.currentUserId);

    const categories = {};
    definitions.forEach(d => {
      const cat = d.category || 'special';
      if (!categories[cat]) categories[cat] = [];
      const calc = calculateProgress(d, metrics);
      categories[cat].push({ ...d, ...calc });
    });

    const categoryTitles = {
      special: '⭐ Özel & Rol Rozetleri',
      listening: '🎧 Dinleme & Koleksiyon',
      artist: '🎤 Sanatçı Rozetleri',
      premium: '💎 Premium Rozetler',
      social: '🔥 Topluluk Rozetleri'
    };

    let html = '';
    Object.keys(categories).forEach(cat => {
      const items = categories[cat] || [];
      if (!items.length) return;

      const earnedCount = items.filter(i => i.earned).length;

      html += `
        <div class="badge-category" style="margin-bottom:24px">
          <div class="badge-category-header" style="margin-bottom:12px">
            <h4 style="font-size:16px;font-weight:700;color:#fff">${categoryTitles[cat] || cat} <span class="badge-category-stats" style="font-size:12px;color:var(--green);margin-left:8px">(${earnedCount}/${items.length})</span></h4>
          </div>
          <div class="badges-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px">
            ${items.map(b => `
              <div class="badge-card ${b.earned ? 'earned' : 'locked'}" title="${escapeHtml(b.description)}" style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid ${b.earned ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.08)'};border-radius:14px;position:relative;transition:all 0.2s ease">
                <span class="badge-rarity rarity-${b.rarity}" style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);position:absolute;top:10px;right:10px">${b.rarity}</span>
                <div class="badge-icon" style="font-size:28px;margin-bottom:8px">${b.icon}</div>
                <div class="badge-name" style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">${escapeHtml(b.name)}</div>
                <div class="badge-desc" style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:10px">${escapeHtml(b.description || '')}</div>
                <div class="badge-progress" style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
                  <div class="badge-progress-fill" style="height:100%;background:var(--green);width:${b.progress}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error('loadProfileBadges error:', err);
    container.innerHTML = '<div class="empty-state"><p>Rozetler yüklenemedi</p></div>';
  }
}

async function loadFollowersTab() {
  const followers = await loadFollowers();
  renderFollowList(followers, 'followers-list', window.currentUserId, false);
}

async function loadFollowingTab() {
  const following = await loadFollowing();
  renderFollowList(following, 'following-list', window.currentUserId, true);
}


function initProfileForm() {
  // Photo & Banner triggers right on profile page
  document.getElementById('btn-change-avatar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.mediaEditor) window.mediaEditor.open('avatar');
  });

  document.getElementById('btn-change-banner')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.mediaEditor) window.mediaEditor.open('banner');
  });

  // Toggle edit section or open edit modal
  document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
    if (typeof window.openProfileSettings === 'function') {
      window.openProfileSettings();
    } else {
      toggleInlineEditPanel();
    }
  });

  document.getElementById('btn-close-inline-edit')?.addEventListener('click', () => {
    toggleInlineEditPanel(false);
  });

  document.getElementById('btn-cancel-inline-edit')?.addEventListener('click', () => {
    toggleInlineEditPanel(false);
  });

  document.getElementById('inline-edit-bio')?.addEventListener('input', (e) => {
    const bioCount = document.getElementById('inline-edit-bio-count');
    if (bioCount) bioCount.textContent = e.target.value.length;
  });

  // Inline frame selector
  document.querySelectorAll('.pie-frame-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedInlineFrame = card.dataset.frame || 'none';
      updateInlineFrameUI(selectedInlineFrame);
    });
  });

  // Inline Form Submit
  document.getElementById('profile-inline-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveInlineProfile();
  });

  // Share profile
  document.getElementById('btn-share-profile')?.addEventListener('click', () => {
    const userId = window.currentUserId;
    if (navigator.clipboard && userId) {
      navigator.clipboard.writeText(window.location.origin + '#profile/' + userId);
      if (typeof showToast === 'function') showToast('Profil bağlantısı kopyalandı!', 'success');
    }
  });
}

async function saveInlineProfile() {
  const userId = window.currentUserId;
  if (!userId) return;

  const username = document.getElementById('inline-edit-username')?.value.trim();
  const city = document.getElementById('inline-edit-city')?.value.trim();
  const bio = document.getElementById('inline-edit-bio')?.value.trim();
  const website = document.getElementById('inline-edit-website')?.value.trim();

  if (!username) {
    if (typeof showToast === 'function') showToast('Kullanıcı adı boş olamaz', 'error');
    return;
  }

  const social_links = {};
  ['spotify', 'instagram', 'twitter', 'youtube', 'github', 'discord'].forEach(platform => {
    const val = document.getElementById(`inline-social-${platform}`)?.value.trim();
    if (val) social_links[platform] = val;
  });

  const btn = document.getElementById('btn-save-inline-edit');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';
  }

  try {
    const updateData = {
      username,
      city,
      bio,
      website,
      avatar_frame: selectedInlineFrame,
      social_links
    };

    const sb = getSupabase();
    const { error } = await sb.from('profiles').update(updateData).eq('id', userId);
    if (error) throw error;

    // Update DOM on profile page immediately
    const titleEl = document.getElementById('own-profile-title');
    if (titleEl) titleEl.textContent = username;

    const locEl = document.querySelector('#profile-location span');
    if (locEl) locEl.textContent = city || 'Belirtilmedi';

    const bioEl = document.getElementById('profile-bio-display');
    if (bioEl) bioEl.textContent = bio || 'Henüz bir biyografi eklenmedi.';

    const avatarWrapper = document.getElementById('own-avatar-wrapper');
    if (avatarWrapper) {
      avatarWrapper.className = 'profile-avatar-wrapper' + (selectedInlineFrame !== 'none' ? ` frame-${selectedInlineFrame}` : '');
    }

    renderSocialLinks(social_links, 'profile-social-links');

    if (typeof loadUserInfo === 'function') loadUserInfo();

    toggleInlineEditPanel(false);
    if (typeof showToast === 'function') showToast('Profil kaydedildi! ✨', 'success');
  } catch (err) {
    console.error('saveInlineProfile error:', err);
    if (typeof showToast === 'function') showToast('Kaydedilemedi', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Değişiklikleri Kaydet';
    }
  }
}

// Public User Profile
async function loadPublicUserProfile(userId) {
  if (userId === window.currentUserId) {
    navigateTo('profile');
    return;
  }

  try {
    const { data: profile, error } = await fetchUserPublicProfile(userId);
    if (error || !profile) {
      showToast(error?.message || 'Profil bulunamadı', 'error');
      navigateTo('home');
      return;
    }

    currentPublicUserId = userId;

    const usernameEl = document.getElementById('public-profile-username');
    if (usernameEl) usernameEl.innerHTML = `${escapeHtml(profile.username || 'Kullanıcı')}${profile.role === 'artist' ? getVerifiedTick(profile.username, true) : ''}`;

    const followersEl = document.getElementById('public-profile-followers');
    if (followersEl) followersEl.textContent = `${profile.followers_count || 0} Takipçi`;

    const playlistsEl = document.getElementById('public-profile-playlists');
    if (playlistsEl) playlistsEl.textContent = `${profile.playlists_count || 0} Herkese Açık Liste`;

    const avatarEl = document.getElementById('public-profile-avatar');
    if (avatarEl) {
      if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        avatarEl.innerHTML = `<span class="avatar-initials" style="font-size:60px;font-weight:700;color:var(--ts);display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:var(--bg-elevated)">${getInitials(profile.username)}</span>`;
      }

      if (profile.avatar_frame && profile.avatar_frame !== 'none') {
        const frameClass = getAvatarFrameClass(profile.avatar_frame);
        avatarEl.className = 'profile-avatar-large ' + frameClass;
      }
    }

    const bannerImg = document.getElementById('public-profile-banner-img');
    if (bannerImg) {
      if (profile.banner_url) {
        bannerImg.src = profile.banner_url;
        bannerImg.style.display = 'block';
      } else {
        bannerImg.style.display = 'none';
      }
    }

    const locEl = document.getElementById('public-profile-location');
    if (locEl && locEl.querySelector('span')) locEl.querySelector('span').textContent = profile.city || 'Belirtilmedi';

    const dateEl = document.getElementById('public-profile-date');
    if (dateEl && dateEl.querySelector('span')) dateEl.querySelector('span').textContent = profile.created_at ? new Date(profile.created_at).toLocaleDateString('tr-TR') : '2026';

    const roleEl = document.getElementById('public-profile-role');
    if (roleEl) roleEl.textContent = { admin: '👑 Admin', yetkili: '🛡️ Yetkili', artist: '🎤 Sanatçı', premium: '⭐ Premium' }[profile.role] || '👤 Kullanıcı';

    const bioEl = document.getElementById('public-profile-bio-display');
    if (bioEl) bioEl.textContent = profile.bio || 'Bu kullanıcının henüz bir biyografisi yok.';

    if (typeof renderSocialLinks === 'function') renderSocialLinks(profile.social_links || {}, 'public-profile-social-links');
    if (typeof renderGenres === 'function') renderGenres(profile.favorite_genres || [], 'public-profile-genres');

    if (typeof loadPublicProfileActions === 'function') loadPublicProfileActions(userId);
    if (typeof renderPublicProfileStats === 'function') renderPublicProfileStats(profile);

    navigateTo('user-profile');
  } catch (err) {
    console.error('loadPublicUserProfile error:', err);
    showToast('Profil yüklenemedi', 'error');
  }
}

function renderPublicProfileStats(profile) {
  const container = document.getElementById('public-profile-stats-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-value">${profile.playlists_count || 0}</div><div class="stat-label">Çalma Listesi</div></div>
    <div class="stat-card"><div class="stat-value">${profile.liked_count || 0}</div><div class="stat-label">Beğenilen</div></div>
    <div class="stat-card"><div class="stat-value">${profile.followers_count || 0}</div><div class="stat-label">Takipçi</div></div>
    <div class="stat-card"><div class="stat-value">${profile.following_count || 0}</div><div class="stat-label">Takip Edilen</div></div>
  `;
}

async function loadPublicProfileActions(profileId) {
  const container = document.getElementById('public-profile-actions');
  const sb = getSupabase();
  const { data: follow } = await sb.from('follows').select('status').eq('follower_id', window.currentUserId).eq('following_id', profileId).single();

  const profile = await fetchProfile(profileId);
  const isArtist = profile?.role === 'artist';

  if (isArtist) {
    const isFollowing = follow?.status === 'accepted';
    container.innerHTML = `
      <button class="btn-primary follow-btn ${isFollowing ? 'following' : 'follow'}" data-follow-id="${profileId}" onclick="handleFollowClick('${profileId}', 'artist', '${escapeHtml(profile.username)}')">
        ${isFollowing ? 'Takipten Çık' : 'Takip Et'}
      </button>
      <button class="btn-secondary btn-message" onclick="openChat('${profileId}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Mesaj
      </button>
    `;
  } else {
    if (follow?.status === 'accepted') {
      container.innerHTML = `
        <button class="btn-secondary follow-btn following" data-follow-id="${profileId}" onclick="handleFollowClick('${profileId}', 'user', '${escapeHtml(profile.username)}')">Arkadaşsın</button>
        <button class="btn-secondary btn-message" onclick="openChat('${profileId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Mesaj
        </button>
        <button class="btn-secondary btn-block" onclick="blockUser('${profileId}')">Engelle</button>
      `;
    } else if (follow?.status === 'pending') {
      if (follow.follower_id === window.currentUserId) {
        container.innerHTML = `<button class="btn-secondary follow-btn pending" disabled>İstek Gönderildi</button>`;
      } else {
        container.innerHTML = `
          <button class="btn-primary" onclick="acceptFriendRequest('${follow.follower_id}')">Kabul Et</button>
          <button class="btn-secondary" onclick="rejectFriendRequest('${follow.follower_id}')">Reddet</button>
        `;
      }
    } else {
      container.innerHTML = `
        <button class="btn-primary follow-btn follow" data-follow-id="${profileId}" onclick="handleFollowClick('${profileId}', 'user', '${escapeHtml(profile.username)}')">Takip Et</button>
      `;
    }
  }
}

// Discord Popup Update
async function updateDiscordPopupData() {
  const profile = await fetchProfile(window.currentUserId);
  if (!profile) return;

  const badges = await loadUserBadges(window.currentUserId);
  const earnedBadges = badges.filter(b => b.earned_at).slice(0, 3);

  const unEl = document.getElementById('discord-popup-username');
  if (unEl) unEl.textContent = profile.username || 'Kullanıcı';
  const plEl = document.getElementById('popup-stat-playlists');
  if (plEl) plEl.textContent = profile.playlists_count || 0;
  const lkEl = document.getElementById('popup-stat-liked');
  if (lkEl) lkEl.textContent = profile.liked_count || 0;
  const flEl = document.getElementById('popup-stat-followers');
  if (flEl) flEl.textContent = profile.followers_count || 0;

  const avEl = document.getElementById('discord-popup-avatar');
  if (avEl && profile.avatar_url) {
    avEl.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  }

  const bnEl = document.getElementById('discord-popup-banner');
  if (bnEl && profile.banner_url) {
    bnEl.style.backgroundImage = `url(${profile.banner_url})`;
  }

  const badgesContainer = document.getElementById('discord-popup-badges');
  if (badgesContainer) {
    badgesContainer.innerHTML = earnedBadges.map(b => `
      <div class="mini-badge earned" title="${escapeHtml(b.name)}">${b.icon}</div>
    `).join('') || '<div class="mini-badge">🏆</div>';
  }
}

// Helper: Format date
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function getVerifiedTick(name, forceOnProfile = true) {
  if (!forceOnProfile) return '';
  return ' <span class="verified-tick" title="Onaylı Sanatçı">✓</span>';
}

function getAvatarFrameClass(frame) {
  const frames = { gold: 'frame-gold', rainbow: 'frame-rainbow', pulse: 'frame-pulse' };
  return frames[frame] || '';
}

async function loadHeaderBadges(userId) {
  const container = document.getElementById('profile-header-badges');
  if (!container) return;

  try {
    const definitions = await loadBadgeDefinitions();
    const metrics = await getUserMetrics(userId);

    const earnedBadges = definitions.filter(d => {
      const { earned } = calculateProgress(d, metrics);
      return earned;
    });

    if (!earnedBadges.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = earnedBadges.map(b => `
      <div class="header-badge-item" title="${escapeHtml(b.name)} - ${escapeHtml(b.description || '')}">
        <span class="badge-icon">${b.icon || '🏆'}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadHeaderBadges error:', err);
  }
}

// ===== Rendering Functions =====

function renderSongsList(songs, container, showArtist = true) {
  if (!songs?.length) {
    container.innerHTML = '<div class="empty-state"><p>Şarkı bulunamadı</p></div>';
    return;
  }
  container.innerHTML = songs.map((song, idx) => {
    const artistName = song.artist || song.artist_name || (song.artists && song.artists.username) || 'Bilinmeyen Sanatçı';
    return `
      <div class="song-list-item" data-song-id="${song.id}" onclick="if(typeof playSong==='function') playSong('${song.id}')">
        <div class="song-list-num">${idx + 1}</div>
        <div class="song-list-info">
          <div class="song-list-cover" style="background-image:url('${song.cover_url || ''}')">
            ${!song.cover_url ? '<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>' : ''}
          </div>
          <div class="song-list-details">
            <div class="song-list-title">${escapeHtml(song.title || 'İsimsiz')}</div>
            <div class="song-list-subtitle">${showArtist ? escapeHtml(artistName) : (song.album ? escapeHtml(song.album) : '')}</div>
          </div>
        </div>
        <div class="song-list-album">${song.album ? escapeHtml(song.album) : ''}</div>
        <div class="song-list-duration">${formatDuration(song.duration)}</div>
      </div>
    `;
  }).join('');
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderPlaylistsGrid(playlists, container) {
  if (!playlists?.length) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Çalma listesi yok</p></div>';
    return;
  }
  container.innerHTML = playlists.map(pl => {
    const coverHtml = pl.cover_url
      ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    return `
      <div class="minimal-playlist-card" data-playlist-id="${pl.id}" onclick="if(typeof openPlaylist==='function') openPlaylist('${pl.id}')">
        <div class="minimal-playlist-cover">${coverHtml}</div>
        <div class="minimal-playlist-info">
          <div class="minimal-playlist-title">${escapeHtml(pl.name)}</div>
          <div class="minimal-playlist-sub">${pl.is_public ? '🌐 Herkese Açık' : '🔒 Gizli'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderFollowList(users, containerId, currentUserId, showActions = true) {
  const container = document.getElementById(containerId);
  if (!users?.length) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px"><p>Henüz kimse yok</p></div>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="follow-item">
      ${u.avatar_url ? `<img class="follow-avatar" src="${u.avatar_url}" alt="${escapeHtml(u.username)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
      <div class="follow-avatar-fallback" style="${u.avatar_url ? 'display:none;' : 'display:flex;'}background:var(--bg-elevated);align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;font-weight:700;color:var(--ts);flex-shrink:0">${getInitials(u.username)}</div>
      <div class="follow-info">
        <div class="follow-name">${escapeHtml(u.username)}${u.role === 'artist' ? ' <span class="role-badge artist">Sanatçı</span>' : ''}</div>
        <div class="follow-meta"><span>${formatDate(u.followedAt)}</span></div>
      </div>
      ${showActions && u.id !== currentUserId ? `
        <button class="follow-btn ${u.status === 'accepted' ? 'following' : u.status === 'pending' ? 'pending' : 'follow'}"
                data-follow-btn="${u.id}"
                ${u.status === 'pending' ? 'disabled' : ''}
                onclick="handleFollowClick('${u.id}', '${u.role}', '${escapeHtml(u.username)}')">
          ${u.status === 'accepted' ? 'Takipten Çık' : u.status === 'pending' ? 'İstek Gönderildi' : 'Takip Et'}
        </button>
      ` : ''}
    </div>
  `).join('');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}

// Export functions to window for cross-module access
window.profileModule = {
  loadProfilePage,
  loadPublicUserProfile,
  updateDiscordPopupData,
  saveInlineProfile
};
window.loadProfilePage = loadProfilePage;
window.loadPublicUserProfile = loadPublicUserProfile;
window.updateDiscordPopupData = updateDiscordPopupData;
window.saveInlineProfile = saveInlineProfile;