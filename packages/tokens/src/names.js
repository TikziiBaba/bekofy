// Token yolu -> CSS değişken adı. "component." öneki düşer, camelCase kebab-case olur.
// color.glass.chrome.bg -> --color-glass-chrome-bg, component.nav.fgActive -> --nav-fg-active

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function cssVarName(path) {
  return '--' + path.replace(/^component\./, '').split('.').map(kebab).join('-');
}
