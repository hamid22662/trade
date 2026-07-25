import { Direction, Market, Trade } from '@/types';

/**
 * Values needed to close a trade. `pip_value_at_entry` is a snapshot captured at
 * trade creation, so a later symbol edit never changes historical P&L.
 */
type ClosedTradeInput = Pick<
  Trade,
  | 'market'
  | 'symbol'
  | 'direction'
  | 'entry_price'
  | 'pip_size'
  | 'contract_size'
  | 'pip_value_at_entry'
  | 'lot_size'
  | 'quantity'
  | 'commission'
  | 'swap_fee'
  | 'funding_fee'
> & {
  exit_price: number;
};

type ForexPipValueOptions = {
  pipSize: number;
  contractSize: number;
  /** Needed only when the quote currency is not USD/USDT (e.g. USDJPY). */
  entryPrice?: number | null;
  quoteCurrency?: string | null;
};

export type PositionSizeInput = {
  /** Preferred property name. `balance` remains supported for existing screens. */
  accountBalance?: number;
  balance?: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  pipSize: number;
  contractSize?: number;
  market: Market;
  quoteCurrency?: string | null;
};

export type PositionSizeResult = {
  riskAmount: number;
  /** Forex: pips/points. Crypto: absolute price distance. */
  slDistance: number;
  /** Present for forex calculations. */
  lotSize?: number;
  /** Present for crypto calculations. */
  quantity?: number;
  /** Compatibility aliases used by existing screens. */
  distance: number;
  size: number;
  /** Automatically calculated account-currency value of one pip/point at 1.00 lot. */
  pipValue: number;
  /** False only while a non-USD quote requires a valid entry price for conversion. */
  isPipValueConfigured: boolean;
};

const toNumber = (value: unknown): number => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const USD_EQUIVALENT_QUOTES = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'DAI']);

function normalizeQuoteCurrency(quoteCurrency?: string | null) {
  return String(quoteCurrency ?? '').trim().toUpperCase();
}

/** Returns true when the pip value needs the trade entry price for an offline USD approximation. */
export function needsEntryPriceForPipValue(quoteCurrency?: string | null) {
  const quote = normalizeQuoteCurrency(quoteCurrency);
  return Boolean(quote) && !USD_EQUIVALENT_QUOTES.has(quote);
}

function inferQuoteCurrencyFromSymbol(symbol?: string | null) {
  const normalized = String(symbol ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return normalized.length >= 6 ? normalized.slice(-3) : '';
}

/**
 * Reward-to-risk ratio. Returns null when a complete, usable SL/TP setup is not available.
 */
export function calculateRr(
  direction: Direction,
  entry?: number | null,
  stopLoss?: number | null,
  takeProfit?: number | null,
): number | null {
  if (!isPositiveNumber(entry) || !isPositiveNumber(stopLoss) || !isPositiveNumber(takeProfit)) {
    return null;
  }

  const risk = direction === 'BUY' ? entry - stopLoss : stopLoss - entry;
  const reward = direction === 'BUY' ? takeProfit - entry : entry - takeProfit;

  if (risk <= 0 || reward < 0) return null;
  return reward / risk;
}

/** Distance between entry and stop loss, expressed in forex pips / points. */
export function calculateSlDistance(entry?: number | null, stopLoss?: number | null, pipSize?: number | null): number {
  if (!isPositiveNumber(entry) || !isPositiveNumber(stopLoss) || !isPositiveNumber(pipSize)) return 0;
  return Math.abs(entry - stopLoss) / pipSize;
}

/**
 * USD value of one pip / point at exactly 1.00 lot, derived from the symbol table.
 *
 * EURUSD: 0.0001 × 100000 = $10
 * XAUUSD: 0.01 × 100 = $1
 * NAS100: 1 × 1 = $1
 * USDJPY: 0.01 × 100000 = ¥1000, then ÷ entry price for an offline USD approximation.
 */
export function calculateForexPipValuePerLot(
  pipSize: number,
  contractSize: number,
  entryPrice?: number | null,
  quoteCurrency?: string | null,
): number;
export function calculateForexPipValuePerLot(options: ForexPipValueOptions): number;
export function calculateForexPipValuePerLot(
  pipSizeOrOptions: number | ForexPipValueOptions,
  contractSizeArg?: number,
  entryPriceArg?: number | null,
  quoteCurrencyArg?: string | null,
): number {
  const options: ForexPipValueOptions = typeof pipSizeOrOptions === 'number'
    ? {
      pipSize: pipSizeOrOptions,
      contractSize: contractSizeArg ?? 0,
      entryPrice: entryPriceArg,
      quoteCurrency: quoteCurrencyArg,
    }
    : pipSizeOrOptions;

  const baseValue = toNumber(options.pipSize) * toNumber(options.contractSize);
  if (!Number.isFinite(baseValue) || baseValue <= 0) return 0;

  if (!needsEntryPriceForPipValue(options.quoteCurrency)) return baseValue;

  const entryPrice = toNumber(options.entryPrice);
  return entryPrice > 0 ? baseValue / entryPrice : 0;
}

/**
 * Calculates the position size that limits loss at stop loss to the selected account risk.
 * Forex uses symbol metadata and never reads a global/manual pip value.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const accountBalance = input.accountBalance ?? input.balance ?? 0;
  const riskAmount = (toNumber(accountBalance) * toNumber(input.riskPercent)) / 100;
  const market = String(input.market).toLowerCase() as Market;
  const rawDistance = Math.abs(toNumber(input.entry) - toNumber(input.stopLoss));

  if (market === 'crypto') {
    const quantity = rawDistance > 0 && riskAmount > 0 ? riskAmount / rawDistance : 0;
    return {
      riskAmount,
      slDistance: rawDistance,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      distance: rawDistance,
      size: Number.isFinite(quantity) ? quantity : 0,
      pipValue: 0,
      isPipValueConfigured: true,
    };
  }

  const slDistance = calculateSlDistance(input.entry, input.stopLoss, input.pipSize);
  const pipValue = calculateForexPipValuePerLot(
    input.pipSize,
    input.contractSize ?? 0,
    input.entry,
    input.quoteCurrency,
  );
  const isPipValueConfigured = pipValue > 0;
  const lotSize = isPipValueConfigured && slDistance > 0 && riskAmount > 0
    ? riskAmount / (slDistance * pipValue)
    : 0;

  return {
    riskAmount,
    slDistance,
    lotSize: Number.isFinite(lotSize) ? lotSize : 0,
    distance: slDistance,
    size: Number.isFinite(lotSize) ? lotSize : 0,
    pipValue,
    isPipValueConfigured,
  };
}

/**
 * Calculates P&L when a trade is closed.
 * Forex uses the automatically computed pip value saved at entry. Crypto uses price move × quantity.
 */
export function calculateClosedTrade(trade: ClosedTradeInput) {
  const entry = toNumber(trade.entry_price);
  const exit = toNumber(trade.exit_price);
  const isBuy = trade.direction === 'BUY';
  const priceMove = isBuy ? exit - entry : entry - exit;
  const market = String(trade.market).toLowerCase() as Market;

  if (market === 'crypto') {
    const grossPnl = priceMove * toNumber(trade.quantity);
    const netPnl = grossPnl - toNumber(trade.commission) - toNumber(trade.funding_fee);

    return {
      grossPnl,
      netPnl,
      pips: grossPnl,
      pipValue: 0,
    };
  }

  const pipSize = toNumber(trade.pip_size);
  const contractSize = toNumber(trade.contract_size);
  const lotSize = toNumber(trade.lot_size);
  const pips = pipSize > 0 ? priceMove / pipSize : 0;
  const savedPipValue = toNumber(trade.pip_value_at_entry);
  const pipValue = savedPipValue > 0
    ? savedPipValue
    : calculateForexPipValuePerLot(pipSize, contractSize, entry, inferQuoteCurrencyFromSymbol(trade.symbol));
  const grossPnl = pips * pipValue * lotSize;
  const netPnl = grossPnl - toNumber(trade.commission) - toNumber(trade.swap_fee);

  return { grossPnl, netPnl, pips, pipValue };
}

/** Formats a numeric value with a fixed number of decimal places (two by default). */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

  const fractionDigits = Math.max(0, Math.min(20, Math.trunc(decimals)));
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(number);
}

/** Formats a signed monetary amount, e.g. +$70.00 or -$15.50. */
export function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';

  const normalizedCurrency = String(currency || 'USD').trim().toUpperCase();
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
  };
  const currencyPrefix = symbols[normalizedCurrency] ?? `${normalizedCurrency} `;
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';

  return `${sign}${currencyPrefix}${formatNumber(Math.abs(amount), 2)}`;
}
