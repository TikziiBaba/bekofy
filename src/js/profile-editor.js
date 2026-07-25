class MediaEditor {
  constructor() {
    this.cropper = null;
    this.type = null;
    this.currentFile = null;
    this.objectUrl = null;
  }

  open(type) {
    this.type = type;
    const modal = document.getElementById('media-editor-modal');
    const title = document.getElementById('media-editor-title');
    const bannerControl = document.getElementById('banner-position-control');

    if (!modal) return;

    if (title) title.textContent = type === 'avatar' ? 'Avatar Düzenle' : 'Banner Düzenle';
    if (bannerControl) bannerControl.style.display = type === 'banner' ? 'flex' : 'none';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFile(e.target.files[0]);
      }
    };
    input.click();
  }

  handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      if (typeof showToast === 'function') showToast('Lütfen geçerli bir resim dosyası seçin', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (typeof showToast === 'function') showToast('Dosya 10MB\'dan küçük olmalı', 'error');
      return;
    }

    const modal = document.getElementById('media-editor-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    this.currentFile = file;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.initCropper(this.objectUrl);
  }

  initCropper(src) {
    const img = document.getElementById('cropper-image');
    if (!img) return;

    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }

    img.src = src;
    img.onload = () => {
      if (typeof Cropper === 'undefined') {
        console.error('Cropper.js library is not loaded');
        return;
      }
      const aspectRatio = this.type === 'avatar' ? 1 : 16 / 9;
      this.cropper = new Cropper(img, {
        aspectRatio,
        viewMode: 1,
        autoCropArea: 0.9,
        responsive: true,
        ready: () => this.updatePreviews(),
        cropmove: () => this.updatePreviews(),
        cropend: () => this.updatePreviews(),
        zoom: () => this.updatePreviews()
      });

      const zoomSlider = document.getElementById('zoom-slider');
      if (zoomSlider) zoomSlider.value = 1;
      const zoomVal = document.getElementById('zoom-value');
      if (zoomVal) zoomVal.textContent = '100%';
    };
  }

  updatePreviews() {
    if (!this.cropper) return;
    const sizes = { large: 180, medium: 56, small: 32 };
    Object.entries(sizes).forEach(([key, size]) => {
      const wrapper = document.getElementById(`preview-${key}`);
      if (wrapper) {
        const canvas = this.cropper.getCroppedCanvas({ width: size, height: size, imageSmoothingQuality: 'high' });
        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
      }
    });
  }

  async save() {
    if (!this.cropper || !this.currentFile) return;

    const btn = document.getElementById('btn-media-save');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Yükleniyor...';
    }

    try {
      const canvas = this.cropper.getCroppedCanvas({
        width: this.type === 'avatar' ? 400 : 1200,
        imageSmoothingQuality: 'high'
      });

      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.9));
      const ext = 'webp';
      const path = `${this.type}s/${window.currentUserId}_${Date.now()}.${ext}`;

      const sb = getSupabase();
      const { error: uploadErr } = await sb.storage.from('media').upload(path, blob, {
        contentType: 'image/webp', upsert: false
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = sb.storage.from('media').getPublicUrl(path);
      const url = urlData.publicUrl;

      const updateData = { [`${this.type}_url`]: url };
      if (this.type === 'banner') {
        const slider = document.getElementById('banner-position-slider');
        const pos = slider ? parseInt(slider.value) : 50;
        updateData.banner_position = pos;
      }

      const { error: updateErr } = await sb.from('profiles').update(updateData).eq('id', window.currentUserId);
      if (updateErr) throw updateErr;

      if (this.type === 'avatar') {
        const pAvatar = document.getElementById('profile-avatar-large');
        if (pAvatar) pAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
        
        const settingsAvatar = document.getElementById('settings-avatar-preview');
        if (settingsAvatar) settingsAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;

        const topAvatar = document.getElementById('top-user-avatar');
        if (topAvatar) topAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;

        const uAvatar = document.getElementById('user-avatar');
        if (uAvatar) uAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;

        const dAvatar = document.getElementById('discord-popup-avatar');
        if (dAvatar) dAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        const bImg = document.getElementById('own-profile-banner-img');
        if (bImg) {
          bImg.src = url;
          bImg.style.display = 'block';
        }
        const settingsBanner = document.getElementById('settings-banner-bg');
        if (settingsBanner) {
          settingsBanner.src = url;
          settingsBanner.style.display = 'block';
        }
        const dBanner = document.getElementById('discord-popup-banner');
        if (dBanner) {
          dBanner.style.backgroundImage = `url(${url})`;
          dBanner.style.backgroundPosition = `center ${updateData.banner_position}%`;
        }
      }

      if (typeof showToast === 'function') {
        showToast(`${this.type === 'avatar' ? 'Avatar' : 'Banner'} güncellendi!`, 'success');
      }
      this.close();
    } catch (err) {
      console.error(err);
      if (typeof showToast === 'function') showToast('Yükleme başarısız', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Kaydet';
      }
    }
  }

  close() {
    const modal = document.getElementById('media-editor-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
    const img = document.getElementById('cropper-image');
    if (img) img.src = '';
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.currentFile = null;
  }
}

window.mediaEditor = new MediaEditor();

function initMediaEditor() {
  const editor = window.mediaEditor;

  document.getElementById('btn-edit-avatar')?.addEventListener('click', () => editor.open('avatar'));
  document.getElementById('btn-edit-banner')?.addEventListener('click', () => editor.open('banner'));
  document.getElementById('btn-change-avatar')?.addEventListener('click', () => editor.open('avatar'));
  document.getElementById('btn-change-banner')?.addEventListener('click', () => editor.open('banner'));
  
  document.getElementById('btn-media-save')?.addEventListener('click', () => editor.save());
  document.getElementById('btn-media-cancel')?.addEventListener('click', () => editor.close());
  document.getElementById('btn-media-cancel-footer')?.addEventListener('click', () => editor.close());

  document.getElementById('zoom-slider')?.addEventListener('input', (e) => {
    if (!editor.cropper) return;
    const val = parseFloat(e.target.value);
    editor.cropper.zoomTo(val);
    const zoomVal = document.getElementById('zoom-value');
    if (zoomVal) zoomVal.textContent = Math.round(val * 100) + '%';
  });

  document.getElementById('btn-rotate-left')?.addEventListener('click', () => editor.cropper?.rotate(-90));
  document.getElementById('btn-rotate-right')?.addEventListener('click', () => editor.cropper?.rotate(90));

  document.getElementById('banner-position-slider')?.addEventListener('input', (e) => {
    const posVal = document.getElementById('banner-position-value');
    if (posVal) posVal.textContent = e.target.value + '%';
  });

  document.getElementById('media-editor-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'media-editor-modal') editor.close();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMediaEditor);
} else {
  initMediaEditor();
}

window.initMediaEditor = initMediaEditor;
