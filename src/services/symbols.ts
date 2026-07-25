import { Market, NewSymbolInput } from '@/types';

export type NormalizedSymbolInput = {
  market: Market;
  symbol: string;
  pip_size: number;
  contract_size: number;
  quote_currency: string;
};

export const normalizeSymbolName = (value: string) => value
  .normalize('NFKC')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

/** Treat BTCUSDT and BTC/USDT as the same symbol when checking duplicates. */
export const symbolIdentityKey = (value: string) => normalizeSymbolName(value).replace(/[^A-Z0-9]/g, '');

export function normalizeNewSymbolInput(input: NewSymbolInput): NormalizedSymbolInput {
  const symbol = normalizeSymbolName(input.symbol);
  const quoteCurrency = normalizeSymbolName(input.quote_currency);
  const pipSize = Number(input.pip_size);
  const contractSize = Number(input.contract_size);
  const validMarket = input.market === 'forex' || input.market === 'crypto';
  const validSymbol = /^[A-Z0-9][A-Z0-9/._:#-]{1,31}$/.test(symbol) && symbolIdentityKey(symbol).length >= 2;
  const validQuoteCurrency = /^[A-Z0-9]{2,10}$/.test(quoteCurrency);

  if (!validMarket || !validSymbol || !validQuoteCurrency || !Number.isFinite(pipSize) || pipSize <= 0 || !Number.isFinite(contractSize) || contractSize <= 0) {
    throw new Error('INVALID_SYMBOL');
  }

  return {
    market: input.market,
    symbol,
    pip_size: pipSize,
    contract_size: contractSize,
    quote_currency: quoteCurrency,
  };
}
