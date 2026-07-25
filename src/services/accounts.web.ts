import Dexie, { type Table } from 'dexie';

/**
 * Multi-account roster (web).
 *
 * Mirrors src/services/accounts.ts exactly (same exported functions/signatures) so that
 * Metro's web/native module resolution can swap this file in transparently. This module
 * owns ONLY the tiny metadata needed to know which accounts exist and which one is active
 * - it never touches trading data. Each account's actual trades/strategies/symbols/etc.
 * live in their own Dexie/IndexedDB database (see src/db/webDatabase.ts), keyed by the
 * account id this module hands out.
 *
 * Storage: a dedicated tiny "TradeLogMeta" IndexedDB database (via Dexie), not
 * localStorage. This keeps the account roster working identically in a real browser and in
 * the Node-based web-db-smoke test, which already polyfills IndexedDB (fake-indexeddb) but
 * does not polyfill localStorage.
 *
 * DEFAULT_ACCOUNT_ID is special: it is the account every existing single-account install
 * already has, and it is intentionally mapped back onto the ORIGINAL unsuffixed Dexie
 * database name ("TradeLog") so upgrading users never lose or "misplace" their existing
 * data.
 */

export type Account = {
  id: string;
  name: string;
  createdAt: string;
};

export const DEFAULT_ACCOUNT_ID = 'default';

type MetaRecord = { key: string; value: string };

class TradeLogMetaDatabase extends Dexie {
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('TradeLogMeta');
    this.version(1).stores({ meta: '&key' });
  }
}

const metaDb = new TradeLogMetaDatabase();

async function readMeta(key: string): Promise<string | undefined> {
  const row = await metaDb.meta.get(key);
  return row?.value;
}

async function writeMeta(key: string, value: string) {
  await metaDb.meta.put({ key, value });
}

function defaultAccountName() {
  return 'حساب من';
}

async function readAccounts(): Promise<Account[]> {
  const raw = await readMeta('accounts');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: Account[]) {
  await writeMeta('accounts', JSON.stringify(accounts));
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
  const stored = await readMeta('activeAccountId');
  if (stored && accounts.some((account) => account.id === stored)) return stored;
  const fallback = accounts[0].id;
  await writeMeta('activeAccountId', fallback);
  return fallback;
}

export async function setActiveAccountId(id: string): Promise<void> {
  await writeMeta('activeAccountId', id);
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
 * chart data themselves (see deleteWebDatabaseForAccount in db/webDatabase.ts) before or
 * after calling this - this function only manages the small metadata list.
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

  const active = await readMeta('activeAccountId');
  if (active === id) {
    await writeMeta('activeAccountId', next[0].id);
  }
  return next;
}

export function isDefaultAccountId(id: string) {
  return id === DEFAULT_ACCOUNT_ID;
}

/** Small generic key/value store shared by all accounts (language, theme, display mode, ...). */
export async function getGlobalSetting(key: string): Promise<string | undefined> {
  return readMeta(`global:${key}`);
}

export async function setGlobalSetting(key: string, value: string): Promise<void> {
  await writeMeta(`global:${key}`, value);
}
