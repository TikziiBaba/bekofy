// ===== Premium Module =====

window.initPremiumPage = function() {
  console.log('[DEBUG] initPremiumPage called');
  document.querySelectorAll('#btn-top-premium, .premium-page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof navigateTo === 'function') navigateTo('premium');
    });
  });

  document.querySelectorAll('#btn-premium-upgrade, .premium-cta-btn, .premium-join-btn, .premium-hero-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handlePremiumJoin();
    });
  });

  const premiumApplyBtn = document.getElementById('premium-apply-artist-btn');
  if (premiumApplyBtn) {
    premiumApplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlePremiumApplyArtist();
    });
  }
};

async function handlePremiumJoin() {
  const userId = window.currentUserId || (typeof currentUserId !== 'undefined' ? currentUserId : null);
  if (!userId) {
    if (typeof showToast === 'function') showToast('Lütfen giriş yapın', 'error');
    return;
  }
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('premium_requests').insert({
      user_id: userId,
      status: 'pending'
    });
    if (error) throw error;
    if (typeof showToast === 'function') showToast('Premium başvuru gönderildi! 🎉', 'success');
  } catch (err) {
    console.error('Premium request error:', err);
    if (typeof showToast === 'function') showToast('Başvuru gönderilemedi (zaten başvurunuz bulunabilir)', 'error');
  }
}

async function handlePremiumApplyArtist() {
  const userId = window.currentUserId || (typeof currentUserId !== 'undefined' ? currentUserId : null);
  if (!userId) {
    if (typeof showToast === 'function') showToast('Lütfen giriş yapın', 'error');
    return;
  }
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('artist_requests').insert({
      user_id: userId,
      username: window.currentUserProfile?.username || '',
      status: 'pending'
    });
    if (error) throw error;
    if (typeof showToast === 'function') showToast('Sanatçı başvurunuz gönderildi! 🎤', 'success');
  } catch (err) {
    console.error('Artist request error:', err);
    if (typeof showToast === 'function') showToast('Başvuru gönderilemedi', 'error');
  }
}

