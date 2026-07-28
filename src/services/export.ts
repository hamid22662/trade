import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getBackupData, listTrades, restoreBackupData } from '@/db/repositories';
import { createNativeBackupService } from '@/services/nativeBackupService';
import { Trade } from '@/types';

const CSV_COLUMNS: Array<keyof Trade> = [
  'id',
  'symbol',
  'market',
  'direction',
  'status',
  'entry_price',
  'exit_price',
  'stop_loss',
  'take_profit',
  'lot_size',
  'quantity',
  'position_type',
  'leverage',
  'risk_percent',
  'risk_amount',
  'pnl_gross',
  'pnl_net',
  'pnl_pips',
  'rr_ratio',
  'strategy',
  'emotion_entry',
  'emotion_exit',
  'open_time',
  'close_time',
  'setup_notes',
  'exit_notes',
  'lesson_learned',
];

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function localDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${minute}`;
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/** Exports all closed trades to CSV and returns the file URI. */
export async function exportTradesCsv(): Promise<string> {
  const trades = await listTrades({ status: 'CLOSED' });
  const header = CSV_COLUMNS.join(',');
  const rows = trades.map((trade) => CSV_COLUMNS.map((column) => escapeCsvCell(trade[column])).join(','));
  const csv = `\uFEFF${[header, ...rows].join('\n')}`;
  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('The app document directory is not available on this device.');

  const uri = `${directory}tradelog_export_${localDateStamp()}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(uri, 'text/csv', 'Export TradeLog CSV');
  return uri;
}

const backupService = createNativeBackupService({
  fileSystem: {
    documentDirectory: FileSystem.documentDirectory,
    makeDirectory: (uri) => FileSystem.makeDirectoryAsync(uri, { intermediates: true }),
    writeString: (uri, value, encoding) => FileSystem.writeAsStringAsync(uri, value, {
      encoding: encoding === 'base64' ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
    }),
    readString: (uri, encoding) => FileSystem.readAsStringAsync(uri, {
      encoding: encoding === 'base64' ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
    }),
    readDirectory: (uri) => FileSystem.readDirectoryAsync(uri),
    delete: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
  },
  getBackupData,
  restoreBackupData,
  shareFile,
  pickBackupFile: async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    const file = result.assets[0];
    return { uri: file.uri, name: file.name, size: file.size };
  },
});

export const exportBackupJson = backupService.exportBackupJson;
export const listBackupFiles = backupService.listBackupFiles;
export const restoreBackupJson = backupService.restoreBackupJson;
