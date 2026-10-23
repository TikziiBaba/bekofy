// Çoklu hesap: her hesabın oturumu ayrı anahtarda (bekofy-auth-<yuva>) tutulur; geçiş, oturumu yeniden açmadan olur.

import { accountStorageKey, createBekofyClient, type BekofyClient } from '@bekofy/core';

export interface StoredAccount {
  slot: string;
  userId: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
}

const LIST = 'bekofy-accounts';
const ACTIVE = 'bekofy-active-slot';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function storedAccounts(): StoredAccount[] {
  const list = read<StoredAccount[]>(LIST, []);
  return Array.isArray(list) ? list.filter((a) => a && typeof a.slot === 'string' && typeof a.userId === 'string') : [];
}

export function saveAccount(account: StoredAccount): void {
  const list = storedAccounts().filter((a) => a.slot !== account.slot && a.userId !== account.userId);
  localStorage.setItem(LIST, JSON.stringify([...list, account]));
}

export function forgetAccount(slot: string): void {
  localStorage.setItem(LIST, JSON.stringify(storedAccounts().filter((a) => a.slot !== slot)));
  localStorage.removeItem(accountStorageKey(slot));
  if (activeSlot() === slot) localStorage.removeItem(ACTIVE);
}

export function activeSlot(): string | null {
  try {
    return localStorage.getItem(ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveSlot(slot: string): void {
  localStorage.setItem(ACTIVE, slot);
}

export const newSlot = (): string => crypto.randomUUID().slice(0, 8);

const clients = new Map<string, BekofyClient>();
export function clientFor(slot: string): BekofyClient {
  let c = clients.get(slot);
  if (!c) {
    c = createBekofyClient({ storageKey: accountStorageKey(slot) });
    clients.set(slot, c);
  }
  return c;
}
