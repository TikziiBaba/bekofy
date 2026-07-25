// ===== Multi-Account Module =====

window.initMultiAccount = function() {
  document.getElementById('manage-accounts-btn')?.addEventListener('click', openAccountManager);
  document.getElementById('close-account-manager')?.addEventListener('click', () => document.getElementById('account-manager-modal').classList.remove('active'));
  document.getElementById('add-account-btn')?.addEventListener('click', addCurrentToAccounts);
};

async function openAccountManager() {
  const modal = document.getElementById('account-manager-modal');
  const container = document.getElementById('account-list');
  container.innerHTML = '<div class="loading-spinner"></div>';
  modal.classList.add('active');
  try {
    const accounts = JSON.parse(localStorage.getItem('bekofy_accounts') || '[]');
    if (accounts.length === 0) {
      container.innerHTML = '<p class="empty-state-text">Kayıtlı hesap yok</p>';
      return;
    }
    container.innerHTML = accounts.map(acc => `
      <div class="account-item ${acc.userId === window.currentUserId ? 'active' : ''}">
        <div class="account-info">
          <div class="account-name">${escapeHtml(acc.email)}</div>
          <div class="account-role">${escapeHtml(acc.role || 'Kullanıcı')}</div>
        </div>
        <div class="account-actions">
          ${acc.userId !== window.currentUserId
      ? `<button class="btn btn-small btn-primary switch-account-btn" data-email="${escapeHtml(acc.email)}">Geç</button>`
      : '<span class="badge-current">Şu An Aktif</span>'}
          <button class="btn btn-small btn-danger remove-account-btn" data-email="${escapeHtml(acc.email)}">Kaldır</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.switch-account-btn').forEach(btn => {
      btn.addEventListener('click', () => switchToAccount(btn.dataset.email));
    });
    container.querySelectorAll('.remove-account-btn').forEach(btn => {
      btn.addEventListener('click', () => removeAccount(btn.dataset.email));
    });
  } catch (err) {
    container.innerHTML = '<p class="empty-state-text">Hesaplar yüklenemedi</p>';
  }
}

function addCurrentToAccounts() {
  if (!window.currentUserId) return;
  let accounts = JSON.parse(localStorage.getItem('bekofy_accounts') || '[]');
  if (accounts.find(a => a.userId === window.currentUserId)) {
    showToast('Bu hesap zaten kayıtlı', 'success');
    return;
  }
  accounts.push({
    userId: window.currentUserId,
    email: window.currentUserProfile?.email || '',
    username: window.currentUserProfile?.username || '',
    role: window.currentUserRole
  });
  localStorage.setItem('bekofy_accounts', JSON.stringify(accounts));
  showToast('Hesap kaydedildi! ✅', 'success');
}

async function switchToAccount(email) {
  try {
    let accounts = JSON.parse(localStorage.getItem('bekofy_accounts') || '[]');
    const target = accounts.find(a => a.email === email);
    if (!target) return;
    showToast('Hesap değiştirme için lütfen çıkış yapın ve yeni hesapla giriş yapın', 'success');
  } catch (err) {
    showToast('Hesap değiştirilemedi', 'error');
  }
}

function removeAccount(email) {
  let accounts = JSON.parse(localStorage.getItem('bekofy_accounts') || '[]');
  accounts = accounts.filter(a => a.email !== email);
  localStorage.setItem('bekofy_accounts', JSON.stringify(accounts));
  showToast('Hesap kaldırıldı', 'success');
  openAccountManager();
}

// multi-account.js - Çoklu hesap yönetimi
