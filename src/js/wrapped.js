// ===== Wrapped Module =====

window.loadWrapped = async function() {
  const mainContent = document.getElementById('wrapped-content');
  if (!mainContent) return;
  mainContent.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const sb = getSupabase();
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31T23:59:59`;
    const { data: listeningData, error } = await sb.from('listening_history')
      .select('song_id, songs!inner(id, title, artist, cover_url, duration), listened_at')
      .eq('user_id', window.currentUserId)
      .gte('listened_at', startDate)
      .lte('listened_at', endDate)
      .order('listened_at', { ascending: false });
    if (error) throw error;
    if (!listeningData || listeningData.length === 0) {
      mainContent.innerHTML = `
        <div class="empty-state">
          <div style="font-size:64px;margin-bottom:16px">🎵</div>
          <h2>Henüz Wrapped veriniz yok</h2>
          <p style="color:var(--ts);margin-top:8px">${year} yılında şarkı dinlemeye başladığınızda burada görünecek!</p>
        </div>`;
      return;
    }
    const songCounts = {};
    const artistCounts = {};
    let totalDuration = 0;
    const albumCounts = {};
    listeningData.forEach(item => {
      const songId = item.song_id;
      const song = item.songs;
      songCounts[songId] = (songCounts[songId] || 0) + 1;
      const artist = song.artist;
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      totalDuration += song.duration || 0;
    });
    const topSongs = Object.entries(songCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([songId, count]) => {
        const songItem = listeningData.find(d => d.song_id === songId);
        return { ...songItem.songs, playCount: count };
      });
    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([artist, count]) => ({ name: artist, playCount: count }));
    const totalMinutes = Math.floor(totalDuration / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const topGenre = topArtists.length > 0 ? topArtists[0].name : 'Bilinmiyor';
    const uniqueSongs = Object.keys(songCounts).length;
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasListened = listeningData.some(item => {
        const listenedDate = new Date(item.listened_at).toISOString().split('T')[0];
        return listenedDate === dateStr;
      });
      if (hasListened) {
        currentStreak++;
      } else {
        break;
      }
    }
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthlyData = Array(12).fill(0);
    listeningData.forEach(item => {
      const month = new Date(item.listened_at).getMonth();
      monthlyData[month]++;
    });
    const maxMonthly = Math.max(...monthlyData);
    const topSongCover = topSongs[0]?.cover_url || '';
    mainContent.innerHTML = `
      <div class="wrapped-container">
        <div class="wrapped-header">
          <div class="wrapped-badge">${year}</div>
          <h1 class="wrapped-title">Bekofy Wrapped</h1>
          <p class="wrapped-subtitle">Müzikal yolculuğunuzun özeti</p>
        </div>

        <div class="wrapped-card card-yearly-stats">
          <div class="wrapped-icon">📊</div>
          <h2>Yılın Özeti</h2>
          <div class="wrapped-stats-grid">
            <div class="wrapped-stat-item">
              <div class="wrapped-stat-value">${listeningData.length}</div>
              <div class="wrapped-stat-label">Dinleme</div>
            </div>
            <div class="wrapped-stat-item">
              <div class="wrapped-stat-value">${uniqueSongs}</div>
              <div class="wrapped-stat-label">Farklı Şarkı</div>
            </div>
            <div class="wrapped-stat-item">
              <div class="wrapped-stat-value">${hours > 0 ? `${hours}sa ${minutes}dk` : `${minutes}dk`}</div>
              <div class="wrapped-stat-label">Toplam Süre</div>
            </div>
            <div class="wrapped-stat-item">
              <div class="wrapped-stat-value">${currentStreak}</div>
              <div class="wrapped-stat-label">Gün Serisi</div>
            </div>
          </div>
        </div>

        <div class="wrapped-card card-top-song">
          <div class="wrapped-icon">🏆</div>
          <h2>1 Numaralı Şarkın</h2>
          <div class="wrapped-top-song">
            ${topSongCover ? `<img src="${topSongCover}" alt="" class="wrapped-song-cover">` : `<div class="wrapped-song-cover-placeholder">🎵</div>`}
            <div class="wrapped-song-details">
              <div class="wrapped-song-name">${escapeHtml(topSongs[0]?.title || '')}</div>
              <div class="wrapped-song-artist">${formatArtistLinks(topSongs[0]?.artist || '')}</div>
              <div class="wrapped-play-count">${topSongs[0]?.playCount || 0} kez dinledin</div>
            </div>
          </div>
        </div>

        <div class="wrapped-card card-monthly-activity">
          <div class="wrapped-icon">📈</div>
          <h2>Aylık Aktivite</h2>
          <div class="wrapped-chart-container">
            <div class="wrapped-chart" id="wrapped-activity-chart">
              ${months.map((month, i) => {
      const height = maxMonthly > 0 ? (monthlyData[i] / maxMonthly) * 100 : 0;
      return `<div class="chart-bar" style="--height: ${height}%">
                  <div class="chart-bar-fill"></div>
                  <div class="chart-label">${month.substring(0, 3)}</div>
                </div>`;
    }).join('')}
            </div>
          </div>
        </div>

        <div class="wrapped-card card-top-songs">
          <div class="wrapped-icon">🎵</div>
          <h2>En Çok Dinlediğin 5 Şarkı</h2>
          <div class="wrapped-ranking-list">
            ${topSongs.map((song, index) => `
              <div class="wrapped-ranking-item">
                <div class="wrapped-rank">#${index + 1}</div>
                <div class="wrapped-ranking-info">
                  <div class="wrapped-ranking-name">${escapeHtml(song.title)}</div>
                  <div class="wrapped-ranking-artist">${formatArtistLinks(song.artist)}</div>
                  <div class="wrapped-ranking-plays">${song.playCount} kez</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="wrapped-card card-top-artists">
          <div class="wrapped-icon">🎤</div>
          <h2>En Çok Dinlediğin Sanatçılar</h2>
          <div class="wrapped-ranking-list">
            ${topArtists.map((artist, index) => `
              <div class="wrapped-ranking-item">
                <div class="wrapped-rank">#${index + 1}</div>
                <div class="wrapped-ranking-info">
                  <div class="wrapped-ranking-name">${escapeHtml(artist.name)}${getVerifiedTick(artist.name)}</div>
                  <div class="wrapped-ranking-plays">${artist.playCount} kez</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="wrapped-footer">
          <p>Bekofy Wrapped ${year} 🎉</p>
          <p style="font-size: 14px; margin-top: 8px;">Müzik hayatının bir parçası</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('loadWrapped error:', err);
    mainContent.innerHTML = `
      <div class="empty-state">
        <div style="font-size:64px;margin-bottom:16px">😔</div>
        <h2>Wrapped yüklenemedi</h2>
        <p style="color:var(--ts);margin-top:8px">Lütfen tekrar deneyin</p>
      </div>`;
  }
};

// wrapped.js - Wrapped: yıllık dinleme özeti, istatistikler
