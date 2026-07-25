import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Multi-account roster (native/Android).
 *
 * This module owns ONLY the tiny metadata needed to know which accounts exist and which
 * one is active. It never touches trading data. Each account's actual trades/strategies/
 * symbols/etc. live in their own SQLite database file (see src/db/database.ts), and chart
 * images live in their own directory (see src/services/images.ts) - both keyed by the
 * account id this module hands out.
 *
 * DEFAULT_ACCOUNT_ID is special: it is the account every existing single-account install
 * already has, and it is intentionally mapped back onto the ORIGINAL unsuffixed database
 * name/file so upgrading users never lose or "misplace" their existing data.
 */

export type Account = {
  id: string;
  name: string;
  createdAt: string;
};

export const DEFAULT_ACCOUNT_ID = 'default';

const ACCOUNTS_KEY = 'tradelog:accounts:v1';
const ACTIVE_ACCOUNT_KEY = 'tradelog:activeAccount:v1';
const GLOBAL_PREFIX = 'tradelog:global:';

function defaultAccountName() {
  return 'حساب من';
}

async function readAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: Account[]) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function ensureAtLeastOneAccount(): Promise<Account[]> {
  const accounts = await readAccounts();
  if (accounts.length > 0) return accounts;
  const initial: Account[] = [{ id: DEFAULT_ACCOUNT_ID, name: defaultAccountName(), createdAt: new Date().toISOString() }];
  await writeAccounts(initial);
  return initial;
}

function generateAccountId() {
  return `acc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAccounts(): Promise<Account[]> {
  return ensureAtLeastOneAccount();
}

export async function getActiveAccountId(): Promise<string> {
  const accounts = await ensureAtLeastOneAccount();
  const stored = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (stored && accounts.some((account) => account.id === stored)) return stored;
  const fallback = accounts[0].id;
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, fallback);
  return fallback;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
}

export async function createAccount(name: string): Promise<Account> {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('ACCOUNT_NAME_REQUIRED');
  const accounts = await ensureAtLeastOneAccount();
  const account: Account = { id: generateAccountId(), name: trimmed, createdAt: new Date().toISOString() };
  await writeAccounts([...accounts, account]);
  return account;
}

export async function renameAccount(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('ACCOUNT_NAME_REQUIRED');
  const accounts = await ensureAtLeastOneAccount();
  await writeAccounts(accounts.map((account) => (account.id === id ? { ...account, name: trimmed } : account)));
}

/**
 * Removes the account from the roster only. Callers MUST wipe that account's database and
 * chart images themselves (see deleteAccountDatabase in db/database.ts) before or after
 * calling this - this function only manages the small metadata list.
 *
 * Returns the resulting roster and guarantees at least one account remains.
 */
export async function removeAccountFromRoster(id: string): Promise<Account[]> {
  const accounts = await ensureAtLeastOneAccount();
  const remaining = accounts.filter((account) => account.id !== id);
  const next = remaining.length > 0
    ? remaining
    : [{ id: generateAccountId(), name: defaultAccountName(), createdAt: new Date().toISOString() }];
  await writeAccounts(next);

  const active = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (active === id) {
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, next[0].id);
  }
  return next;
}

export function isDefaultAccountId(id: string) {
  return id === DEFAULT_ACCOUNT_ID;
}

/** Small generic key/value store shared by all accounts (language, theme, display mode, ...). */
export async function getGlobalSetting(key: string): Promise<string | undefined> {
  const value = await AsyncStorage.getItem(`${GLOBAL_PREFIX}${key}`);
  return value ?? undefined;
}

export async function setGlobalSetting(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(`${GLOBAL_PREFIX}${key}`, value);
}
