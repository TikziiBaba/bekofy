// ===== Home Page - Ana Sayfa Bileşenleri =====

function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 6) greeting = 'İyi Geceler';
  else if (hour < 12) greeting = 'Günaydın';
  else if (hour < 18) greeting = 'İyi Günler';
  else greeting = 'İyi Akşamlar';
  const h1 = document.querySelector('#home-greeting');
  const sub = document.querySelector('#greeting-subtitle');
  if (h1) h1.textContent = greeting;
  if (sub) sub.textContent = 'Müziğin ritmini hisset';
}

async function renderHeroBanner() {
  const heroSection = document.getElementById('hero-banner-section');
  const heroTitle = document.getElementById('hero-banner-title');
  const heroArtist = document.getElementById('hero-banner-artist');
  const heroBg = document.getElementById('hero-banner-bg');
  const playBtn = document.getElementById('hero-banner-play');

  if (!heroSection || !allSongs.length) return;

  const heroSong = allSongs[Math.floor(Math.random() * allSongs.length)];

  heroTitle.textContent = heroSong.title;
  heroArtist.textContent = heroSong.artist;
  if (heroSong.cover_url) {
    heroBg.style.backgroundImage = `url('${heroSong.cover_url}')`;
  }

  playBtn.onclick = () => {
    player.playSong(heroSong, allSongs);
  };

  heroSection.style.display = 'block';
}

async function renderDailyMixes() {
  const section = document.getElementById('daily-mix-section');
  const grid = document.getElementById('daily-mix-grid');
  if (!section || !grid || !allSongs.length) return;

  let mixes = JSON.parse(localStorage.getItem('bekofy_daily_mixes') || 'null');
  const today = new Date().toDateString();

  if (!mixes || mixes.date !== today) {
    mixes = { date: today, data: [] };
    const artists = [...new Set(allSongs.map(s => s.artist))].sort(() => 0.5 - Math.random());
    for (let i = 0; i < 4 && i < artists.length; i++) {
      const artistSongs = allSongs.filter(s => s.artist === artists[i]);
      if (artistSongs.length > 0) {
        mixes.data.push({
          title: `${artists[i]} Mix`,
          desc: `${artists[i]} ve benzerleri`,
          songs: artistSongs,
          cover: artistSongs[0].cover_url
        });
      }
    }
    localStorage.setItem('bekofy_daily_mixes', JSON.stringify(mixes));
  }

  if (mixes.data.length > 0) {
    grid.innerHTML = mixes.data.map((mix, idx) => `
      <div class="daily-mix-card" onclick="playDailyMix(${idx})">
        <img src="${escapeHtml(mix.cover || '')}" class="daily-mix-cover">
        <div class="daily-mix-info">
          <h4>${escapeHtml(mix.title)}</h4>
          <p>${escapeHtml(mix.desc)}</p>
        </div>
        <button class="daily-mix-play">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    `).join('');
    section.style.display = 'block';

    window.playDailyMix = (idx) => {
      const mix = mixes.data[idx];
      if (mix && mix.songs.length) {
        player.playSong(mix.songs[0], mix.songs);
      }
    };
  }
}

// ===== Render Song Cards =====
function renderRecentSongs(songs) {
  const container = document.getElementById('recent-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
      <small style="color:var(--tm);font-size:13px">Supabase'den şarkı ekleyin</small>
    </div>`;
    return;
  }
  container.innerHTML = songs.map(song => createSongCard(song)).join('');
}

// ===== Load New (Keşfet) Content =====
async function loadNewContent() {
  if (!currentUserId) return;
  
  try {
    // 1. Fetch newest releases
    const newReleasesRes = await fetchNewReleases();
    const newReleasesContainer = document.getElementById('new-latest-releases');
    if (newReleasesRes.data && newReleasesRes.data.length > 0) {
      newReleasesContainer.innerHTML = newReleasesRes.data.map(song => createSongCard(song)).join('');
    } else {
      newReleasesContainer.innerHTML = '<p style="color:var(--tm);padding:12px;">Yeni çıkan şarkı bulunamadı.</p>';
    }

    // 2. Fetch liked songs to generate recommendations
    const likedRes = await fetchLikedSongs(currentUserId);
    const likedSongIds = new Set((likedRes.data || []).map(l => l.song_id));

    // 3. Recommended Songs
    const recommendedSongs = await getRecommendedSongs(currentUserId, allSongs, likedSongIds);
    const recommendedContainer = document.getElementById('new-recommended-songs');
    if (recommendedSongs && recommendedSongs.length > 0) {
      recommendedContainer.innerHTML = recommendedSongs.map(song => createSongCard(song)).join('');
    } else {
      recommendedContainer.innerHTML = '<p style="color:var(--tm);padding:12px;">Henüz yeterli dinleme geçmişin yok.</p>';
    }

    // 4. Personalized Mix
    const mixSongs = await getPersonalizedMix(currentUserId, allSongs, likedSongIds);
    const mixContainer = document.getElementById('new-personal-mix');
    const mixSection = document.getElementById('section-personal-mix');
    if (mixSongs && mixSongs.length > 0) {
      mixContainer.innerHTML = mixSongs.map(song => createSongCard(song)).join('');
      mixSection.style.display = 'block';
    }
  } catch (err) {
    console.error('Error loading new content:', err);
  }
}

// ===== Discover Weekly Logic =====
var discoverWeeklyCache = null;
async function playDiscoverWeekly() {
  if (allSongs.length === 0) return;

  if (!discoverWeeklyCache) {
    if (currentUserId) {
      discoverWeeklyCache = await getRecommendedSongs(currentUserId, allSongs, userLikedSongIds);
      // Make it longer for discover weekly (up to 30)
      if (discoverWeeklyCache.length < 30) {
        const remaining = allSongs.filter(s =>
          !userLikedSongIds.has(s.id) &&
          !discoverWeeklyCache.find(r => r.id === s.id)
        ).sort(() => Math.random() - 0.5);
        discoverWeeklyCache.push(...remaining.slice(0, 30 - discoverWeeklyCache.length));
      }
    } else {
      discoverWeeklyCache = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 30);
    }
  }

  if (discoverWeeklyCache && discoverWeeklyCache.length > 0) {
    player.playSong(discoverWeeklyCache[0], discoverWeeklyCache);
    showToast('Haftalık Keşif listesi başlatıldı 🎵', 'success');
  }
}

// Add event listener to banner
document.addEventListener('DOMContentLoaded', () => {
  const btnDiscover = document.getElementById('btn-play-discover');
  if (btnDiscover) {
    btnDiscover.addEventListener('click', (e) => {
      e.stopPropagation();
      playDiscoverWeekly();
    });
  }

  const bannerDiscover = document.getElementById('discover-weekly-btn');
  if (bannerDiscover) {
    bannerDiscover.addEventListener('click', () => {
      playDiscoverWeekly();
    });
  }
});

async function renderRecommendedSongs() {
  const container = document.getElementById('recommended-songs');
  if (!container) return;

  if (!currentUserId || allSongs.length === 0) {
    // Kullanıcı giriş yapmamışsa veya şarkı yoksa son eklenenlerden rastgele göster
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    if (shuffled.length > 0) {
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    } else {
      container.innerHTML = `<div class="empty-state"><p>Henüz öneri yok</p></div>`;
    }
    return;
  }

  try {
    const recommended = await getRecommendedSongs(currentUserId, allSongs, userLikedSongIds);
    if (recommended.length > 0) {
      container.innerHTML = recommended.map(song => createSongCard(song)).join('');
    } else {
      // Fallback: rastgele şarkılar
      const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    }
  } catch (err) {
    console.error('Recommendations error:', err);
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
  }
}

function renderAllSongs(songs) {
  const container = document.getElementById('all-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div class="song-list-header">
      <span>#</span>
      <span>Başlık</span>
      <span>Albüm</span>
      <span>Süre</span>
    </div>
    ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
  `;
}

function renderSongListItem(song, num) {
  const coverHtml = song.cover_url
    ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

  return `
    <div class="song-list-item" data-song-id="${song.id}">
      <div class="song-list-num">${num}</div>
      <div class="song-list-info">
        <div class="song-list-cover">${coverHtml}</div>
        <div class="song-list-details">
          <div class="song-list-title">${escapeHtml(song.title)}</div>
          <div class="song-list-subtitle">${formatArtistLinks(song.artist)}</div>
        </div>
      </div>
      <div class="song-list-album">${escapeHtml(song.album || '—')}</div>
      <div class="song-list-duration">${formatDuration(song.duration)}</div>
    </div>
  `;
}

// ===== Quick Picks (compact horizontal cards) =====
function renderQuickPicks(songs) {
  const container = document.getElementById('quick-picks');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '';
    return;
  }
  const picks = [...songs].sort(() => Math.random() - 0.5).slice(0, 6);
  container.innerHTML = picks.map(song => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    return `
      <div class="quick-pick-card" data-song-id="${song.id}">
        <div class="quick-pick-cover">${coverHtml}</div>
        <div class="quick-pick-title">${escapeHtml(song.title)}</div>
      </div>`;
  }).join('');
}

// ===== Popular Artists on Home =====
function renderHomePopularArtists(songs) {
  const container = document.getElementById('home-popular-artists');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Henüz sanatçı yok</p></div>';
    return;
  }

  // Count songs per artist
  const artistMap = {};
  songs.forEach(s => {
    if (!s.artist) return;
    s.artist.split(',').map(a => a.trim()).filter(Boolean).forEach(name => {
      if (!artistMap[name]) artistMap[name] = { name, count: 0, cover: null };
      artistMap[name].count++;
      if (s.cover_url && !artistMap[name].cover) artistMap[name].cover = s.cover_url;
    });
  });

  const artists = Object.values(artistMap).sort((a, b) => b.count - a.count).slice(0, 12);

  container.innerHTML = artists.map(artist => {
    const avatarHtml = artist.cover
      ? `<img src="${artist.cover}" alt="${escapeHtml(artist.name)}">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    return `
      <div class="home-artist-card" data-artist-name="${escapeHtml(artist.name)}">
        <div class="home-artist-avatar">${avatarHtml}</div>
        <div class="home-artist-name">${escapeHtml(artist.name)} ${getVerifiedTick(artist.name)}</div>
        <div class="home-artist-role">${artist.count} şarkı</div>
      </div>`;
  }).join('');

  // Click handler
  container.querySelectorAll('.home-artist-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.artistName;
      if (name) openArtistProfile(name);
    });
  });
}

// ===== Top Liked Songs =====
function renderTopLikedSongs(songs) {
  const container = document.getElementById('top-liked-songs');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Henüz beğenilen şarkı yok</p></div>';
    return;
  }
  // Show songs that the user liked, or fallback to random popular
  const liked = songs.filter(s => userLikedSongIds.has(s.id));
  const toShow = liked.length >= 4 ? liked.slice(0, 8) : [...songs].sort(() => Math.random() - 0.5).slice(0, 8);
  container.innerHTML = toShow.map(song => createSongCard(song)).join('');
}

// ===== Mood Cards Click =====
function initMoodCards() {
  document.querySelectorAll('.mood-card[data-mood]').forEach(card => {
    card.addEventListener('click', () => {
      const mood = card.dataset.mood;
      // Navigate to search and filter
      navigateTo('search');
      const input = document.getElementById('top-search-input');
      if (input) {
        input.value = mood;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
}
