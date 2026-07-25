// Modern functional profile settings modal script
(function () {
  const overlay = () => document.getElementById('profile-settings-overlay');
  const field = (name) => document.getElementById(`settings-${name}`);
  let selectedFrame = 'none';

  function showToastSafe(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  function switchModalTab(targetTab) {
    const btnPreview = document.getElementById('tab-btn-preview');
    const btnEdit = document.getElementById('tab-btn-edit');
    const viewPreview = document.getElementById('ps-view-preview');
    const formEdit = document.getElementById('profile-settings-form');

    if (targetTab === 'preview') {
      btnPreview?.classList.add('active');
      btnEdit?.classList.remove('active');
      if (viewPreview) viewPreview.style.display = 'block';
      if (formEdit) formEdit.style.display = 'none';
    } else {
      btnEdit?.classList.add('active');
      btnPreview?.classList.remove('active');
      if (viewPreview) viewPreview.style.display = 'none';
      if (formEdit) formEdit.style.display = 'block';
      setTimeout(() => field('username')?.focus(), 50);
    }
  }

  async function openSettings() {
    const modal = overlay();
    if (!modal) return;

    if (!window.currentUserId || typeof window.getSupabase !== 'function') {
      showToastSafe('Profil bilgileri yükleniyor, lütfen bekleyin...', 'error');
      return;
    }

    try {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('username, bio, city, website, avatar_frame, social_links, avatar_url, banner_url')
        .eq('id', window.currentUserId)
        .single();

      if (error) throw error;

      // Populate input fields for edit tab
      if (field('username')) field('username').value = data?.username || '';
      if (field('bio')) field('bio').value = data?.bio || '';
      if (field('city')) field('city').value = data?.city || '';
      if (field('website')) field('website').value = data?.website || '';

      updateCount();

      selectedFrame = data?.avatar_frame || 'none';
      updateFrameUI(selectedFrame);

      // Populate LIVE PREVIEW TAB
      const previewUsername = document.getElementById('ps-preview-username-display');
      if (previewUsername) previewUsername.textContent = data?.username || 'Kullanıcı';

      const previewCity = document.getElementById('ps-preview-city-display');
      if (previewCity) previewCity.textContent = data?.city ? `📍 ${data.city}` : '📍 Belirtilmedi';

      const previewBio = document.getElementById('ps-preview-bio-display');
      if (previewBio) previewBio.textContent = data?.bio || 'Henüz bir biyografi eklenmedi.';

      const previewAvatarImg = document.getElementById('ps-preview-avatar-img');
      if (previewAvatarImg) {
        if (data?.avatar_url) {
          previewAvatarImg.innerHTML = `<img src="${data.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
          previewAvatarImg.innerHTML = `<span style="font-size:24px;font-weight:700;color:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${(data?.username || 'U')[0].toUpperCase()}</span>`;
        }
      }

      const previewAvatarWrapper = document.getElementById('ps-preview-avatar-wrapper');
      if (previewAvatarWrapper) {
        const frame = data?.avatar_frame || 'none';
        previewAvatarWrapper.className = 'ps-live-avatar-wrapper' + (frame !== 'none' ? ` frame-${frame}` : '');
      }

      const previewBannerImg = document.getElementById('ps-preview-banner-img');
      if (previewBannerImg) {
        if (data?.banner_url) {
          previewBannerImg.src = data.banner_url;
          previewBannerImg.style.display = 'block';
        } else {
          previewBannerImg.style.display = 'none';
        }
      }

      // Render live social pills
      const socialsContainer = document.getElementById('ps-preview-socials-container');
      if (socialsContainer) {
        const socials = data?.social_links || {};
        const icons = { spotify: '🎵', instagram: '📸', twitter: '𝕏', youtube: '▶️', github: '💻', discord: '💬' };
        const pillsHtml = Object.entries(socials)
          .filter(([_, val]) => val)
          .map(([platform, val]) => `<a href="${val}" target="_blank" class="ps-social-pill">${icons[platform] || '🔗'} ${platform}</a>`)
          .join('');
        socialsContainer.innerHTML = pillsHtml || '<span style="font-size:12px;color:rgba(255,255,255,0.4)">Sosyal medya bağlantısı yok</span>';
      }

      // Populate social form inputs
      const socials = data?.social_links || {};
      ['spotify', 'instagram', 'twitter', 'youtube', 'github', 'discord'].forEach(platform => {
        const input = document.getElementById(`social-input-${platform}`);
        if (input) input.value = socials[platform] || '';
      });

      // Default to Preview Tab on open
      switchModalTab('preview');

      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    } catch (error) {
      console.error('Profile settings load error:', error);
      showToastSafe('Profil bilgileri yüklenemedi.', 'error');
    }
  }

  function closeSettings() {
    const modal = overlay();
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function updateCount() {
    const bioField = field('bio');
    const countEl = document.getElementById('settings-bio-count');
    if (bioField && countEl) {
      countEl.textContent = bioField.value.length;
    }
  }

  function updateFrameUI(frameName) {
    document.querySelectorAll('.frame-select-card').forEach(card => {
      if (card.dataset.frame === frameName) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  async function saveSettings(event) {
    if (event) event.preventDefault();

    const username = field('username')?.value.trim();
    const bio = field('bio')?.value.trim();
    const city = field('city')?.value.trim();
    const website = field('website')?.value.trim();

    if (!username) {
      return showToastSafe('Kullanıcı adı boş bırakılamaz.', 'error');
    }

    const social_links = {};
    ['spotify', 'instagram', 'twitter', 'youtube', 'github', 'discord'].forEach(platform => {
      const val = document.getElementById(`social-input-${platform}`)?.value.trim();
      if (val) social_links[platform] = val;
    });

    const saveButton = document.getElementById('btn-save-profile-settings');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML = '<span>Kaydediliyor...</span>';
    }

    try {
      const updateData = {
        username,
        bio,
        city,
        website,
        avatar_frame: selectedFrame,
        social_links
      };

      const { error } = await getSupabase()
        .from('profiles')
        .update(updateData)
        .eq('id', window.currentUserId);

      if (error) throw error;

      // Update DOM elements on Profile Page
      const titleEl = document.getElementById('own-profile-title');
      if (titleEl) titleEl.textContent = username;

      const bioEl = document.getElementById('profile-bio-display');
      if (bioEl) bioEl.textContent = bio || 'Henüz bir biyografi eklenmedi.';

      const locEl = document.querySelector('#profile-location span');
      if (locEl) locEl.textContent = city || 'Belirtilmedi';

      const avatarWrapper = document.getElementById('own-avatar-wrapper');
      if (avatarWrapper) {
        avatarWrapper.className = 'profile-avatar-wrapper' + (selectedFrame !== 'none' ? ` frame-${selectedFrame}` : '');
      }

      window.currentUserAvatarFrame = selectedFrame;

      if (typeof window.renderSocialLinks === 'function') {
        window.renderSocialLinks(social_links, 'profile-social-links');
      }

      if (typeof window.loadUserInfo === 'function') {
        window.loadUserInfo();
      }

      if (typeof window.loadProfilePage === 'function') {
        window.loadProfilePage();
      }

      closeSettings();
      showToastSafe('Profil başarıyla güncellendi.', 'success');
    } catch (error) {
      console.error('Profile settings save error:', error);
      showToastSafe('Profil kaydedilemedi.', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = '<span>Değişiklikleri Kaydet</span>';
      }
    }
  }

  function initFrameSelector() {
    document.querySelectorAll('.frame-select-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedFrame = card.dataset.frame || 'none';
        updateFrameUI(selectedFrame);
      });
    });
  }

  function triggerMediaUpload(type) {
    if (window.mediaEditor && typeof window.mediaEditor.open === 'function') {
      window.mediaEditor.open(type);
    } else {
      console.error('MediaEditor not initialized');
    }
  }

  function initListeners() {
    document.getElementById('btn-close-profile-settings')?.addEventListener('click', closeSettings);
    document.getElementById('btn-cancel-profile-settings')?.addEventListener('click', closeSettings);
    document.getElementById('profile-settings-form')?.addEventListener('submit', saveSettings);
    
    field('bio')?.addEventListener('input', updateCount);

    // Tab buttons
    document.getElementById('tab-btn-preview')?.addEventListener('click', () => switchModalTab('preview'));
    document.getElementById('tab-btn-edit')?.addEventListener('click', () => switchModalTab('edit'));
    document.getElementById('btn-goto-edit-form')?.addEventListener('click', () => switchModalTab('edit'));

    // Media upload triggers inside modal
    document.getElementById('btn-trigger-avatar-upload')?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerMediaUpload('avatar');
    });
    document.getElementById('btn-trigger-banner-upload')?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerMediaUpload('banner');
    });
    
    overlay()?.addEventListener('click', (event) => {
      if (event.target === overlay()) closeSettings();
    });

    initFrameSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initListeners);
  } else {
    initListeners();
  }

  window.openProfileSettings = openSettings;
  window.closeProfileSettings = closeSettings;
}());
