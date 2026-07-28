import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseMetaTraderReport, ParsedMetaTraderReport } from './metatraderParser';

export interface PickedMetaTraderReport extends ParsedMetaTraderReport {
  fileName: string;
  fileSize: number;
}

/**
 * Native (Android/iOS) file picker for MetaTrader/exchange export reports. Uses the system
 * document picker + FileSystem, mirroring the JSON backup picker in export.ts. MIME types
 * reported by different apps/file managers for the same .csv/.html export are inconsistent
 * on Android, so the type allowlist is intentionally broad (including a wildcard fallback)
 * rather than risking the picker showing "no matching files" for a perfectly valid export.
 */
export async function pickMetaTraderReport(): Promise<PickedMetaTraderReport | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/html', 'text/plain', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const file = result.assets[0];
  if ((file.size ?? 0) > 15 * 1024 * 1024) throw new Error('REPORT_TOO_LARGE');

  const text = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = parseMetaTraderReport(text, file.name);
  return { ...parsed, fileName: file.name, fileSize: file.size ?? text.length };
}
