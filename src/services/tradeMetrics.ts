import { Trade } from '@/types';

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function getTradeDurationMs(trade: Pick<Trade, 'open_time' | 'close_time'>) {
  const start = new Date(trade.open_time).getTime();
  const end = trade.close_time ? new Date(trade.close_time).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

export function formatDuration(ms: number, isRTL = false) {
  if (!ms || ms < 0) return '—';
  const minutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(isRTL ? `${days} روز` : `${days}d`);
  if (hours) parts.push(isRTL ? `${hours} ساعت` : `${hours}h`);
  if (!days && mins) parts.push(isRTL ? `${mins} دقیقه` : `${mins}m`);
  return parts.join(' ') || (isRTL ? 'کمتر از یک دقیقه' : '<1m');
}

export function getTradeDurationLabel(trade: Pick<Trade, 'open_time' | 'close_time'>, isRTL = false) {
  return formatDuration(getTradeDurationMs(trade), isRTL);
}

export function getRMultiple(trade: Pick<Trade, 'pnl_net' | 'risk_amount'>) {
  const risk = Math.abs(toNumber(trade.risk_amount));
  if (!risk) return null;
  return toNumber(trade.pnl_net) / risk;
}

export function getPnlPercent(trade: Pick<Trade, 'pnl_net' | 'account_balance'>) {
  const balance = Math.abs(toNumber(trade.account_balance));
  if (!balance) return null;
  return (toNumber(trade.pnl_net) / balance) * 100;
}

export function formatRMultiple(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}R`;
}

export function getTradeTone(trade: Pick<Trade, 'status' | 'pnl_net'>): 'info' | 'success' | 'danger' | 'default' {
  if (trade.status === 'OPEN') return 'info';
  const pnl = toNumber(trade.pnl_net);
  if (pnl > 0) return 'success';
  if (pnl < 0) return 'danger';
  return 'default';
}
