import { getDb } from './database.web';
import {
  ChecklistRecord,
  StrategyRecord,
  SymbolRecord,
  TradeImageRecord,
  TradeRecord,
} from './webDatabase';
import {
  ChecklistItem,
  CloseTradeInput,
  ImportedTradeInput,
  NewSymbolInput,
  NewTradeInput,
  StrategyRow,
  Summary,
  SymbolRow,
  Trade,
  TradeImage,
  TradeImportSummary,
} from '@/types';
import { calculateClosedTrade, calculateRr } from '@/services/calculations';
import { normalizeNewSymbolInput, symbolIdentityKey } from '@/services/symbols';

type ListTradeParams = {
  status?: 'OPEN' | 'CLOSED';
  query?: string;
  limit?: number;
  offset?: number;
  since?: string;
  dateRange?: 'week' | 'month' | 'all';
  market?: 'forex' | 'crypto' | 'all';
  direction?: 'BUY' | 'SELL' | 'all';
  result?: 'win' | 'loss' | 'all';
  strategy?: string;
  sort?: 'newest' | 'oldest' | 'pnl_desc' | 'pnl_asc' | 'rr_desc';
};

function recordId(record: { id?: number }) {
  if (record.id === undefined) throw new Error('LOCAL_RECORD_ID_MISSING');
  return Number(record.id);
}

function checklistJson(value: unknown) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? {});
}

function normalizeTrade(record: TradeRecord): Trade {
  return {
    ...record,
    id: recordId(record),
    entry_price: Number(record.entry_price),
    exit_price: record.exit_price == null ? null : Number(record.exit_price),
    stop_loss: record.stop_loss == null ? null : Number(record.stop_loss),
    take_profit: record.take_profit == null ? null : Number(record.take_profit),
    lot_size: record.lot_size == null ? null : Number(record.lot_size),
    quantity: record.quantity == null ? null : Number(record.quantity),
    risk_percent: record.risk_percent == null ? null : Number(record.risk_percent),
    account_balance: record.account_balance == null ? null : Number(record.account_balance),
    risk_amount: record.risk_amount == null ? null : Number(record.risk_amount),
    pip_size: Number(record.pip_size),
    contract_size: Number(record.contract_size),
    pip_value_at_entry: record.pip_value_at_entry == null ? null : Number(record.pip_value_at_entry),
    commission: Number(record.commission ?? 0),
    swap_fee: Number(record.swap_fee ?? 0),
    funding_fee: Number(record.funding_fee ?? 0),
    pnl_gross: record.pnl_gross == null ? null : Number(record.pnl_gross),
    pnl_net: record.pnl_net == null ? null : Number(record.pnl_net),
    pnl_pips: record.pnl_pips == null ? null : Number(record.pnl_pips),
    rr_ratio: record.rr_ratio == null ? null : Number(record.rr_ratio),
    checklist: checklistJson(record.checklist),
  };
}

function normalizeSymbol(record: SymbolRecord): SymbolRow {
  return {
    ...record,
    id: recordId(record),
    active: Number(record.active),
    is_custom: Number(record.is_custom),
    pip_size: Number(record.pip_size),
    contract_size: Number(record.contract_size),
  };
}

function normalizeStrategy(record: StrategyRecord): StrategyRow {
  return {
    id: recordId(record),
    name: record.name,
    description: record.description ?? null,
  };
}

function normalizeChecklist(record: ChecklistRecord): ChecklistItem {
  return {
    ...record,
    id: recordId(record),
  };
}

function normalizeTradeImage(record: TradeImageRecord): TradeImage {
  return {
    ...record,
    id: recordId(record),
  };
}

export async function getSettings() {
  const db = await getDb();
  const rows = await db.settings.toArray();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.settings.put({ key, value });
}

/** Active symbols only: this is the list that powers the New Trade dropdown. */
export async function getSymbols(market?: string) {
  const db = await getDb();
  const rows = await db.symbols.toArray();

  return rows
    .filter((row) => row.active === 1 && (!market || row.market === market))
    .map(normalizeSymbol)
    .sort((left, right) => (
      left.market.localeCompare(right.market) || left.symbol.localeCompare(right.symbol)
    ));
}

/** Includes inactive assets so Settings can manage every default and custom symbol. */
export async function getManagedSymbols() {
  const db = await getDb();
  const rows = await db.symbols.toArray();

  return rows
    .map(normalizeSymbol)
    .sort((left, right) => (
      left.market.localeCompare(right.market) || left.symbol.localeCompare(right.symbol)
    ));
}

export async function setSymbolActive(id: number, active: boolean) {
  const db = await getDb();
  const updated = await db.symbols.update(id, { active: active ? 1 : 0 });
  if (!updated) throw new Error('SYMBOL_UPDATE_FAILED');
}

export async function createSymbol(input: NewSymbolInput) {
  const normalized = normalizeNewSymbolInput(input);
  const db = await getDb();
  const existingSymbols = await db.symbols.toArray();

  if (existingSymbols.some((row) => (
    symbolIdentityKey(row.symbol) === symbolIdentityKey(normalized.symbol)
  ))) {
    throw new Error('SYMBOL_EXISTS');
  }

  return db.symbols.add({
    ...normalized,
    active: 1,
    is_custom: 1,
  });
}

/** Only user-added assets can be deleted. Default assets remain available for reactivation. */
export async function deleteCustomSymbol(id: number) {
  const db = await getDb();
  const symbol = await db.symbols.get(id);
  if (!symbol || symbol.is_custom !== 1) throw new Error('SYMBOL_DELETE_FORBIDDEN');
  await db.symbols.delete(id);
}

export async function getStrategies() {
  const db = await getDb();
  const rows = await db.strategies.toArray();
  return rows.map(normalizeStrategy).sort((left, right) => left.name.localeCompare(right.name));
}

/** Adds a strategy that becomes immediately selectable in the New Trade screen. */
export async function createStrategy(name: string, description?: string) {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value) throw new Error('Strategy name is required.');
  const db = await getDb();

  return db.strategies.add({
    name: value,
    description: description?.trim() || null,
    created_at: new Date().toISOString(),
  });
}

/** Removing a strategy does not change the strategy text already saved on historical trades. */
export async function deleteStrategy(id: number) {
  const db = await getDb();
  await db.strategies.delete(id);
}

export async function getChecklist() {
  const db = await getDb();
  const rows = await db.checklist_items.where('active').equals(1).toArray();
  return rows.map(normalizeChecklist).sort((left, right) => left.position - right.position);
}

export async function createTrade(input: NewTradeInput) {
  const db = await getDb();
  const rr = calculateRr(input.direction, input.entry_price, input.stop_loss, input.take_profit);

  return db.transaction('rw', [db.trades, db.trade_images], async () => {
    const tradeId = await db.trades.add({
      created_at: new Date().toISOString(),
      market: input.market,
      symbol: input.symbol,
      direction: input.direction,
      status: 'OPEN',
      entry_price: input.entry_price,
      exit_price: null,
      stop_loss: input.stop_loss ?? null,
      take_profit: input.take_profit ?? null,
      lot_size: input.lot_size ?? null,
      quantity: input.quantity ?? null,
      risk_percent: input.risk_percent,
      account_balance: input.account_balance,
      risk_amount: input.risk_amount,
      pip_size: input.pip_size,
      contract_size: input.contract_size,
      pip_value_at_entry: input.pip_value_at_entry ?? null,
      commission: 0,
      swap_fee: 0,
      funding_fee: 0,
      pnl_gross: null,
      pnl_net: null,
      pnl_pips: null,
      rr_ratio: rr,
      open_time: input.open_time,
      close_time: null,
      strategy: input.strategy ?? null,
      emotion_entry: input.emotion_entry ?? null,
      emotion_exit: null,
      setup_notes: input.setup_notes ?? null,
      exit_notes: null,
      lesson_learned: null,
      checklist: checklistJson(input.checklist),
    });

    for (const image of input.images ?? []) {
      await db.trade_images.add({
        trade_id: tradeId,
        image_type: image.type,
        image_uri: image.uri,
        created_at: new Date().toISOString(),
      });
    }

    return tradeId;
  });
}

function importFingerprint(
  trade: Pick<
    ImportedTradeInput,
    'symbol' | 'direction' | 'open_time' | 'entry_price' | 'lot_size' | 'quantity'
  >,
) {
  return [
    trade.symbol.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    trade.direction,
    new Date(trade.open_time).toISOString(),
    Number(trade.entry_price).toFixed(8),
    Number(trade.lot_size ?? trade.quantity ?? 0).toFixed(8),
  ].join('|');
}

export async function importTrades(inputs: ImportedTradeInput[]): Promise<TradeImportSummary> {
  const db = await getDb();
  if (!inputs.length) return { imported: 0, skipped: 0, symbolsCreated: 0 };

  return db.transaction('rw', [db.trades, db.symbols], async () => {
    const existingTrades = await db.trades.toArray();
    const fingerprints = new Set(existingTrades.map(importFingerprint));
    const accepted: ImportedTradeInput[] = [];
    let skipped = 0;

    for (const input of inputs) {
      const fingerprint = importFingerprint(input);
      if (fingerprints.has(fingerprint)) {
        skipped += 1;
        continue;
      }
      fingerprints.add(fingerprint);
      accepted.push(input);
    }

    const symbolRows = await db.symbols.toArray();
    const knownSymbols = new Set(symbolRows.map((row) => symbolIdentityKey(row.symbol)));
    let symbolsCreated = 0;

    for (const trade of accepted) {
      const key = symbolIdentityKey(trade.symbol);
      if (knownSymbols.has(key)) continue;

      await db.symbols.add({
        market: trade.market,
        symbol: trade.symbol,
        active: 1,
        is_custom: 1,
        pip_size: trade.pip_size,
        contract_size: trade.contract_size,
        quote_currency: key.endsWith('USDT') ? 'USDT' : key.slice(-3) || 'USD',
      });
      knownSymbols.add(key);
      symbolsCreated += 1;
    }

    for (const input of accepted) {
      await db.trades.add({
        created_at: new Date().toISOString(),
        market: input.market,
        symbol: input.symbol,
        direction: input.direction,
        status: input.status,
        entry_price: input.entry_price,
        exit_price: input.exit_price ?? null,
        stop_loss: input.stop_loss ?? null,
        take_profit: input.take_profit ?? null,
        lot_size: input.lot_size ?? null,
        quantity: input.quantity ?? null,
        risk_percent: input.risk_percent ?? null,
        account_balance: input.account_balance ?? null,
        risk_amount: input.risk_amount ?? null,
        pip_size: input.pip_size,
        contract_size: input.contract_size,
        pip_value_at_entry: input.pip_value_at_entry ?? null,
        commission: input.commission ?? 0,
        swap_fee: input.swap_fee ?? 0,
        funding_fee: input.funding_fee ?? 0,
        pnl_gross: input.pnl_gross ?? null,
        pnl_net: input.pnl_net ?? null,
        pnl_pips: input.pnl_pips ?? null,
        rr_ratio: input.rr_ratio ?? calculateRr(
          input.direction,
          input.entry_price,
          input.stop_loss,
          input.take_profit,
        ),
        open_time: input.open_time,
        close_time: input.close_time ?? null,
        strategy: input.strategy ?? null,
        emotion_entry: null,
        emotion_exit: null,
        setup_notes: input.setup_notes ?? null,
        exit_notes: null,
        lesson_learned: null,
        checklist: checklistJson(input.checklist),
      });
    }

    return {
      imported: accepted.length,
      skipped,
      symbolsCreated,
    };
  });
}

export async function getTrade(id: number) {
  const db = await getDb();
  const record = await db.trades.get(id);
  return record ? normalizeTrade(record) : undefined;
}

export async function getTradeImages(tradeId: number) {
  const db = await getDb();
  const rows = await db.trade_images.where('trade_id').equals(tradeId).toArray();
  return rows.map(normalizeTradeImage).sort((left, right) => left.id - right.id);
}

export async function closeTrade(trade: Trade, input: CloseTradeInput) {
  const db = await getDb();
  const calculation = calculateClosedTrade({ ...trade, ...input });

  await db.transaction('rw', [db.trades, db.trade_images], async () => {
    const updated = await db.trades.update(trade.id, {
      status: 'CLOSED',
      exit_price: input.exit_price,
      close_time: input.close_time,
      emotion_exit: input.emotion_exit ?? null,
      exit_notes: input.exit_notes ?? null,
      lesson_learned: input.lesson_learned ?? null,
      commission: input.commission ?? 0,
      swap_fee: input.swap_fee ?? 0,
      funding_fee: input.funding_fee ?? 0,
      pnl_gross: calculation.grossPnl,
      pnl_net: calculation.netPnl,
      pnl_pips: calculation.pips,
    });
    if (!updated) throw new Error('TRADE_NOT_FOUND');

    for (const image of input.images ?? []) {
      await db.trade_images.add({
        trade_id: trade.id,
        image_type: image.type,
        image_uri: image.uri,
        created_at: new Date().toISOString(),
      });
    }
  });
}

export type UpdateTradeInput = Partial<Pick<Trade,
  | 'market'
  | 'symbol'
  | 'direction'
  | 'entry_price'
  | 'exit_price'
  | 'stop_loss'
  | 'take_profit'
  | 'lot_size'
  | 'quantity'
  | 'risk_percent'
  | 'account_balance'
  | 'risk_amount'
  | 'pip_size'
  | 'contract_size'
  | 'pip_value_at_entry'
  | 'open_time'
  | 'close_time'
  | 'strategy'
  | 'emotion_entry'
  | 'emotion_exit'
  | 'setup_notes'
  | 'exit_notes'
  | 'lesson_learned'
  | 'checklist'
  | 'commission'
  | 'swap_fee'
  | 'funding_fee'
>>;

export async function updateTrade(id: number, input: UpdateTradeInput) {
  const db = await getDb();
  const current = await getTrade(id);
  if (!current) throw new Error('TRADE_NOT_FOUND');

  const merged: Trade = { ...current, ...input, id };
  const rr = calculateRr(
    merged.direction,
    Number(merged.entry_price),
    merged.stop_loss ?? null,
    merged.take_profit ?? null,
  );
  let grossPnl = merged.pnl_gross ?? null;
  let netPnl = merged.pnl_net ?? null;
  let pnlPips = merged.pnl_pips ?? null;

  if (merged.status === 'CLOSED' && merged.exit_price != null) {
    const calculation = calculateClosedTrade({
      ...merged,
      exit_price: Number(merged.exit_price),
    });
    grossPnl = calculation.grossPnl;
    netPnl = calculation.netPnl;
    pnlPips = calculation.pips;
  }

  await db.trades.put({
    ...merged,
    id,
    entry_price: Number(merged.entry_price),
    pip_size: Number(merged.pip_size),
    contract_size: Number(merged.contract_size),
    checklist: checklistJson(merged.checklist),
    commission: Number(merged.commission ?? 0),
    swap_fee: Number(merged.swap_fee ?? 0),
    funding_fee: Number(merged.funding_fee ?? 0),
    rr_ratio: rr,
    pnl_gross: grossPnl,
    pnl_net: netPnl,
    pnl_pips: pnlPips,
  });
}

export async function addTradeImage(
  tradeId: number,
  imageUri: string,
  imageType: 'entry' | 'exit' | 'analysis' = 'analysis',
) {
  const db = await getDb();
  if (!(await db.trades.get(tradeId))) throw new Error('TRADE_NOT_FOUND');

  return db.trade_images.add({
    trade_id: tradeId,
    image_type: imageType,
    image_uri: imageUri,
    created_at: new Date().toISOString(),
  });
}

export async function deleteTradeImage(id: number) {
  const db = await getDb();
  await db.trade_images.delete(id);
}

export async function deleteTrade(id: number) {
  const db = await getDb();

  await db.transaction('rw', [db.trades, db.trade_images], async () => {
    await db.trade_images.where('trade_id').equals(id).delete();
    await db.trades.delete(id);
  });
}

function timeValue(value: string | null | undefined) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareTrades(left: Trade, right: Trade, params: ListTradeParams) {
  if (!params.status && left.status !== right.status) {
    return left.status === 'OPEN' ? -1 : 1;
  }

  if (params.sort === 'oldest') {
    return timeValue(left.open_time) - timeValue(right.open_time);
  }
  if (params.sort === 'pnl_desc') {
    return Number(right.pnl_net ?? 0) - Number(left.pnl_net ?? 0)
      || timeValue(right.open_time) - timeValue(left.open_time);
  }
  if (params.sort === 'pnl_asc') {
    return Number(left.pnl_net ?? 0) - Number(right.pnl_net ?? 0)
      || timeValue(right.open_time) - timeValue(left.open_time);
  }
  if (params.sort === 'rr_desc') {
    return Number(right.rr_ratio ?? 0) - Number(left.rr_ratio ?? 0)
      || timeValue(right.open_time) - timeValue(left.open_time);
  }

  return timeValue(right.open_time) - timeValue(left.open_time);
}

export async function listTrades(params: ListTradeParams = {}) {
  const db = await getDb();
  let rows = (await db.trades.toArray()).map(normalizeTrade);
  const query = params.query?.trim().toLocaleLowerCase();
  const strategy = params.strategy?.trim().toLocaleLowerCase();
  const since = timeValue(params.since);
  const weekStart = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  rows = rows.filter((trade) => {
    if (params.status && trade.status !== params.status) return false;
    if (query && !(
      trade.symbol.toLocaleLowerCase().includes(query)
      || (trade.strategy ?? '').toLocaleLowerCase().includes(query)
    )) return false;
    if (params.since && timeValue(trade.open_time) < since) return false;
    if (params.dateRange === 'week' && timeValue(trade.open_time) < weekStart) return false;
    if (params.dateRange === 'month') {
      const openDate = new Date(trade.open_time);
      if (
        openDate.getFullYear() !== now.getFullYear()
        || openDate.getMonth() !== now.getMonth()
      ) return false;
    }
    if (params.market && params.market !== 'all' && trade.market !== params.market) return false;
    if (params.direction && params.direction !== 'all' && trade.direction !== params.direction) return false;
    if (params.result === 'win' && !(trade.status === 'CLOSED' && Number(trade.pnl_net ?? 0) > 0)) return false;
    if (params.result === 'loss' && !(trade.status === 'CLOSED' && Number(trade.pnl_net ?? 0) < 0)) return false;
    if (strategy && !(trade.strategy ?? '').toLocaleLowerCase().includes(strategy)) return false;
    return true;
  });

  rows.sort((left, right) => compareTrades(left, right, params));

  if (!params.limit) return rows;
  const offset = Math.max(0, Number(params.offset ?? 0));
  return rows.slice(offset, offset + Math.max(1, Number(params.limit)));
}

async function allTrades() {
  const db = await getDb();
  return (await db.trades.toArray()).map(normalizeTrade);
}

export async function getDashboardSummary(): Promise<Summary> {
  const trades = await allTrades();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const closed = trades.filter((trade) => (
    trade.status === 'CLOSED' && timeValue(trade.open_time) >= monthStart.getTime()
  ));
  const wins = closed.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length;

  return {
    pnl: closed.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
    trades: closed.length,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
    openTrades: trades.filter((trade) => trade.status === 'OPEN').length,
  };
}

function aggregate<T>(
  rows: Trade[],
  keyOf: (trade: Trade) => string,
  build: (key: string, group: Trade[]) => T,
): T[] {
  const groups = new Map<string, Trade[]>();

  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()].map(([key, group]) => build(key, group));
}

export async function getAnalytics() {
  const closed = (await allTrades()).filter((trade) => trade.status === 'CLOSED');
  const pnls = closed.map((trade) => Number(trade.pnl_net ?? 0));
  const grossProfit = pnls.filter((value) => value > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter((value) => value < 0).reduce((a, b) => a + b, 0));
  const wins = pnls.filter((value) => value > 0);
  const losses = pnls.filter((value) => value < 0);
  const average = (values: number[]) => (
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  );

  const byEmotion = aggregate(
    closed,
    (trade) => trade.emotion_entry ?? 'neutral',
    (emotion, group) => ({
      emotion,
      trades: group.length,
      wins: group.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length,
      avgPnl: average(group.map((trade) => Number(trade.pnl_net ?? 0))),
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
    }),
  ).sort((left, right) => right.avgPnl - left.avgPnl);

  const byStrategy = aggregate(
    closed,
    (trade) => trade.strategy ?? '—',
    (strategyName, group) => ({
      strategy: strategyName,
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
      trades: group.length,
      wins: group.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length,
      avgRr: average(group.map((trade) => Number(trade.rr_ratio ?? 0))),
    }),
  ).sort((left, right) => right.pnl - left.pnl);

  const bySymbol = aggregate(
    closed,
    (trade) => trade.symbol,
    (symbol, group) => ({
      symbol,
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
      trades: group.length,
      wins: group.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length,
    }),
  ).sort((left, right) => Math.abs(right.pnl) - Math.abs(left.pnl)).slice(0, 12);

  const byMonth = aggregate(
    closed.filter((trade) => trade.close_time),
    (trade) => (trade.close_time ?? '').slice(0, 7),
    (month, group) => ({
      month,
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
      trades: group.length,
    }),
  ).sort((left, right) => left.month.localeCompare(right.month)).slice(-6);

  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentCurve = aggregate(
    closed.filter((trade) => timeValue(trade.close_time ?? trade.open_time) >= cutoff),
    (trade) => (trade.close_time ?? trade.open_time).slice(0, 10),
    (day, group) => ({
      day,
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
      trades: group.length,
    }),
  ).sort((left, right) => left.day.localeCompare(right.day));

  return {
    totals: {
      pnl: pnls.reduce((a, b) => a + b, 0),
      trades: closed.length,
      wins: wins.length,
      losses: losses.length,
      avgRr: average(closed.map((trade) => Number(trade.rr_ratio ?? 0))),
      best: pnls.length ? Math.max(...pnls) : 0,
      worst: pnls.length ? Math.min(...pnls) : 0,
      grossProfit,
      grossLoss,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
      avgWin: average(wins),
      avgLoss: average(losses),
    },
    byEmotion,
    byStrategy,
    bySymbol,
    byMonth,
    recentCurve,
  };
}

export async function getTradesByDayOfWeek(): Promise<
  { dow: string; pnl: number; trades: number }[]
> {
  const closed = (await allTrades()).filter((trade) => trade.status === 'CLOSED');

  return aggregate(
    closed,
    (trade) => String(new Date(trade.open_time).getDay()),
    (dow, group) => ({
      dow,
      pnl: group.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0),
      trades: group.length,
    }),
  ).sort((left, right) => Number(left.dow) - Number(right.dow));
}

export async function getBackupData() {
  const db = await getDb();
  const [
    settings,
    strategyRecords,
    symbolRecords,
    checklistRecords,
    tradeRecords,
    tradeImageRecords,
  ] = await Promise.all([
    db.settings.toArray(),
    db.strategies.toArray(),
    db.symbols.toArray(),
    db.checklist_items.toArray(),
    db.trades.toArray(),
    db.trade_images.toArray(),
  ]);

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    settings,
    strategies: strategyRecords.map((row) => ({ ...row, id: recordId(row) })),
    symbols: symbolRecords.map(normalizeSymbol),
    checklist: checklistRecords.map(normalizeChecklist),
    trades: tradeRecords.map(normalizeTrade),
    trade_images: tradeImageRecords.map(normalizeTradeImage),
  };
}

export async function restoreBackupData(data: Awaited<ReturnType<typeof getBackupData>>) {
  const db = await getDb();

  await db.transaction(
    'rw',
    [
      db.trade_images,
      db.trades,
      db.strategies,
      db.symbols,
      db.checklist_items,
      db.settings,
    ],
    async () => {
      await db.trade_images.clear();
      await db.trades.clear();
      await db.strategies.clear();
      await db.symbols.clear();
      await db.checklist_items.clear();
      await db.settings.clear();

      if (data.settings?.length) {
        await db.settings.bulkPut(data.settings.map((row) => ({
          key: String(row.key),
          value: String(row.value),
        })));
      }

      if (data.strategies?.length) {
        await db.strategies.bulkPut(data.strategies.map((row) => ({
          id: Number(row.id),
          name: row.name,
          description: row.description ?? null,
          created_at: row.created_at ?? new Date().toISOString(),
        })));
      }

      if (data.symbols?.length) {
        await db.symbols.bulkPut(data.symbols.map((row) => ({
          ...row,
          id: Number(row.id),
          active: Number(row.active),
          is_custom: Number(row.is_custom),
          pip_size: Number(row.pip_size),
          contract_size: Number(row.contract_size),
        })));
      }

      if (data.checklist?.length) {
        await db.checklist_items.bulkPut(data.checklist.map((row) => ({
          ...row,
          id: Number(row.id),
        })));
      }

      if (data.trades?.length) {
        await db.trades.bulkPut(data.trades.map((row) => ({
          ...row,
          id: Number(row.id),
          checklist: checklistJson(row.checklist),
        })));
      }

      if (data.trade_images?.length) {
        await db.trade_images.bulkPut(data.trade_images.map((row) => ({
          ...row,
          id: Number(row.id),
          trade_id: Number(row.trade_id),
          created_at: row.created_at ?? new Date().toISOString(),
        })));
      }
    },
  );
}
