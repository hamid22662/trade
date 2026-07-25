import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getDb } from '@/db/database';
import { Trade } from '@/types';

type ReportStats = {
  total: number | null;
  wins: number | null;
  totalPnl: number | null;
  avgRr: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
};

const faMonths = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const escapeHtml = (value: unknown) => String(value ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const number = (value: number | null | undefined, digits = 2) =>
  Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const money = (value: number | null | undefined, currency: string) => {
  const amount = Number(value ?? 0);
  return `${amount >= 0 ? '+' : '-'}${escapeHtml(currency)}${number(Math.abs(amount))}`;
};

export async function generateMonthlyReport(options: {
  lang: 'fa' | 'en';
  currency: string;
  year: number;
  month: number;
}): Promise<void> {
  const { lang, currency, year, month } = options;
  const db = await getDb();
  const yearParam = String(year);
  const monthParam = String(month).padStart(2, '0');
  const where = `status = 'CLOSED' AND strftime('%Y', close_time) = ? AND strftime('%m', close_time) = ?`;

  const [trades, rawStats] = await Promise.all([
    db.getAllAsync<Trade>(`SELECT * FROM trades WHERE ${where} ORDER BY close_time ASC`, yearParam, monthParam),
    db.getFirstAsync<ReportStats>(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN pnl_net > 0 THEN 1 ELSE 0 END) as wins,
              SUM(pnl_net) as totalPnl,
              AVG(rr_ratio) as avgRr,
              MAX(pnl_net) as bestTrade,
              MIN(pnl_net) as worstTrade
       FROM trades WHERE ${where}`,
      yearParam,
      monthParam,
    ),
  ]);

  const stats: ReportStats = rawStats ?? { total: 0, wins: 0, totalPnl: 0, avgRr: 0, bestTrade: 0, worstTrade: 0 };
  const total = Number(stats.total ?? 0);
  const winRate = total ? (Number(stats.wins ?? 0) / total) * 100 : 0;
  const isFa = lang === 'fa';
  const monthName = (isFa ? faMonths : enMonths)[month - 1] ?? String(month);
  const pnlClass = (value: number | null | undefined) => Number(value ?? 0) >= 0 ? 'positive' : 'negative';
  const labels = isFa
    ? { pnl: 'P&L کل', winRate: 'نرخ برد', trades: 'تعداد ترید', best: 'بهترین ترید', worst: 'بدترین ترید', avgRr: 'میانگین R/R', symbol: 'نماد', dir: 'جهت', entry: 'ورود', exit: 'خروج', strategy: 'استراتژی', date: 'تاریخ', empty: 'در این ماه ترید بسته‌شده‌ای ثبت نشده است.' }
    : { pnl: 'Total P&L', winRate: 'Win Rate', trades: 'Trades', best: 'Best Trade', worst: 'Worst Trade', avgRr: 'Average R/R', symbol: 'Symbol', dir: 'Dir', entry: 'Entry', exit: 'Exit', strategy: 'Strategy', date: 'Date', empty: 'No closed trades were logged this month.' };

  const rows = trades.length ? trades.map((trade) => `
    <tr>
      <td>${escapeHtml(trade.symbol)}</td><td>${escapeHtml(trade.direction)}</td>
      <td>${number(trade.entry_price, 4)}</td><td>${number(trade.exit_price, 4)}</td>
      <td class="${pnlClass(trade.pnl_net)}">${money(trade.pnl_net, currency)}</td>
      <td>${number(trade.rr_ratio)}</td><td>${escapeHtml(trade.strategy)}</td>
      <td>${escapeHtml((trade.close_time ?? '').slice(0, 10))}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${labels.empty}</td></tr>`;

  const html = `<!DOCTYPE html><html dir="${isFa ? 'rtl' : 'ltr'}" lang="${lang}"><head><meta charset="UTF-8"><style>
    @page { margin: 20px; } * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #0D0D12; color: #F0EBF8; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }.title { font-size: 28px; font-weight: bold; color: #D4AF37; }
    .subtitle { font-size: 14px; color: #A094B8; margin-top: 8px; }.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #16141F; border: 1px solid #2A2640; border-radius: 16px; padding: 16px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: bold; margin-bottom: 4px; }.stat-label { font-size: 11px; color: #A094B8; }
    .positive { color: #10B981; }.negative { color: #F43F5E; }.primary { color: #D4AF37; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
    th { background: #16141F; color: #A094B8; padding: 10px 8px; text-align: ${isFa ? 'right' : 'left'}; border-bottom: 1px solid #2A2640; }
    td { padding: 10px 8px; border-bottom: 1px solid #1E1B2B; } tr:nth-child(even) { background: #11101A; }
    .empty { text-align: center; color: #A094B8; padding: 28px; }.footer { text-align: center; margin-top: 40px; color: #6B6080; font-size: 11px; }
  </style></head><body>
    <div class="header"><div class="title">TradeLog</div><div class="subtitle">${isFa ? 'گزارش ماهانه' : 'Monthly Report'} — ${monthName} ${year}</div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value ${pnlClass(stats.totalPnl)}">${money(stats.totalPnl, currency)}</div><div class="stat-label">${labels.pnl}</div></div>
      <div class="stat-card"><div class="stat-value primary">${number(winRate, 0)}%</div><div class="stat-label">${labels.winRate}</div></div>
      <div class="stat-card"><div class="stat-value primary">${total}</div><div class="stat-label">${labels.trades}</div></div>
      <div class="stat-card"><div class="stat-value positive">${money(stats.bestTrade, currency)}</div><div class="stat-label">${labels.best}</div></div>
      <div class="stat-card"><div class="stat-value negative">${money(stats.worstTrade, currency)}</div><div class="stat-label">${labels.worst}</div></div>
      <div class="stat-card"><div class="stat-value primary">${number(stats.avgRr)}</div><div class="stat-label">${labels.avgRr}</div></div>
    </div>
    <table><thead><tr><th>${labels.symbol}</th><th>${labels.dir}</th><th>${labels.entry}</th><th>${labels.exit}</th><th>P&amp;L</th><th>R/R</th><th>${labels.strategy}</th><th>${labels.date}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">${isFa ? 'ساخته شده با TradeLog | تاریخ تولید:' : 'Generated by TradeLog |'} ${new Date().toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}</div>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: isFa ? 'ذخیره گزارش PDF' : 'Save PDF Report' });
  }
}
