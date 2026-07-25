global.window = global;
global.document = {
  createElement: () => {
    const el = {};
    Object.defineProperty(el, 'textContent', {
      get() { return this._text || ''; },
      set(v) { this._text = String(v); },
    });
    Object.defineProperty(el, 'innerHTML', {
      get() {
        return (this._text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },
    });
    return el;
  },
  getElementById: () => null,
  querySelector: () => null,
};

require('../src/js/utils');

describe('escapeHtml', () => {
  test('returns empty string for falsy values', () => {
    expect(window.escapeHtml('')).toBe('');
    expect(window.escapeHtml(null)).toBe('');
    expect(window.escapeHtml(undefined)).toBe('');
  });

  test('escapes HTML tags', () => {
    expect(window.escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  test('escapes ampersand', () => {
    expect(window.escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('returns plain text unchanged', () => {
    expect(window.escapeHtml('Hello World')).toBe('Hello World');
  });

  test('escapes single quotes', () => {
    expect(window.escapeHtml("it's")).toBe('it&#039;s');
  });
});

describe('getInitials', () => {
  test('returns ? for empty/null input', () => {
    expect(window.getInitials('')).toBe('?');
    expect(window.getInitials(null)).toBe('?');
    expect(window.getInitials(undefined)).toBe('?');
  });

  test('returns first letter for single word', () => {
    expect(window.getInitials('Bekir')).toBe('B');
  });

  test('returns first two letters for two words', () => {
    expect(window.getInitials('Bekir Yilmaz')).toBe('BY');
  });

  test('limits to 2 characters for multiple words', () => {
    expect(window.getInitials('Ali Veli Kaya')).toBe('AV');
  });

  test('handles single character words', () => {
    expect(window.getInitials('A B')).toBe('AB');
  });
});

describe('formatDuration', () => {
  test('returns dash for falsy values', () => {
    expect(window.formatDuration(0)).toBe('\u2014');
    expect(window.formatDuration(null)).toBe('\u2014');
    expect(window.formatDuration(undefined)).toBe('\u2014');
  });

  test('formats seconds correctly', () => {
    expect(window.formatDuration(65)).toBe('1:05');
    expect(window.formatDuration(120)).toBe('2:00');
    expect(window.formatDuration(3661)).toBe('61:01');
  });

  test('pads single digit seconds', () => {
    expect(window.formatDuration(61)).toBe('1:01');
    expect(window.formatDuration(300)).toBe('5:00');
  });
});
