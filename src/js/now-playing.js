// ===== Now Playing Overlay - Detay Overlay, Canvas, Sözler & Paylaşım =====

var npOverlayOpen = false;

function initNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  const closeBtn = document.getElementById('np-close-btn');
  const npCover = document.getElementById('now-playing-cover');
  const npInfo = document.querySelector('.now-playing-info');

  // Fullscreen button
  const fsBtn = document.getElementById('np-fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      overlay.classList.toggle('np-fullscreen');
    });
  }

  // Resize handle
  const resizeHandle = document.getElementById('np-resize-handle');
  if (resizeHandle) {
    let isResizing = false;
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      resizeHandle.classList.add('active');
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 250 && newWidth <= 800) {
        overlay.style.width = newWidth + 'px';
      }
    });
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        resizeHandle.classList.remove('active');
      }
    });
  }

  // Open overlay when clicking cover or song info in player bar
  if (npCover) {
    npCover.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.getCurrentSong()) openNowPlayingOverlay();
    });
  }
  if (npInfo) {
    npInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.getCurrentSong()) openNowPlayingOverlay();
    });
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeNowPlayingOverlay());
  }

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && npOverlayOpen) {
      closeNowPlayingOverlay();
    }
  });

  // Overlay player controls
  document.getElementById('np-play')?.addEventListener('click', () => player.togglePlay());
  document.getElementById('np-next')?.addEventListener('click', () => {
    player.next();
    setTimeout(() => updateNowPlayingOverlay(), 300);
  });
  document.getElementById('np-prev')?.addEventListener('click', () => {
    player.previous();
    setTimeout(() => updateNowPlayingOverlay(), 300);
  });
  document.getElementById('np-shuffle')?.addEventListener('click', () => {
    player.toggleShuffle();
    document.getElementById('np-shuffle')?.classList.toggle('active', player.isShuffle);
  });
  document.getElementById('np-repeat')?.addEventListener('click', () => {
    player.toggleRepeat();
    document.getElementById('np-repeat')?.classList.toggle('active', player.repeatMode !== 'none');
  });

  // Overlay progress bar click & drag
  const npProgressBar = document.getElementById('np-progress-bar');
  let npDragging = false;

  const npSeek = (e) => {
    const rect = npProgressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    player.seek(percent);
  };

  npProgressBar?.addEventListener('mousedown', (e) => {
    npDragging = true;
    npSeek(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (npDragging) npSeek(e);
  });
  document.addEventListener('mouseup', () => { npDragging = false; });

  // Like button in overlay
  document.getElementById('np-like-btn')?.addEventListener('click', async () => {
    const currentSong = player.getCurrentSong();
    if (!currentSong || !currentUserId) return;
    await toggleLikeSong(currentSong.id);
    syncNowPlayingLikeState();
  });

  // Song clicks in overlay's "more songs" list
  document.getElementById('np-songs-list')?.addEventListener('click', (e) => {
    const songItem = e.target.closest('.np-song-item[data-song-id]');
    if (songItem) {
      playSongFromAny(songItem.dataset.songId);
      setTimeout(() => updateNowPlayingOverlay(), 300);
    }
  });

  // Sync overlay progress bar with audio timeupdate
  setupOverlaySync();
}

function openNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  if (!overlay) return;
  npOverlayOpen = true;
  overlay.classList.add('open');
  updateNowPlayingOverlay();

  // Scroll to top
  const scroll = document.getElementById('np-scroll');
  if (scroll) scroll.scrollTop = 0;
}

function closeNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  if (!overlay) return;
  npOverlayOpen = false;
  overlay.classList.remove('open');
}

function updateNowPlayingOverlay() {
  const song = player.getCurrentSong();
  if (!song) return;

  // Cover art
  const coverEl = document.getElementById('np-cover-art');
  if (song.cover_url) {
    coverEl.innerHTML = `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}">`;
    // Dynamic background gradient based on cover
    coverEl.style.background = 'none';
  } else {
    coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.2" width="80" height="80"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    coverEl.style.background = 'linear-gradient(135deg,#1a1a2e,#16213e)';
  }

  // Song info
  document.getElementById('np-song-title').textContent = song.title;
  document.getElementById('np-song-artist').innerHTML = formatArtistLinks(song.artist);

  // Sync play/pause state
  syncNowPlayingPlayState();

  // Sync shuffle/repeat state
  document.getElementById('np-shuffle')?.classList.toggle('active', player.isShuffle);
  document.getElementById('np-repeat')?.classList.toggle('active', player.repeatMode !== 'none');

  // Sync like state
  syncNowPlayingLikeState();

  // Load artist info
  loadNowPlayingArtistInfo(song.artist);

  // Load more songs by artist
  loadNowPlayingMoreSongs(song);

  // Load credits
  loadNowPlayingCredits(song);

  // Load lyrics
  loadNowPlayingLyrics(song);

  // Spotify Canvas: extract colors from cover art
  updateCanvasBackground(song.cover_url);
}

// ===== Spotify Canvas Background Color Extraction =====
var _lastCanvasCoverUrl = null;

function updateCanvasBackground(coverUrl) {
  const bgEl = document.getElementById('np-canvas-bg');
  if (!bgEl) return;

  // Don't re-extract for same image
  if (coverUrl === _lastCanvasCoverUrl) return;
  _lastCanvasCoverUrl = coverUrl;

  if (!coverUrl) {
    // Reset to defaults
    bgEl.style.setProperty('--canvas-color-1', 'rgba(29, 185, 84, 0.4)');
    bgEl.style.setProperty('--canvas-color-2', 'rgba(30, 60, 120, 0.4)');
    bgEl.style.setProperty('--canvas-color-3', 'rgba(120, 40, 140, 0.35)');
    bgEl.style.setProperty('--canvas-color-4', 'rgba(200, 100, 50, 0.3)');
    return;
  }

  // Load image and extract colors
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.getElementById('np-color-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Draw small version for performance
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      const colors = extractDominantColors(imageData, size, size, 4);

      // Apply colors with nice opacity
      if (colors.length >= 4) {
        bgEl.style.setProperty('--canvas-color-1', `rgba(${colors[0].r}, ${colors[0].g}, ${colors[0].b}, 0.45)`);
        bgEl.style.setProperty('--canvas-color-2', `rgba(${colors[1].r}, ${colors[1].g}, ${colors[1].b}, 0.4)`);
        bgEl.style.setProperty('--canvas-color-3', `rgba(${colors[2].r}, ${colors[2].g}, ${colors[2].b}, 0.35)`);
        bgEl.style.setProperty('--canvas-color-4', `rgba(${colors[3].r}, ${colors[3].g}, ${colors[3].b}, 0.3)`);
      }
    } catch (e) {
      Logger.warn('Canvas color extraction error:', e);
    }
  };
  img.onerror = () => {
    // Fallback colors on error
    _lastCanvasCoverUrl = null;
  };
  img.src = coverUrl;
}

function extractDominantColors(imageData, width, height, numColors) {
  // Simple color quantization: sample pixels and cluster
  const pixels = [];
  const step = 4; // sample every 4th pixel for performance

  for (let i = 0; i < imageData.length; i += 4 * step) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const a = imageData[i + 3];

    // Skip transparent and very dark/very light pixels
    if (a < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 240) continue;

    pixels.push({ r, g, b });
  }

  if (pixels.length < numColors) {
    // Not enough pixels, return defaults
    return [
      { r: 29, g: 185, b: 84 },
      { r: 30, g: 60, b: 120 },
      { r: 120, g: 40, b: 140 },
      { r: 200, g: 100, b: 50 }
    ];
  }

  // K-means clustering (simplified)
  let centroids = [];
  const pixelStep = Math.floor(pixels.length / numColors);
  for (let i = 0; i < numColors; i++) {
    centroids.push({ ...pixels[i * pixelStep] });
  }

  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: numColors }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dr = pixel.r - centroids[c].r;
        const dg = pixel.g - centroids[c].g;
        const db = pixel.b - centroids[c].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }
      clusters[closest].push(pixel);
    }

    for (let c = 0; c < numColors; c++) {
      if (clusters[c].length === 0) continue;
      const sum = clusters[c].reduce((acc, p) => ({
        r: acc.r + p.r,
        g: acc.g + p.g,
        b: acc.b + p.b
      }), { r: 0, g: 0, b: 0 });
      centroids[c] = {
        r: Math.round(sum.r / clusters[c].length),
        g: Math.round(sum.g / clusters[c].length),
        b: Math.round(sum.b / clusters[c].length)
      };
    }
  }

  // Boost saturation slightly for more vivid blobs
  return centroids.map(c => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const boost = 1.3;
    const avg = (c.r + c.g + c.b) / 3;
    return {
      r: Math.min(255, Math.round(avg + (c.r - avg) * boost)),
      g: Math.min(255, Math.round(avg + (c.g - avg) * boost)),
      b: Math.min(255, Math.round(avg + (c.b - avg) * boost))
    };
  });
}

// ===== Lyrics System =====
var currentLyricsData = null;
var parsedSyncedLyrics = [];
var currentActiveLyricIndex = -1;
var lyricsCollapsed = false;
var isLyricShareMode = false;
var selectedLyricIndexes = [];
var lastLyricsSongId = null;
var currentLyricOffset = 0; // seconds

function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const times = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
      times.push(minutes * 60 + seconds + ms / 1000);
    }

    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();

    for (const time of times) {
      parsed.push({ time, text });
    }
  }

  // Sort by time
  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

async function loadNowPlayingLyrics(song) {
  if (!song) return;

  // Don't reload if same song
  if (lastLyricsSongId === song.id && currentLyricsData !== undefined) return;
  lastLyricsSongId = song.id;

  const loadingEl = document.getElementById('np-lyrics-loading');
  const contentEl = document.getElementById('np-lyrics-content');
  const notFoundEl = document.getElementById('np-lyrics-not-found');

  if (!loadingEl || !contentEl || !notFoundEl) return;

  // Show loading
  loadingEl.style.display = 'flex';
  contentEl.style.display = 'none';
  notFoundEl.style.display = 'none';
  currentLyricsData = null;
  parsedSyncedLyrics = [];
  currentActiveLyricIndex = -1;
  currentLyricOffset = 0;

  const syncDisp = document.getElementById('sync-offset-display');
  if (syncDisp) { syncDisp.textContent = '0.0s'; syncDisp.style.color = 'var(--ts)'; }
  const syncCtrl = document.getElementById('lyric-sync-controls');
  if (syncCtrl) syncCtrl.style.display = 'none';

  try {
    const result = await getLyrics(song);

    loadingEl.style.display = 'none';

    if (!result || (!result.plainLyrics && !result.syncedLyrics)) {
      // No lyrics found
      notFoundEl.style.display = 'flex';
      currentLyricsData = null;
      return;
    }

    currentLyricsData = result;

    // Render lyrics
    if (result.syncedLyrics) {
      if (syncCtrl) syncCtrl.style.display = 'flex';
      // Parse and render synced lyrics
      parsedSyncedLyrics = parseLRC(result.syncedLyrics);
      renderSyncedLyrics(parsedSyncedLyrics);
    } else if (result.plainLyrics) {
      // Render plain text with fake timings
      renderPlainLyrics(result.plainLyrics, song.duration);
    }

    contentEl.style.display = 'block';
  } catch (err) {
    console.error('Lyrics load error:', err);
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'flex';
  }
}

function renderSyncedLyrics(lines) {
  const contentEl = document.getElementById('np-lyrics-content');
  if (!contentEl) return;

  let html = '<div class="np-lyrics-synced">';

  lines.forEach((line, i) => {
    const text = line.text || '';
    const isInstrumental = text === '' || text === '♪' || text === '♫';

    if (isInstrumental) {
      html += `<div class="np-lyric-line instrumental" data-lyric-index="${i}" data-lyric-time="${line.time}">♪ ♪ ♪</div>`;
    } else {
      const words = text.split(/\s+/);
      const lineStart = line.time;
      const lineEnd = (i < lines.length - 1) ? lines[i + 1].time : lineStart + 4;
      const duration = lineEnd - lineStart;

      html += `<div class="np-lyric-line" data-lyric-index="${i}" data-lyric-time="${line.time}">`;
      words.forEach((word, wi) => {
        const wordTime = lineStart + (duration * wi / Math.max(words.length, 1));
        html += `<span class="np-lyric-word" data-word-time="${wordTime.toFixed(3)}">${escapeHtml(word)}</span>`;
      });
      html += '</div>';
    }
  });

  html += '</div>';
  contentEl.innerHTML = html;

  // Click to seek
  contentEl.querySelectorAll('.np-lyric-line').forEach(el => {
    el.addEventListener('click', () => {


      const time = parseFloat(el.dataset.lyricTime);
      if (!isNaN(time) && player.audio.duration) {
        player.audio.currentTime = time;
        if (!player.isPlaying) {
          player.audio.play();
          player.isPlaying = true;
          player.updatePlayButton();
        }
      }
    });
  });
}

function renderPlainLyrics(text, duration) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const totalDuration = duration || 180; // Varsayılan 3 dakika, eğer şarkı süresi yoksa
  const timePerLine = totalDuration / lines.length;

  const fakeSynced = lines.map((lineText, i) => {
    return {
      time: i * timePerLine,
      text: lineText
    };
  });

  parsedSyncedLyrics = fakeSynced;
  renderSyncedLyrics(fakeSynced);
}

function updateSyncedLyricsHighlight(currentTime) {
  if (!parsedSyncedLyrics || parsedSyncedLyrics.length === 0) return;

  let adjustedTime = currentTime + currentLyricOffset;

  // Find active line
  let activeIdx = -1;
  for (let i = parsedSyncedLyrics.length - 1; i >= 0; i--) {
    if (adjustedTime >= parsedSyncedLyrics[i].time) {
      activeIdx = i;
      break;
    }
  }

  const container = document.getElementById('np-lyrics-container');
  const lines = document.querySelectorAll('.np-lyric-line');
  if (!lines.length) return;

  // Update line states & scroll only when active line changes
  if (activeIdx !== currentActiveLyricIndex) {
    currentActiveLyricIndex = activeIdx;

    lines.forEach((el, i) => {
      el.classList.remove('active', 'past');
      if (i === activeIdx) {
        el.classList.add('active');
      } else if (i < activeIdx) {
        el.classList.add('past');
      }
    });

    // Auto-scroll active line to center
    if (activeIdx >= 0 && lines[activeIdx] && container) {
      const lineEl = lines[activeIdx];
      const containerRect = container.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const offset = lineRect.top - containerRect.top - containerRect.height / 2 + lineRect.height / 2;
      container.scrollTop += offset;
    }
  }

  // Word-level highlighting (runs every frame for smooth transitions)
  const allWords = document.querySelectorAll('.np-lyric-word');
  allWords.forEach(wordEl => {
    const wordTime = parseFloat(wordEl.dataset.wordTime);
    if (adjustedTime >= wordTime) {
      wordEl.classList.add('sung');
    } else {
      wordEl.classList.remove('sung');
    }
  });
}

function initLyricsToggle() {
  const toggleBtn = document.getElementById('np-lyrics-toggle');
  const container = document.getElementById('np-lyrics-container');
  if (!toggleBtn || !container) return;

  // Prevent multiple bindings
  if (toggleBtn.dataset.bound) return;
  toggleBtn.dataset.bound = 'true';

  toggleBtn.addEventListener('click', () => {
    lyricsCollapsed = !lyricsCollapsed;
    container.classList.toggle('collapsed', lyricsCollapsed);
    toggleBtn.classList.toggle('collapsed', lyricsCollapsed);
  });
}

function initLyricsSyncControls() {
  const btnMinus = document.getElementById('btn-sync-minus');
  const btnPlus = document.getElementById('btn-sync-plus');
  if (!btnMinus || !btnPlus) return;

  if (btnMinus.dataset.bound) return;
  btnMinus.dataset.bound = 'true';
  btnPlus.dataset.bound = 'true';

  btnMinus.addEventListener('click', () => adjustLyricSync(-0.5));
  btnPlus.addEventListener('click', () => adjustLyricSync(0.5));
}

function adjustLyricSync(delta) {
  currentLyricOffset += delta;
  const disp = document.getElementById('sync-offset-display');
  if (disp) {
    disp.textContent = (currentLyricOffset > 0 ? '+' : '') + currentLyricOffset.toFixed(1) + 's';
    disp.style.color = currentLyricOffset === 0 ? 'var(--ts)' : 'var(--green)';
  }
  if (parsedSyncedLyrics && parsedSyncedLyrics.length > 0) {
    updateSyncedLyricsHighlight(player.audio.currentTime);
  }
}

function syncNowPlayingPlayState() {
  const playIcon = document.getElementById('np-icon-play');
  const pauseIcon = document.getElementById('np-icon-pause');
  if (player.isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

function syncNowPlayingLikeState() {
  const song = player.getCurrentSong();
  const npLikeBtn = document.getElementById('np-like-btn');
  if (!npLikeBtn || !song) return;
  npLikeBtn.classList.toggle('liked', userLikedSongIds.has(song.id));
}

function setupOverlaySync() {
  // Override the player's onTimeUpdate to also update overlay
  const originalOnTimeUpdate = player.onTimeUpdate.bind(player);
  player.onTimeUpdate = function () {
    originalOnTimeUpdate();

    const { currentTime, duration } = this.audio;
    if (!duration) return;

    // Always update synced lyrics highlight so it's ready when opened
    if (parsedSyncedLyrics && parsedSyncedLyrics.length > 0) {
      updateSyncedLyricsHighlight(currentTime);
    }

    if (!npOverlayOpen) return;

    const percent = (currentTime / duration) * 100;

    const fill = document.getElementById('np-progress-fill');
    const knob = document.getElementById('np-progress-knob');
    const timeCurrent = document.getElementById('np-time-current');

    if (fill) fill.style.width = percent + '%';
    if (knob) knob.style.left = percent + '%';
    if (timeCurrent) timeCurrent.textContent = this.formatTime(currentTime);
  };


  // Override onLoaded to sync total time
  const originalOnLoaded = player.onLoaded.bind(player);
  player.onLoaded = function () {
    originalOnLoaded();
    const timeTotal = document.getElementById('np-time-total');
    if (timeTotal) timeTotal.textContent = this.formatTime(this.audio.duration);
  };

  // Override updatePlayButton to sync overlay
  const originalUpdatePlayButton = player.updatePlayButton.bind(player);
  player.updatePlayButton = function () {
    originalUpdatePlayButton();
    if (npOverlayOpen) syncNowPlayingPlayState();
  };

  // Override updateUI to refresh overlay when song changes
  const originalUpdateUI = player.updateUI.bind(player);
  player.updateUI = function (song) {
    originalUpdateUI(song);
    // Reset lyrics for new song
    lastLyricsSongId = null;
    currentLyricsData = undefined;
    parsedSyncedLyrics = [];
    currentActiveLyricIndex = -1;
    if (npOverlayOpen) {
      setTimeout(() => updateNowPlayingOverlay(), 100);
    }
  };
}

async function loadNowPlayingArtistInfo(artistName) {
  const section = document.getElementById('np-artist-section');
  const nameEl = document.getElementById('np-artist-name');
  const bioEl = document.getElementById('np-artist-bio');
  const avatarEl = document.getElementById('np-artist-avatar');
  const statsEl = document.getElementById('np-artist-stats');
  const songCountEl = document.getElementById('np-artist-song-count');

  if (!section || !artistName) return;

  // For multi-artist, use the first artist name for the main display
  const primaryArtist = artistName.includes(',') ? artistName.split(',')[0].trim() : artistName;

  // Set artist name
  nameEl.innerHTML = escapeHtml(primaryArtist) + getVerifiedTick(primaryArtist);

  // Count songs by this artist
  const artistSongs = allSongs.filter(s => s.artist?.toLowerCase().includes(primaryArtist.toLowerCase()));
  songCountEl.textContent = `${artistSongs.length} şarkı platformda`;

  // Try to find artist profile - check BOTH profiles AND artists table
  try {
    const sb = getSupabase();

    // 1. Check profiles table first
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username, avatar_url, bio, role')
      .ilike('username', primaryArtist)
      .limit(1);

    // 2. Also check artists table
    let artistTableData = null;
    try {
      const { data: artistRes } = await sb
        .from('artists')
        .select('id, name, avatar_url')
        .ilike('name', primaryArtist)
        .maybeSingle();
      artistTableData = artistRes;
    } catch (e) {
      Logger.warn('Artist table lookup error:', e);
    }

    if (profiles && profiles.length > 0) {
      const profile = profiles[0];

      // Avatar: prefer profile avatar, fallback to artists table avatar
      const avatarUrl = profile.avatar_url || (artistTableData && artistTableData.avatar_url);
      if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(primaryArtist)}">`;
      } else {
        const initials = getInitials(primaryArtist);
        const color = getAvatarColor(primaryArtist);
        avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      }

      // Bio
      if (profile.bio) {
        bioEl.textContent = profile.bio;
        bioEl.style.display = 'block';
      } else {
        bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
        bioEl.style.display = 'block';
      }

      // Followers count
      const { count: followersCount } = await sb
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', profile.id)
        .eq('status', 'accepted');

      if (followersCount > 0) {
        songCountEl.textContent = `${artistSongs.length} şarkı · ${followersCount} takipçi`;
      }
    } else if (artistTableData) {
      // Found in artists table but not in profiles
      if (artistTableData.avatar_url) {
        avatarEl.innerHTML = `<img src="${artistTableData.avatar_url}" alt="${escapeHtml(primaryArtist)}">`;
      } else {
        const initials = getInitials(primaryArtist);
        const color = getAvatarColor(primaryArtist);
        avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      }
      bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
      bioEl.style.display = 'block';
    } else {
      // No profile found - show defaults
      const initials = getInitials(primaryArtist);
      const color = getAvatarColor(primaryArtist);
      avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
      bioEl.style.display = 'block';
    }
  } catch (err) {
    Logger.warn('Artist info load error:', err);
    const initials = getInitials(primaryArtist);
    const color = getAvatarColor(primaryArtist);
    avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
    bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
    bioEl.style.display = 'block';
  }
}

function loadNowPlayingMoreSongs(currentSong) {
  const container = document.getElementById('np-songs-list');
  const titleEl = document.getElementById('np-more-songs-title');
  const section = document.getElementById('np-more-songs');
  if (!container || !currentSong) return;

  const moreSongs = allSongs.filter(s =>
    s.artist?.toLowerCase() === currentSong.artist?.toLowerCase() &&
    s.id !== currentSong.id
  );

  if (moreSongs.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  titleEl.textContent = `${escapeHtml(currentSong.artist)} - Diğer Şarkılar`;

  container.innerHTML = moreSongs.slice(0, 10).map(song => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    return `
      <div class="np-song-item" data-song-id="${song.id}">
        <div class="np-song-item-cover">${coverHtml}</div>
        <div class="np-song-item-info">
          <div class="np-song-item-title">${escapeHtml(song.title)}</div>
          <div class="np-song-item-album">${escapeHtml(song.album || currentSong.artist)}</div>
        </div>
        <span class="np-song-item-duration">${formatDuration(song.duration)}</span>
      </div>
    `;
  }).join('');
}

async function loadNowPlayingCredits(song) {
  const container = document.getElementById('np-credits-list');
  const section = document.getElementById('np-credits');
  if (!container || !song) return;

  // Build credits from available data
  const credits = [];

  // Parse multi-artist (comma-separated)
  const artistNames = song.artist ? song.artist.split(',').map(a => a.trim()).filter(Boolean) : [];

  for (let idx = 0; idx < artistNames.length; idx++) {
    const name = artistNames[idx];

    let avatarUrl = null;
    try {
      if (typeof getArtistByName === 'function') {
        const artistProfile = await getArtistByName(name);
        if (artistProfile && artistProfile.avatar_url) {
          avatarUrl = artistProfile.avatar_url;
        }
      }
    } catch (e) {
      Logger.warn('Credits artist fetch error:', e);
    }

    credits.push({
      name: name,
      role: idx === 0 ? 'Ana Sanatçı' : 'İşbirliği',
      isArtist: true,
      avatarUrl: avatarUrl
    });
  }

  // If album exists, show album info
  if (song.album) {
    credits.push({
      name: song.album,
      role: 'Albüm',
      isAlbum: true
    });
  }

  section.style.display = credits.length > 0 ? 'block' : 'none';

  container.innerHTML = credits.map(credit => {
    let avatarHtml;
    if (credit.isArtist) {
      if (credit.avatarUrl) {
        avatarHtml = `<img src="${credit.avatarUrl}" alt="${escapeHtml(credit.name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        const initials = getInitials(credit.name);
        const color = getAvatarColor(credit.name);
        avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>`;
      }
    } else if (credit.isAlbum) {
      avatarHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style="color:var(--tm)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`;
    } else {
      avatarHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style="color:var(--tm)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    }

    return `
      <div class="np-credit-item">
        <div class="np-credit-avatar">${avatarHtml}</div>
        <div class="np-credit-info">
          <div class="np-credit-name">${escapeHtml(credit.name)}${credit.isArtist ? getVerifiedTick(credit.name) : ''}</div>
          <div class="np-credit-role">${credit.role}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Lyric Sharing =====
function initLyricShare() {
  const btnShare = document.getElementById('btn-share-lyrics');
  const overlaySelection = document.getElementById('overlay-lyrics-selection');
  const selectionList = document.getElementById('lyrics-selection-list');
  const btnCancelSelection = document.getElementById('btn-share-cancel');
  const btnContinueSelection = document.getElementById('btn-share-continue');
  const countSpan = document.getElementById('lyrics-share-count');

  if (!btnShare || !overlaySelection) return;

  function resetSelectionMode() {
    selectedLyricIndexes = [];
    if (overlaySelection) overlaySelection.style.display = 'none';
    selectionList.innerHTML = '';
    btnContinueSelection.disabled = true;
    countSpan.textContent = '0/2 Seçildi';
  }

  btnShare.addEventListener('click', () => {
    if (!parsedSyncedLyrics || parsedSyncedLyrics.length === 0) {
      showToast('Paylaşılacak şarkı sözü bulunamadı', 'error');
      return;
    }

    // Pause the song
    if (player.isPlaying) {
      player.audio.pause();
      player.isPlaying = false;
      player.updatePlayButton();
    }

    selectedLyricIndexes = [];
    btnContinueSelection.disabled = true;
    countSpan.textContent = '0/2 Seçildi';

    // Populate selection list
    selectionList.innerHTML = '';
    parsedSyncedLyrics.forEach((line, i) => {
      const text = line.text || '';
      const isInstrumental = text === '' || text === '♪' || text === '♫';
      if (isInstrumental) return;

      const div = document.createElement('div');
      div.className = 'share-lyric-line';
      div.textContent = text;
      div.dataset.index = i;

      div.addEventListener('click', () => {
        const idx = parseInt(div.dataset.index);
        if (selectedLyricIndexes.includes(idx)) {
          selectedLyricIndexes = selectedLyricIndexes.filter(x => x !== idx);
          div.classList.remove('selected-for-share');
        } else {
          if (selectedLyricIndexes.length < 2) {
            selectedLyricIndexes.push(idx);
            div.classList.add('selected-for-share');
          } else {
            showToast('En fazla 2 satır seçebilirsiniz', 'warning');
          }
        }
        countSpan.textContent = `${selectedLyricIndexes.length}/2 Seçildi`;
        btnContinueSelection.disabled = selectedLyricIndexes.length === 0;
      });

      selectionList.appendChild(div);
    });

    if (overlaySelection) overlaySelection.style.display = 'flex';
  });

  btnCancelSelection.addEventListener('click', resetSelectionMode);
  document.getElementById('btn-close-lyrics-selection')?.addEventListener('click', resetSelectionMode);

  // Generate Card Button
  btnContinueSelection.addEventListener('click', () => {
    if (selectedLyricIndexes.length === 0) return;
    const song = player.getCurrentSong();
    if (!song) return;

    // Collect texts
    selectedLyricIndexes.sort((a, b) => a - b);
    const texts = selectedLyricIndexes.map(idx => parsedSyncedLyrics[idx].text);

    // Populate card
    document.getElementById('card-lyrics-text').innerHTML = '"' + texts.map(escapeHtml).join('<br>') + '"';
    document.getElementById('card-song-title').textContent = escapeHtml(song.title || 'Bilinmiyor');
    document.getElementById('card-song-artist').textContent = escapeHtml(song.artist || 'Sanatçı');

    const coverUrl = song.cover_url || '';
    document.getElementById('card-cover-img').src = coverUrl;

    const overlayShare = document.getElementById('overlay-share-lyrics');
    const preview = document.getElementById('share-lyrics-preview-container');
    const downloadBtn = document.getElementById('btn-download-lyric-card');

    preview.innerHTML = '<div class="spinner"></div>';
    resetSelectionMode(); // Close selection modal
    if (overlayShare) overlayShare.style.display = 'flex'; // Open preview modal

    setTimeout(() => {
      if (typeof html2canvas === 'undefined') {
        preview.innerHTML = '<p style="color:white;padding:20px">html2canvas yüklenemedi.</p>';
        return;
      }

      const template = document.getElementById('lyric-card-template');
      const bgEl = document.getElementById('np-canvas-bg');
      if (bgEl) {
        const c1Raw = bgEl.style.getPropertyValue('--canvas-color-1');
        const c2Raw = bgEl.style.getPropertyValue('--canvas-color-2');
        const toRgb = (rgbaStr) => {
          if (!rgbaStr) return null;
          const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
          return null;
        };
        const c1 = toRgb(c1Raw) || '#1DB954';
        const c2 = toRgb(c2Raw) || '#450af5';
        template.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      }

      html2canvas(template, { scale: 1, useCORS: true, backgroundColor: null }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png');
        preview.innerHTML = `<img src="${dataUrl}" style="width:100%; height:auto; display:block">`;

        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `bekofy-sozler-${song.title}.png`;
          a.click();
        };
      }).catch(err => {
        preview.innerHTML = '<p style="color:white;padding:20px">Resim oluşturulamadı.</p>';
      });
    }, 100);
  });

  // Modal close
  document.getElementById('btn-close-share-lyrics')?.addEventListener('click', () => {
    const overlayShare = document.getElementById('overlay-share-lyrics');
    if (overlayShare) overlayShare.style.display = 'none';
  });
}

// ===== Mini Player Button =====
function initMiniPlayerButton() {
  const btn = document.getElementById('btn-mini-player');
  if (!btn) return;

  // Only show in Electron
  if (!window.electronAPI || !window.electronAPI.toggleMiniPlayer) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => {
    const song = player.getCurrentSong();
    if (song) {
      // Send current song data before toggling
      window.electronAPI.updateMiniPlayer({
        title: song.title,
        artist: song.artist,
        cover_url: song.cover_url || '',
        isPlaying: player.isPlaying
      });
    }
    window.electronAPI.toggleMiniPlayer();
  });
}

// Initialize on DOMContentLoaded (append to existing init)
document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly so player is ready
  setTimeout(() => {
    initNowPlayingOverlay();
    initLyricsToggle();
    initLyricShare();
  }, 200);
});
