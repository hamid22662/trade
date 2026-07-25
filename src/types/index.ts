export type Language = 'fa' | 'en';
export type ThemeMode = 'dark' | 'light';
export type Market = 'forex' | 'crypto';
export type Direction = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type Emotion = 'greed' | 'fear' | 'neutral' | 'confident' | 'rushed';
export type ImageType = 'entry' | 'exit' | 'analysis';

export interface SymbolRow {
  id: number;
  market: Market;
  symbol: string;
  active: number;
  /** Default symbols are protected from deletion; custom symbols can be removed. */
  is_custom: number;
  pip_size: number;
  contract_size: number;
  quote_currency?: string | null;
}

export interface NewSymbolInput {
  symbol: string;
  market: Market;
  pip_size: number;
  contract_size: number;
  quote_currency: string;
}

export interface StrategyRow {
  id: number;
  name: string;
  description?: string | null;
}

export interface ChecklistItem {
  id: number;
  label_fa: string;
  label_en: string;
  active: number;
  position: number;
}

export interface TradeImage {
  id: number;
  trade_id: number;
  image_type: ImageType;
  image_uri: string;
  created_at: string;
}

export interface Trade {
  id: number;
  created_at: string;
  market: Market;
  symbol: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  lot_size?: number | null;
  quantity?: number | null;
  risk_percent?: number | null;
  account_balance?: number | null;
  risk_amount?: number | null;
  pip_size: number;
  contract_size: number;
  /** Calculated from the selected symbol and snapshotted when the trade opens. */
  pip_value_at_entry?: number | null;
  commission: number;
  swap_fee: number;
  funding_fee: number;
  pnl_gross?: number | null;
  pnl_net?: number | null;
  pnl_pips?: number | null;
  rr_ratio?: number | null;
  open_time: string;
  close_time?: string | null;
  strategy?: string | null;
  emotion_entry?: Emotion | null;
  emotion_exit?: Emotion | null;
  setup_notes?: string | null;
  exit_notes?: string | null;
  lesson_learned?: string | null;
  checklist: string;
}

export interface NewTradeInput {
  market: Market;
  symbol: string;
  direction: Direction;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
  lot_size?: number;
  quantity?: number;
  risk_percent: number;
  account_balance: number;
  risk_amount: number;
  pip_size: number;
  contract_size: number;
  pip_value_at_entry?: number;
  open_time: string;
  strategy?: string;
  emotion_entry?: Emotion;
  setup_notes?: string;
  checklist: Record<string, number>;
  images: { uri: string; type: ImageType }[];
}

export interface CloseTradeInput {
  exit_price: number;
  close_time: string;
  emotion_exit?: Emotion;
  exit_notes?: string;
  lesson_learned?: string;
  commission?: number;
  swap_fee?: number;
  funding_fee?: number;
  images?: { uri: string; type: ImageType }[];
}


export interface ImportedTradeInput {
  market: Market;
  symbol: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  lot_size?: number | null;
  quantity?: number | null;
  risk_percent?: number | null;
  account_balance?: number | null;
  risk_amount?: number | null;
  pip_size: number;
  contract_size: number;
  pip_value_at_entry?: number | null;
  commission?: number;
  swap_fee?: number;
  funding_fee?: number;
  pnl_gross?: number | null;
  pnl_net?: number | null;
  pnl_pips?: number | null;
  rr_ratio?: number | null;
  open_time: string;
  close_time?: string | null;
  strategy?: string | null;
  setup_notes?: string | null;
  checklist?: Record<string, number>;
  source_id?: string | null;
}

export interface TradeImportSummary {
  imported: number;
  skipped: number;
  symbolsCreated: number;
}

export interface Summary {
  pnl: number;
  winRate: number;
  trades: number;
  openTrades: number;
}
