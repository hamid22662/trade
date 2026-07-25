import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { DEFAULT_CHECKLIST, DEFAULT_STRATEGIES, DEFAULT_SYMBOLS } from '@/constants/defaults';
import { calculateClosedTrade } from '@/services/calculations';
import { purgePersistedChartImages, purgePersistedChartImagesForAccount } from '@/services/images';
import { DEFAULT_ACCOUNT_ID, getActiveAccountId } from '@/services/accounts';
import { Trade } from '@/types';

const DATABASE_VERSION = 1;

// The default account keeps the ORIGINAL, unsuffixed database file name so that upgrading
// single-account installs keep reading/writing the exact same data they already have.
function databaseNameForAccount(accountId: string) {
  return accountId === DEFAULT_ACCOUNT_ID ? 'tradelog.db' : `tradelog-${accountId}.db`;
}

// One cached connection promise per account id - SQLite has no problem holding several
// different database files open at once, and caching avoids re-opening on every call.
const dbPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();

const schema = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market TEXT NOT NULL CHECK (market IN ('forex', 'crypto')),
  symbol TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  is_custom INTEGER NOT NULL DEFAULT 0,
  pip_size REAL NOT NULL,
  contract_size REAL NOT NULL,
  quote_currency TEXT
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label_fa TEXT NOT NULL,
  label_en TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  market TEXT NOT NULL CHECK (market IN ('forex', 'crypto')),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  entry_price REAL NOT NULL,
  exit_price REAL,
  stop_loss REAL,
  take_profit REAL,
  lot_size REAL,
  quantity REAL,
  risk_percent REAL,
  account_balance REAL,
  risk_amount REAL,
  pip_size REAL NOT NULL,
  contract_size REAL NOT NULL,
  pip_value_at_entry REAL,
  commission REAL NOT NULL DEFAULT 0,
  swap_fee REAL NOT NULL DEFAULT 0,
  funding_fee REAL NOT NULL DEFAULT 0,
  pnl_gross REAL,
  pnl_net REAL,
  pnl_pips REAL,
  rr_ratio REAL,
  open_time TEXT NOT NULL,
  close_time TEXT,
  strategy TEXT,
  emotion_entry TEXT,
  emotion_exit TEXT,
  setup_notes TEXT,
  exit_notes TEXT,
  lesson_learned TEXT,
  checklist TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON trades(open_time);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

CREATE TABLE IF NOT EXISTS trade_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL,
  image_type TEXT NOT NULL CHECK (image_type IN ('entry', 'exit', 'analysis')),
  image_uri TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  mood TEXT,
  market_bias TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

async function initializeDatabase(name: string) {
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(schema);
      await ensureSchemaMigrations(transaction);
      await seed(transaction);
      await repairClosedTrades(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

/** Always resolves against whichever account is currently active - callers never need to know the account id. */
export async function getDb() {
  const accountId = await getActiveAccountId();
  let promise = dbPromises.get(accountId);
  if (!promise) {
    promise = initializeDatabase(databaseNameForAccount(accountId)).catch((error) => {
      dbPromises.delete(accountId);
      throw error;
    });
    dbPromises.set(accountId, promise);
  }
  return promise;
}

/**
 * Fully wipes one account's SQLite database file (and its WAL/SHM sidecars) plus its chart
 * image directory. Used when the user deletes an account. Other accounts are untouched.
 */
export async function deleteAccountDatabase(accountId: string) {
  const cached = dbPromises.get(accountId);
  if (cached) {
    const db = await cached.catch(() => null);
    await db?.closeAsync().catch(() => undefined);
    dbPromises.delete(accountId);
  }

  if (FileSystem.documentDirectory) {
    const base = `${FileSystem.documentDirectory}SQLite/${databaseNameForAccount(accountId)}`;
    await Promise.all([
      FileSystem.deleteAsync(base, { idempotent: true }),
      FileSystem.deleteAsync(`${base}-wal`, { idempotent: true }),
      FileSystem.deleteAsync(`${base}-shm`, { idempotent: true }),
    ]);
  }

  await purgePersistedChartImagesForAccount(accountId);
}

async function ensureSchemaMigrations(db: SQLite.SQLiteDatabase) {
  const symbolColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(symbols)');
  const hasSymbolColumn = (name: string) => symbolColumns.some((column) => column.name === name);

  // The app can safely upgrade databases created before symbol contract metadata existed.
  if (!hasSymbolColumn('pip_size')) await db.execAsync('ALTER TABLE symbols ADD COLUMN pip_size REAL NOT NULL DEFAULT 0.0001');
  if (!hasSymbolColumn('contract_size')) await db.execAsync('ALTER TABLE symbols ADD COLUMN contract_size REAL NOT NULL DEFAULT 1');
  if (!hasSymbolColumn('quote_currency')) await db.execAsync('ALTER TABLE symbols ADD COLUMN quote_currency TEXT');
  if (!hasSymbolColumn('is_custom')) await db.execAsync('ALTER TABLE symbols ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0');

  const tradeColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(trades)');
  const hasTradeColumn = (name: string) => tradeColumns.some((column) => column.name === name);
  const tradeMigrations: Array<[string, string]> = [
    ['risk_amount', 'ALTER TABLE trades ADD COLUMN risk_amount REAL'],
    ['pip_size', 'ALTER TABLE trades ADD COLUMN pip_size REAL NOT NULL DEFAULT 0.0001'],
    ['contract_size', 'ALTER TABLE trades ADD COLUMN contract_size REAL NOT NULL DEFAULT 1'],
    ['pip_value_at_entry', 'ALTER TABLE trades ADD COLUMN pip_value_at_entry REAL'],
    ['commission', 'ALTER TABLE trades ADD COLUMN commission REAL NOT NULL DEFAULT 0'],
    ['swap_fee', 'ALTER TABLE trades ADD COLUMN swap_fee REAL NOT NULL DEFAULT 0'],
    ['funding_fee', 'ALTER TABLE trades ADD COLUMN funding_fee REAL NOT NULL DEFAULT 0'],
    ['pnl_gross', 'ALTER TABLE trades ADD COLUMN pnl_gross REAL'],
    ['pnl_net', 'ALTER TABLE trades ADD COLUMN pnl_net REAL'],
    ['pnl_pips', 'ALTER TABLE trades ADD COLUMN pnl_pips REAL'],
    ['rr_ratio', 'ALTER TABLE trades ADD COLUMN rr_ratio REAL'],
    ['emotion_exit', 'ALTER TABLE trades ADD COLUMN emotion_exit TEXT'],
    ['exit_notes', 'ALTER TABLE trades ADD COLUMN exit_notes TEXT'],
    ['lesson_learned', 'ALTER TABLE trades ADD COLUMN lesson_learned TEXT'],
    ['checklist', "ALTER TABLE trades ADD COLUMN checklist TEXT NOT NULL DEFAULT '{}'"],
  ];
  for (const [column, sql] of tradeMigrations) {
    if (!hasTradeColumn(column)) await db.execAsync(sql);
  }

  await db.execAsync(`CREATE TABLE IF NOT EXISTS trade_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    image_type TEXT NOT NULL CHECK (image_type IN ('entry', 'exit', 'analysis')),
    image_uri TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
  );`);

  // Existing, non-default symbols are treated as custom so that they can be deleted later.
  const defaultNames = DEFAULT_SYMBOLS.map((item) => item.symbol);
  if (defaultNames.length) {
    const placeholders = defaultNames.map(() => '?').join(', ');
    await db.runAsync(`UPDATE symbols SET is_custom = 0 WHERE symbol IN (${placeholders})`, ...defaultNames);
    await db.runAsync(`UPDATE symbols SET is_custom = 1 WHERE symbol NOT IN (${placeholders})`, ...defaultNames);
  }
}

async function repairClosedTrades(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<Trade>("SELECT * FROM trades WHERE status = 'CLOSED' AND exit_price IS NOT NULL");
  for (const trade of rows) {
    const calc = calculateClosedTrade({ ...trade, exit_price: Number(trade.exit_price) });
    await db.runAsync(
      'UPDATE trades SET pnl_gross = ?, pnl_net = ?, pnl_pips = ? WHERE id = ?',
      calc.grossPnl, calc.netPnl, calc.pips, trade.id,
    );
  }
}

async function seed(db: SQLite.SQLiteDatabase) {
  const baseSettings: Record<string, string> = {
    language: 'fa',
    theme: 'dark',
    default_currency: 'USD',
    account_balance: '0',
    default_risk_percent: '1',
    default_market: 'forex',
    onboarding_complete: '0',
    experience_mode: 'simple',
  };
  for (const [key, value] of Object.entries(baseSettings)) {
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, value);
  }

  // Old manual pip settings are no longer read by the app. Keep the database key untouched
  // for backwards compatibility, but do not seed or use it for any new calculation.
  for (const strategy of DEFAULT_STRATEGIES) {
    await db.runAsync('INSERT OR IGNORE INTO strategies (name) VALUES (?)', strategy);
  }

  for (const symbol of DEFAULT_SYMBOLS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO symbols (market, symbol, active, is_custom, pip_size, contract_size, quote_currency)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      symbol.market,
      symbol.symbol,
      symbol.active,
      symbol.pip_size,
      symbol.contract_size,
      symbol.quote_currency,
    );
  }

  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM checklist_items');
  if (!row?.count) {
    for (const item of DEFAULT_CHECKLIST) {
      await db.runAsync(
        'INSERT INTO checklist_items (label_fa, label_en, active, position) VALUES (?, ?, ?, ?)',
        item.label_fa,
        item.label_en,
        item.active,
        item.position,
      );
    }
  }
}

export async function resetDatabase() {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM trade_images;
      DELETE FROM trades;
      DELETE FROM daily_notes;
      DELETE FROM strategies;
      DELETE FROM symbols;
      DELETE FROM checklist_items;
      DELETE FROM settings;
    `);
    await seed(transaction);
  });
  await purgePersistedChartImages();
}
