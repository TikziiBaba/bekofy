// ===== Jam Feature - Jam Oturumları =====

function initJamUI() {
  const btnJam = document.getElementById('btn-jam');
  const modal = document.getElementById('jam-modal');
  const closeBtn = document.getElementById('jam-close');
  const btnCreate = document.getElementById('btn-create-jam');
  const btnJoin = document.getElementById('btn-join-jam');
  const inputCode = document.getElementById('jam-code-input');
  const btnLeave = document.getElementById('btn-leave-jam');

  const createSection = document.getElementById('jam-create-section');
  const activeSection = document.getElementById('jam-active-section');
  const activeCodeText = document.getElementById('jam-active-code');
  const activeBanner = document.getElementById('jam-active-banner');
  const bannerCount = document.getElementById('jam-banner-count');
  const bannerCode = document.getElementById('jam-banner-code');
  const bannerLeave = document.getElementById('jam-banner-leave');

  if (!btnJam) return;

  const updateJamModalState = () => {
    if (player.jamSessionId) {
      createSection.style.display = 'none';
      activeSection.style.display = 'block';
      activeBanner.style.display = 'flex';
      btnJam.classList.add('active');
      btnJam.style.color = 'var(--primary-color)';
    } else {
      createSection.style.display = 'block';
      activeSection.style.display = 'none';
      activeBanner.style.display = 'none';
      btnJam.classList.remove('active');
      btnJam.style.color = '';
    }
  };

  btnJam.addEventListener('click', () => {
    modal.style.display = 'flex';
    updateJamModalState();
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  btnCreate.addEventListener('click', async () => {
    if (!currentUserId) {
      showToast('Jam oluşturmak için giriş yapmalısınız', 'error');
      return;
    }

    btnCreate.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;"></div> Oluşturuluyor...';
    btnCreate.disabled = true;

    try {
      const { data, error } = await createJamSession(currentUserId);
      if (error) throw error;

      activeCodeText.textContent = data.code;
      bannerCode.textContent = '#' + data.code;

      player.setJamSession(data.id, true);

      const subscribed = await subscribeToJam(data.id, (payload) => {
        player.handleJamEvent(payload);
      });

      if (!subscribed) {
        Logger.error('Host channel subscription failed');
        showToast('Jam kanalına bağlanılamadı, tekrar deneyin', 'error');
        player.clearJamSession();
        return;
      }

      updateJamModalState();
      refreshJamParticipants(data.id);

      // Save initial state if already playing a song
      const currentSong = player.getCurrentSong();
      if (currentSong) {
        updateJamState(data.id, currentSong.id, player.isPlaying, player.audio.currentTime || 0)
          .catch(err => Logger.warn('Initial state save error:', err));
      }

      // Share code to clipboard optionally
      navigator.clipboard.writeText(data.code).then(() => {
        showToast('Jam kodu panoya kopyalandı!', 'success');
      });

    } catch (err) {
      Logger.error(err);
      showToast('Jam oluşturulamadı', 'error');
    } finally {
      btnCreate.innerHTML = '✨ Jam Oluştur';
      btnCreate.disabled = false;
    }
  });

  btnJoin.addEventListener('click', async () => {
    if (!currentUserId) {
      showToast('Jam\'e katılmak için giriş yapmalısınız', 'error');
      return;
    }

    const code = inputCode.value.trim();
    if (code.length !== 6) {
      showToast('Geçerli bir kod girin', 'error');
      return;
    }

    btnJoin.disabled = true;
    try {
      const { data: session, error: findErr } = await findJamByCode(code);
      if (findErr || !session) throw new Error('Oturum bulunamadı');

      await joinJamSession(session.id, currentUserId);

      activeCodeText.textContent = session.code;
      bannerCode.textContent = '#' + session.code;

      player.setJamSession(session.id, false);

      const subscribed = await subscribeToJam(session.id, (payload) => {
        player.handleJamEvent(payload);
      });

      if (!subscribed) {
        Logger.error('Guest channel subscription failed');
        showToast('Jam kanalına bağlanılamadı, tekrar deneyin', 'error');
        player.clearJamSession();
        return;
      }

      updateJamModalState();
      refreshJamParticipants(session.id);

      // Fetch current playback state from DB and sync
      try {
        const jamState = await getJamSession(session.id);
        if (jamState && jamState.current_song_id) {
          const songToPlay = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.id === jamState.current_song_id);
          if (songToPlay) {
            await player.playSong(songToPlay, typeof allSongs !== 'undefined' ? allSongs : [songToPlay]);
            // Seek to the approximate position (account for network delay)
            if (jamState.current_position > 0) {
              const elapsed = (Date.now() - new Date(jamState.updated_at).getTime()) / 1000;
              const targetPos = jamState.is_playing ? jamState.current_position + elapsed : jamState.current_position;
              player.audio.currentTime = Math.min(targetPos, player.audio.duration || targetPos);
            }
            if (!jamState.is_playing) {
              player.audio.pause();
              player.isPlaying = false;
              player.updatePlayButton();
            }
          }
        }
      } catch (syncErr) {
        Logger.warn('Initial state sync error:', syncErr);
      }

      showToast('Jam\'e katılıldı!', 'success');

    } catch (err) {
      Logger.error(err);
      showToast('Jam oturumu bulunamadı veya katılamadınız', 'error');
    } finally {
      btnJoin.disabled = false;
    }
  });

  const leaveJam = async () => {
    if (!player.jamSessionId) return;
    try {
      if (player.isJamHost) {
        await endJamSession(player.jamSessionId);
        player.broadcastJamAction('end_session');
      } else {
        await leaveJamSession(player.jamSessionId, currentUserId);
      }
    } catch (e) {
      Logger.error(e);
    }
    player.clearJamSession();
    unsubscribeFromJam();
    updateJamModalState();
    modal.style.display = 'none';
  };

  btnLeave.addEventListener('click', leaveJam);
  bannerLeave.addEventListener('click', leaveJam);
}

async function refreshJamParticipants(sessionId) {
  const list = document.getElementById('jam-participants-list');
  const countEl = document.getElementById('jam-modal-count');
  const bannerCount = document.getElementById('jam-banner-count');
  if (!list || !sessionId) return;

  try {
    const participants = await getJamParticipants(sessionId);
    countEl.textContent = participants.length;
    bannerCount.textContent = participants.length + ' kişi';

    list.innerHTML = participants.map(p => {
      let frameClass = '';
      if (p.profiles?.avatar_frame && p.profiles.avatar_frame !== 'none') {
        frameClass = ' ' + getAvatarFrameClass(p.profiles.avatar_frame);
      }
      return `
      <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
        <div class="jam-avatar-wrap${frameClass}" style="position:relative; width:30px; height:30px; border-radius:50%">
          <img src="${p.profiles?.avatar_url || '../assets/default_avatar.png'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; position:relative; z-index:2">
        </div>
        <span style="flex: 1; font-size: 14px;">${p.profiles?.username || 'Kullanıcı'}</span>
        ${p.user_id === player.jamSessionId ? '<span style="font-size: 10px; background: var(--primary-color); color: black; padding: 2px 6px; border-radius: 10px;">Kurucu</span>' : ''}
      </div>
    `}).join('');
  } catch (err) {
    Logger.error('Participant refresh error:', err);
  }
}

// Called when the host ends the session (received by guests via broadcast)
function onJamEnded() {
  const activeBanner = document.getElementById('jam-active-banner');
  if (activeBanner) activeBanner.style.display = 'none';
  const btnJam = document.getElementById('btn-jam');
  if (btnJam) {
    btnJam.classList.remove('active');
    btnJam.style.color = '';
  }
  const createSection = document.getElementById('jam-create-section');
  const activeSection = document.getElementById('jam-active-section');
  if (createSection) createSection.style.display = 'block';
  if (activeSection) activeSection.style.display = 'none';
  unsubscribeFromJam();
}
