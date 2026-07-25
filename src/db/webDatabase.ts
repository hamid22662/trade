import Dexie, { type Table } from 'dexie';

import { DEFAULT_CHECKLIST, DEFAULT_STRATEGIES, DEFAULT_SYMBOLS } from '@/constants/defaults';
import { calculateClosedTrade } from '@/services/calculations';
// Imported with the explicit .web suffix (not the bare '@/services/accounts' alias):
// this file only ever runs on the web platform, and the explicit path guarantees the
// Dexie-backed account store is used even when this module is loaded directly by Node
// (e.g. scripts/web-db-smoke.ts), which - unlike Metro - does not apply automatic
// .web.ts platform resolution to bare imports.
import { DEFAULT_ACCOUNT_ID, getActiveAccountId } from '@/services/accounts.web';
import {
  ChecklistItem,
  StrategyRow,
  SymbolRow,
  Trade,
  TradeImage,
} from '@/types';

export type SettingRecord = {
  key: string;
  value: string;
};

export type StrategyRecord = Omit<StrategyRow, 'id'> & {
  id?: number;
  created_at: string;
};

export type SymbolRecord = Omit<SymbolRow, 'id'> & {
  id?: number;
};

export type ChecklistRecord = Omit<ChecklistItem, 'id'> & {
  id?: number;
};

export type TradeRecord = Omit<Trade, 'id'> & {
  id?: number;
};

export type TradeImageRecord = Omit<TradeImage, 'id'> & {
  id?: number;
};

export type DailyNoteRecord = {
  id?: number;
  date: string;
  mood?: string | null;
  market_bias?: string | null;
  notes?: string | null;
  created_at: string;
};

export class TradeLogWebDatabase extends Dexie {
  settings!: Table<SettingRecord, string>;
  strategies!: Table<StrategyRecord, number>;
  symbols!: Table<SymbolRecord, number>;
  checklist_items!: Table<ChecklistRecord, number>;
  trades!: Table<TradeRecord, number>;
  trade_images!: Table<TradeImageRecord, number>;
  daily_notes!: Table<DailyNoteRecord, number>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      settings: '&key',
      strategies: '++id,&name',
      symbols: '++id,&symbol,market,active,is_custom,[market+active]',
      checklist_items: '++id,active,position',
      trades: '++id,status,open_time,symbol,market,direction,strategy,[status+open_time]',
      trade_images: '++id,trade_id,[trade_id+id]',
      daily_notes: '++id,&date',
    });
  }
}

const BASE_SETTINGS: Record<string, string> = {
  language: 'fa',
  theme: 'dark',
  default_currency: 'USD',
  account_balance: '0',
  default_risk_percent: '1',
  default_market: 'forex',
  onboarding_complete: '0',
  experience_mode: 'simple',
};

// The default account keeps the ORIGINAL, unsuffixed Dexie database name so that upgrading
// single-account installs keep reading/writing the exact same IndexedDB data they already have.
function databaseNameForAccount(accountId: string) {
  return accountId === DEFAULT_ACCOUNT_ID ? 'TradeLog' : `TradeLog-${accountId}`;
}

const instances = new Map<string, TradeLogWebDatabase>();
// One cached open-promise per account id - Dexie/IndexedDB has no problem holding several
// different databases open at once, and caching avoids re-opening/reseeding on every call.
const databasePromises = new Map<string, Promise<TradeLogWebDatabase>>();

function getInstance(accountId: string) {
  let instance = instances.get(accountId);
  if (!instance) {
    instance = new TradeLogWebDatabase(databaseNameForAccount(accountId));
    instances.set(accountId, instance);
  }
  return instance;
}

async function seedWebDatabase(db: TradeLogWebDatabase) {
  await db.transaction(
    'rw',
    [db.settings, db.strategies, db.symbols, db.checklist_items],
    async () => {
      for (const [key, value] of Object.entries(BASE_SETTINGS)) {
        if ((await db.settings.get(key)) === undefined) {
          await db.settings.add({ key, value });
        }
      }

      for (const name of DEFAULT_STRATEGIES) {
        if ((await db.strategies.where('name').equals(name).count()) === 0) {
          await db.strategies.add({
            name,
            description: null,
            created_at: new Date().toISOString(),
          });
        }
      }

      for (const symbol of DEFAULT_SYMBOLS) {
        const existing = await db.symbols.where('symbol').equals(symbol.symbol).first();
        if (existing?.id !== undefined) {
          if (existing.is_custom !== 0) {
            await db.symbols.update(existing.id, { is_custom: 0 });
          }
          continue;
        }

        await db.symbols.add({
          ...symbol,
          is_custom: 0,
        });
      }

      if ((await db.checklist_items.count()) === 0) {
        await db.checklist_items.bulkAdd(DEFAULT_CHECKLIST.map((item) => ({ ...item })));
      }
    },
  );
}

async function repairClosedTrades(db: TradeLogWebDatabase) {
  const closedTrades = await db.trades.where('status').equals('CLOSED').toArray();

  await db.transaction('rw', db.trades, async () => {
    for (const trade of closedTrades) {
      if (trade.id === undefined || trade.exit_price == null) continue;

      const calculation = calculateClosedTrade({
        ...trade,
        exit_price: Number(trade.exit_price),
      });

      await db.trades.update(trade.id, {
        pnl_gross: calculation.grossPnl,
        pnl_net: calculation.netPnl,
        pnl_pips: calculation.pips,
      });
    }
  });
}

async function initializeWebDatabase(accountId: string) {
  const database = getInstance(accountId);
  await database.open();
  await seedWebDatabase(database);
  await repairClosedTrades(database);
  return database;
}

/** Always resolves against whichever account is currently active - callers never need to know the account id. */
export async function getWebDatabase() {
  const accountId = await getActiveAccountId();
  let promise = databasePromises.get(accountId);
  if (!promise) {
    promise = initializeWebDatabase(accountId).catch((error) => {
      databasePromises.delete(accountId);
      throw error;
    });
    databasePromises.set(accountId, promise);
  }
  return promise;
}

export async function resetWebDatabase() {
  const db = await getWebDatabase();

  await db.transaction(
    'rw',
    [
      db.trade_images,
      db.trades,
      db.daily_notes,
      db.strategies,
      db.symbols,
      db.checklist_items,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.trade_images.clear(),
        db.trades.clear(),
        db.daily_notes.clear(),
        db.strategies.clear(),
        db.symbols.clear(),
        db.checklist_items.clear(),
        db.settings.clear(),
      ]);
    },
  );

  await seedWebDatabase(db);
}

/**
 * Closes only the current JavaScript connection(s) for every account that has been opened
 * so far. IndexedDB data remains intact, which also makes persistence across a browser
 * reload independently testable.
 */
export async function closeWebDatabase() {
  const entries = [...databasePromises.entries()];
  databasePromises.clear();

  for (const [accountId, promise] of entries) {
    try {
      const db = await promise;
      db.close();
    } catch {
      // Nothing to close if the connection never finished opening.
    } finally {
      instances.delete(accountId);
    }
  }
}

/**
 * Fully wipes one account's Dexie/IndexedDB database. Used when the user deletes an
 * account. Other accounts' databases are untouched.
 */
export async function deleteWebDatabaseForAccount(accountId: string) {
  const promise = databasePromises.get(accountId);
  if (promise) {
    const db = await promise.catch(() => null);
    db?.close();
    databasePromises.delete(accountId);
  }
  instances.delete(accountId);
  await Dexie.delete(databaseNameForAccount(accountId));
}
