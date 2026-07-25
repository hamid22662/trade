import { getBackupData, listTrades, restoreBackupData } from '@/db/repositories';
import { Trade } from '@/types';

const CSV_COLUMNS: Array<keyof Trade> = [
  'id', 'symbol', 'market', 'direction', 'status', 'entry_price', 'exit_price', 'stop_loss', 'take_profit',
  'lot_size', 'quantity', 'risk_percent', 'risk_amount', 'pnl_gross', 'pnl_net', 'pnl_pips', 'rr_ratio',
  'strategy', 'emotion_entry', 'emotion_exit', 'open_time', 'close_time', 'setup_notes', 'exit_notes', 'lesson_learned',
];

function escapeCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function localDateStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function download(content: BlobPart, mimeType: string, filename: string) {
  if (typeof document === 'undefined') throw new Error('WEB_DOWNLOAD_UNAVAILABLE');
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export async function exportTradesCsv(): Promise<string> {
  const trades: Trade[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await listTrades({ status: 'CLOSED', limit: pageSize, offset });
    trades.push(...page);
    if (page.length < pageSize) break;
  }
  const rows = trades.map((trade) => CSV_COLUMNS.map((column) => escapeCsvCell(trade[column])).join(','));
  const csv = `\uFEFF${[CSV_COLUMNS.join(','), ...rows].join('\n')}`;
  const filename = `tradelog_export_${localDateStamp()}.csv`;
  return download(csv, 'text/csv;charset=utf-8', filename);
}

export async function exportBackupJson(): Promise<string> {
  const data = await getBackupData();
  const filename = `tradelog_backup_${localDateStamp()}.json`;
  return download(JSON.stringify({
    ...data,
    version: 2,
    exported_at: new Date().toISOString(),
  }, null, 2), 'application/json;charset=utf-8', filename);
}

export async function listBackupFiles(): Promise<string[]> { return []; }

export async function restoreBackupJson(): Promise<string | null> {
  if (typeof document === 'undefined') throw new Error('WEB_FILE_PICKER_UNAVAILABLE');
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  const parsed = JSON.parse(await file.text());
  if (!parsed || !Array.isArray(parsed.trades) || !Array.isArray(parsed.settings)) throw new Error('INVALID_BACKUP');
  await restoreBackupData(parsed);
  return file.name;
}
