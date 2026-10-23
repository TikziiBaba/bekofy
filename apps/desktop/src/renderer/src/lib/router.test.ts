import { describe, expect, it } from 'vitest';
import { isUuid } from '../../../shared/ipc';
import { href, parse, type Route } from './router';

describe('yönlendirme', () => {
  const routes: Route[] = [
    { name: 'home' },
    { name: 'search', q: 'Müslüm Gürses & Ferdi' },
    { name: 'library', filter: 'downloads' },
    { name: 'liked' },
    { name: 'playlist', id: '3f2a9c1e-77aa-4b1c-9e0d-1234567890ab' },
    { name: 'artist', id: 'abc' },
    { name: 'album', artist: 'Ayaz Kaya, Selin Aras', title: 'Ağustos / 2026' },
    { name: 'profile', id: 'u1' },
    { name: 'settings' },
    { name: 'jam' },
  ];
  it('adres ve rota birbirine dönüşür (Türkçe ve özel karakterler korunur)', () => {
    for (const r of routes) expect(parse(href(r))).toEqual(r);
  });
  it('bilinmeyen ya da eksik adres ana sayfaya düşer', () => {
    expect(parse('#/bilinmeyen')).toEqual({ name: 'home' });
    expect(parse('#/playlist')).toEqual({ name: 'home' });
    expect(parse('#/library/hepsi')).toEqual({ name: 'library', filter: 'all' });
    expect(parse('')).toEqual({ name: 'home' });
  });
});

describe('kimlik denetimi', () => {
  it('yalnızca uuid; yol gezinme denemeleri reddedilir', () => {
    expect(isUuid('3f2a9c1e-77aa-4b1c-9e0d-1234567890ab')).toBe(true);
    expect(isUuid('../../secret')).toBe(false);
    expect(isUuid('3f2a9c1e-77aa-4b1c-9e0d-1234567890ab/../x')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
