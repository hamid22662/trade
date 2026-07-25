import { listTrades } from '@/db/repositories';

const escapeHtml = (value: unknown) => String(value ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export async function generateMonthlyReport(options: { lang: 'fa' | 'en'; currency: string; year: number; month: number }): Promise<void> {
  if (typeof window === 'undefined') throw new Error('WEB_PRINT_UNAVAILABLE');
  const { lang, currency, year, month } = options;
  const trades = (await listTrades({ status: 'CLOSED' })).filter((trade) => {
    const date = new Date(trade.close_time ?? trade.open_time);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });
  const pnl = trades.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0);
  const wins = trades.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const rows = trades.map((trade) => `<tr><td>${escapeHtml(trade.symbol)}</td><td>${trade.direction}</td><td>${trade.entry_price}</td><td>${trade.exit_price ?? '—'}</td><td>${Number(trade.pnl_net ?? 0).toFixed(2)} ${escapeHtml(currency)}</td><td>${escapeHtml(trade.strategy)}</td><td>${escapeHtml((trade.close_time ?? '').slice(0, 10))}</td></tr>`).join('');
  const isFa = lang === 'fa';
  const html = `<!doctype html><html dir="${isFa ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>TradeLog</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{margin:0}.summary{display:flex;gap:24px;margin:24px 0}.card{border:1px solid #ddd;border-radius:12px;padding:14px;min-width:140px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:${isFa ? 'right' : 'left'}}@media print{button{display:none}}</style></head><body><h1>TradeLog</h1><p>${isFa ? 'گزارش ماهانه' : 'Monthly report'} ${year}/${month}</p><div class="summary"><div class="card">P&amp;L<br><b>${pnl.toFixed(2)} ${escapeHtml(currency)}</b></div><div class="card">${isFa ? 'نرخ برد' : 'Win rate'}<br><b>${winRate}%</b></div><div class="card">${isFa ? 'تعداد معاملات' : 'Trades'}<br><b>${trades.length}</b></div></div><table><thead><tr><th>${isFa ? 'نماد' : 'Symbol'}</th><th>${isFa ? 'جهت' : 'Direction'}</th><th>${isFa ? 'ورود' : 'Entry'}</th><th>${isFa ? 'خروج' : 'Exit'}</th><th>P&amp;L</th><th>${isFa ? 'استراتژی' : 'Strategy'}</th><th>${isFa ? 'تاریخ' : 'Date'}</th></tr></thead><tbody>${rows || `<tr><td colspan="7">${isFa ? 'معامله‌ای ثبت نشده است.' : 'No trades found.'}</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
  const report = window.open('', '_blank', 'noopener,noreferrer');
  if (!report) throw new Error('POPUP_BLOCKED');
  report.document.write(html);
  report.document.close();
}
