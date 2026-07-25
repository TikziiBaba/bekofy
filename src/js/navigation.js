// ===== Navigation Module =====

var pageHistory = [];
var isNavigatingBack = false;

function initNavigation() {
  document.querySelectorAll('.nav-item, .top-nav-btn[data-page], .top-nav-home, [data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      const page = item.dataset.page;
      if (page) {
        e.preventDefault();
        navigateTo(page);
      }
    });
  });

  // History buttons
  const backBtn = document.getElementById('btn-history-back');
  const forwardBtn = document.getElementById('btn-history-forward');

  if (backBtn) {
    backBtn.addEventListener('click', () => goBack());
  }
}

function updateHistoryButtons() {
  const backBtn = document.getElementById('btn-history-back');
  if (backBtn) {
    backBtn.disabled = pageHistory.length === 0;
  }
}

function navigateTo(page, replaceHistory = false) {
  if (!page) return;

  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) {
    console.warn(`Sayfa bulunamadı: page-${page}`);
    return;
  }

  if (window.currentPage === page && pageEl.classList.contains('active')) return;

  if (!replaceHistory && !isNavigatingBack && window.currentPage) {
    pageHistory.push(window.currentPage);
  }
  isNavigatingBack = false;
  updateHistoryButtons();

  window.currentPage = page;

  document.querySelectorAll('.nav-item, .top-nav-btn').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(el => {
    if (el !== pageEl) {
      el.classList.remove('active', 'page-enter-left', 'page-enter-right', 'page-exit-left', 'page-exit-right');
    }
  });

  pageEl.classList.add('active');
  pageEl.style.animation = 'none';
  pageEl.offsetHeight; // reflow
  pageEl.style.animation = 'fadeIn 0.3s ease';

  // Scroll to top
  const main = document.querySelector('.main-content');
  if (main) main.scrollTop = 0;

  // Focus search input when navigating to search
  if (page === 'search') {
    setTimeout(() => {
      const input = document.getElementById('top-search-input');
      if (input) input.focus();
    }, 100);
  }

  // Load section-specific data when navigating
  if (page === 'library' && typeof loadLibraryPage === 'function') {
    loadLibraryPage();
  }
  if (page === 'new' && typeof loadNewContent === 'function') {
    loadNewContent();
  }
  if (page === 'admin') {
    if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'yetkili') {
      if (typeof showToast === 'function') showToast('Bu sayfaya erişim yetkiniz yok', 'error');
      navigateTo('home');
      return;
    }
    if (typeof loadAdminPage === 'function') loadAdminPage();
  }
  if (page === 'profile' && typeof loadProfilePage === 'function') {
    loadProfilePage();
  }
  if (page === 'artist-upload') {
    if (window.currentUserRole !== 'artist' && window.currentUserRole !== 'admin') {
      if (typeof showToast === 'function') showToast('Bu sayfa sadece sanatçılar için', 'error');
      navigateTo('home');
      return;
    }
    if (typeof loadArtistPage === 'function') loadArtistPage();
  }
}

function goBack() {
  if (pageHistory.length > 0) {
    const prevPage = pageHistory.pop();
    isNavigatingBack = true;
    navigateTo(prevPage);
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      goBack();
    }
  });
}

if (window.electronAPI && window.electronAPI.onAppGoBack) {
  window.electronAPI.onAppGoBack(() => {
    goBack();
  });
}

window.initNavigation = initNavigation;
window.navigateTo = navigateTo;
window.goBack = goBack;
window.pageHistory = pageHistory;
