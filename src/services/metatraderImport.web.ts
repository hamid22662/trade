import { parseMetaTraderReport, ParsedMetaTraderReport } from './metatraderParser';

export interface PickedMetaTraderReport extends ParsedMetaTraderReport {
  fileName: string;
  fileSize: number;
}

export async function pickMetaTraderReport(): Promise<PickedMetaTraderReport | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.htm,.html,.txt,text/csv,text/html,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;

    const finish = (value: PickedMetaTraderReport | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      reject(error);
    };
    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 300);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        if (file.size > 15 * 1024 * 1024) throw new Error('REPORT_TOO_LARGE');
        const text = await file.text();
        const parsed = parseMetaTraderReport(text, file.name);
        finish({ ...parsed, fileName: file.name, fileSize: file.size });
      } catch (error) {
        fail(error);
      }
    }, { once: true });

    window.addEventListener('focus', onWindowFocus, { once: true });
    input.click();
  });
}
