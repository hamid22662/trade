import { ChecklistItem, Market } from '@/types';

export type DefaultSymbol = {
  market: Market;
  symbol: string;
  active: number;
  pip_size: number;
  contract_size: number;
  quote_currency: string;
};

export const DEFAULT_SYMBOLS: DefaultSymbol[] = [
  { market: 'forex', symbol: 'EURUSD', active: 1, pip_size: 0.0001, contract_size: 100000, quote_currency: 'USD' },
  { market: 'forex', symbol: 'GBPUSD', active: 1, pip_size: 0.0001, contract_size: 100000, quote_currency: 'USD' },
  { market: 'forex', symbol: 'USDJPY', active: 1, pip_size: 0.01, contract_size: 100000, quote_currency: 'JPY' },
  { market: 'forex', symbol: 'XAUUSD', active: 1, pip_size: 0.01, contract_size: 100, quote_currency: 'USD' },
  { market: 'forex', symbol: 'NAS100', active: 1, pip_size: 1, contract_size: 1, quote_currency: 'USD' },
  { market: 'crypto', symbol: 'BTC/USDT', active: 1, pip_size: 1, contract_size: 1, quote_currency: 'USDT' },
  { market: 'crypto', symbol: 'ETH/USDT', active: 1, pip_size: 0.01, contract_size: 1, quote_currency: 'USDT' },
  { market: 'crypto', symbol: 'SOL/USDT', active: 1, pip_size: 0.01, contract_size: 1, quote_currency: 'USDT' },
  { market: 'crypto', symbol: 'XRP/USDT', active: 1, pip_size: 0.0001, contract_size: 1, quote_currency: 'USDT' },
];

export const DEFAULT_STRATEGIES = [
  'Breakout', 'Range Trading', 'Trend Following', 'Reversal',
  'Support & Resistance', 'ICT/SMC', 'Price Action',
];

export const DEFAULT_CHECKLIST: Omit<ChecklistItem, 'id'>[] = [
  { label_fa: 'به استراتژی پایبند بودم', label_en: 'Followed my strategy', active: 1, position: 1 },
  { label_fa: 'منتظر تأیید ماندم', label_en: 'Waited for confirmation', active: 1, position: 2 },
  { label_fa: 'حد ضرر گذاشتم', label_en: 'Set stop loss', active: 1, position: 3 },
  { label_fa: 'ریسک را محاسبه کردم', label_en: 'Calculated risk', active: 1, position: 4 },
  { label_fa: 'با احساس وارد نشدم', label_en: 'Entered without emotion', active: 1, position: 5 },
  { label_fa: 'تایم‌فریم بالاتر را چک کردم', label_en: 'Checked higher timeframe', active: 1, position: 6 },
];
