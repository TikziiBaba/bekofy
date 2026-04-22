import re
import sys

css_new = """
/* Sidebar Collapse Styles */
.sidebar { transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.sidebar.collapsed { width: 72px; }

/* Fix sidebar header */
.sidebar-header { justify-content: space-between; overflow: hidden; }
.brand { display: flex; align-items: center; gap: 10px; }
.btn-collapse-sidebar {
  background: transparent; border: none; color: var(--ts);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 6px; border-radius: 4px; transition: var(--t);
  flex-shrink: 0;
}
.btn-collapse-sidebar:hover { color: var(--tp); background: rgba(255, 255, 255, 0.1); }

/* Hide texts */
.sidebar.collapsed .logo-text,
.sidebar.collapsed .nav-item span,
.sidebar.collapsed .playlist-header span,
.sidebar.collapsed .btn-create-playlist,
.sidebar.collapsed .playlist-list p,
.sidebar.collapsed .playlist-list small,
.sidebar.collapsed .user-info { display: none !important; }

/* Normalization */
.sidebar.collapsed .brand { justify-content: center; width: 100%; margin: 0; padding: 0; }
.sidebar.collapsed .sidebar-header { padding: 16px 0; flex-direction: column; gap: 16px; justify-content: center; align-items: center; }
.sidebar.collapsed .btn-collapse-sidebar { margin: 0 auto; transform: rotate(180deg); }

.sidebar.collapsed .nav-item { justify-content: center; padding: 12px 0; }
.sidebar.collapsed .nav-item svg { margin: 0; }
.sidebar.collapsed .sidebar-nav { padding: 12px 0; }

.sidebar.collapsed .playlist-header { justify-content: center; padding: 12px 0; border:none; height: auto; }
.sidebar.collapsed .playlist-item { justify-content: center; padding: 12px 0; }
.sidebar.collapsed .playlist-item-info { display: none !important; }

.sidebar.collapsed .sidebar-divider { margin: auto !important; width: 36px; margin-top: 8px !important; margin-bottom: 8px !important; }

.sidebar.collapsed .sidebar-user { justify-content: center; padding: 16px 0; }
.sidebar.collapsed .user-avatar { margin: 0; width: 32px; height: 32px; }
"""

def patch_css(path):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    c = re.sub(r'/\* Sidebar Collapse Styles \*/.*', '', c, flags=re.DOTALL)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c + css_new)

if __name__ == '__main__':
    patch_css('c:/Users/dedyu/Desktop/bekir/src/css/app.css')
    patch_css('c:/Users/dedyu/Desktop/bekir/website/css/app.css')
