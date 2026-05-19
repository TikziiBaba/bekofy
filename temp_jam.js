const fs = require('fs');
const path = 'c:/Users/dedyu/Desktop/bekir/src/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const jamLogic = `

// ===== Jam UI & Logic =====
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
      
      subscribeToJam(data.id, (payload) => {
        player.handleJamEvent(payload);
      });
      
      updateJamModalState();
      refreshJamParticipants(data.id);
      
      // Share code to clipboard optionally
      navigator.clipboard.writeText(data.code).then(() => {
        showToast('Jam kodu panoya kopyalandı!', 'success');
      });

    } catch (err) {
      console.error(err);
      showToast('Jam oluşturulamadı', 'error');
    } finally {
      btnCreate.innerHTML = '✨ Jam Oluştur';
      btnCreate.disabled = false;
    }
  });

  btnJoin.addEventListener('click', async () => {
    if (!currentUserId) {
      showToast('Jam\\'e katılmak için giriş yapmalısınız', 'error');
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
      
      subscribeToJam(session.id, (payload) => {
        player.handleJamEvent(payload);
      });
      
      updateJamModalState();
      refreshJamParticipants(session.id);
      showToast('Jam\\'e katılıldı!', 'success');
      
    } catch (err) {
      console.error(err);
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
      console.error(e);
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

    list.innerHTML = participants.map(p => \`
      <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
        <img src="\${p.profiles?.avatar_url || '../assets/default_avatar.png'}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
        <span style="flex: 1; font-size: 14px;">\${p.profiles?.username || 'Kullanıcı'}</span>
        \${p.user_id === player.jamSessionId ? '<span style="font-size: 10px; background: var(--primary-color); color: black; padding: 2px 6px; border-radius: 10px;">Kurucu</span>' : ''}
      </div>
    \`).join('');
  } catch (err) {
    console.error('Participant refresh err:', err);
  }
}

// Ensure initJamUI is called when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initJamUI();
    renderHeroBanner();
    renderDailyMixes();
  }, 1000);
});
`;

if (!content.includes('initJamUI')) {
  fs.writeFileSync(path, content + jamLogic, 'utf8');
  console.log('Jam logic appended');
} else {
  console.log('Jam logic already present');
}
