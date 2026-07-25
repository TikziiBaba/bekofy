// Home polish: keeps the existing navigation behavior while adding directional motion.
(function () {
  const originalNavigate = window.navigateTo;

  function setToday() {
    const target = document.querySelector('.home-date strong');
    if (!target) return;
    target.textContent = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long'
    }).format(new Date());
  }

  window.navigateTo = function (page, replaceHistory) {
    const previousPage = window.currentPage;
    if (previousPage === page || typeof originalNavigate !== 'function') return;

    originalNavigate(page, replaceHistory);

    const pageEl = document.getElementById(`page-${page}`);
    if (!pageEl) return;
    pageEl.dataset.direction = previousPage === 'home' ? 'forward' : 'neutral';
    pageEl.style.animation = 'none';
    void pageEl.offsetWidth;
    pageEl.style.animation = 'pageEnter .46s cubic-bezier(.16, 1, .3, 1) both';
  };

  document.addEventListener('DOMContentLoaded', setToday);
}());
