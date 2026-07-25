import { ParsedMetaTraderReport } from './metatraderParser';

export interface PickedMetaTraderReport extends ParsedMetaTraderReport {
  fileName: string;
  fileSize: number;
}

export async function pickMetaTraderReport(): Promise<PickedMetaTraderReport | null> {
  throw new Error('METATRADER_IMPORT_WEB_ONLY');
}
