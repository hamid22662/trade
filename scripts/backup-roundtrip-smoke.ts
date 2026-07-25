import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createNativeBackupService,
  type NativeBackupData,
} from '@/services/nativeBackupService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function run() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'tradelog-backup-roundtrip-'));
  const documentDirectory = pathToFileURL(`${temporaryDirectory}${sep}`).href;
  const sourceImageUri = `${documentDirectory}tradelog-charts/entry.png`;
  const imageBytes = 'aW1hZ2UtYnl0ZXM=';
  let sharedUri = '';
  let repository: NativeBackupData = {
    version: 1,
    exported_at: '2026-07-24T10:00:00.000Z',
    settings: [{ key: 'language', value: 'fa' }],
    strategies: [],
    symbols: [],
    checklist: [],
    trades: [{ id: 7, symbol: 'EURUSD', status: 'OPEN' }],
    trade_images: [{
      id: 11,
      trade_id: 7,
      image_type: 'entry',
      image_uri: sourceImageUri,
      created_at: '2026-07-24T10:00:00.000Z',
    }],
  };

  try {
    await mkdir(fileURLToPath(`${documentDirectory}tradelog-charts/`), { recursive: true });
    await writeFile(fileURLToPath(sourceImageUri), Buffer.from(imageBytes, 'base64'));

    const service = createNativeBackupService({
      fileSystem: {
        documentDirectory,
        makeDirectory: async (uri) => {
          await mkdir(fileURLToPath(uri), { recursive: true });
        },
        writeString: async (uri, value, encoding) => {
          await writeFile(
            fileURLToPath(uri),
            encoding === 'base64' ? Buffer.from(value, 'base64') : value,
          );
        },
        readString: async (uri, encoding) => {
          const value = await readFile(fileURLToPath(uri));
          return encoding === 'base64' ? value.toString('base64') : value.toString('utf8');
        },
        readDirectory: async (directory) => readdir(fileURLToPath(directory)),
        delete: async (uri) => {
          await rm(fileURLToPath(uri), { force: true });
        },
      },
      getBackupData: async () => clone(repository),
      restoreBackupData: async (data) => { repository = clone(data); },
      shareFile: async (uri) => {
        await access(fileURLToPath(uri));
        sharedUri = uri;
      },
      pickBackupFile: async () => {
        assert(sharedUri, 'Export did not open the Share Sheet adapter.');
        return {
          uri: sharedUri,
          name: sharedUri.split('/').pop() ?? 'backup.json',
          size: (await stat(fileURLToPath(sharedUri))).size,
        };
      },
      now: () => new Date('2026-07-24T12:34:00.000Z'),
      randomId: () => 'roundtrip',
    });

    const exportedUri = await service.exportBackupJson();
    assert(exportedUri === sharedUri, 'The shared file was not the exported backup.');

    const portable = JSON.parse(await readFile(fileURLToPath(exportedUri), 'utf8'));
    assert(portable.version === 2, 'Portable backup version was not written.');
    assert(portable.trade_images[0].image_base64 === imageBytes, 'Image bytes were not embedded.');

    repository = {
      ...repository,
      settings: [],
      trades: [],
      trade_images: [],
    };

    const restoredName = await service.restoreBackupJson();
    assert(restoredName?.endsWith('.json'), 'The exported backup was not selected for restore.');
    assert((repository.trades[0] as { id?: number })?.id === 7, 'Trade data did not round-trip.');
    assert((repository.settings[0] as { value?: string })?.value === 'fa', 'Settings did not round-trip.');
    assert(repository.trade_images.length === 1, 'Image metadata did not round-trip.');

    const restoredImageUri = repository.trade_images[0].image_uri;
    assert(restoredImageUri.startsWith(`${documentDirectory}tradelog-charts/restored-`), 'Image was not restored into managed storage.');
    assert(
      (await readFile(fileURLToPath(restoredImageUri))).toString('base64') === imageBytes,
      'Restored image bytes changed.',
    );

    console.log('backup-roundtrip-smoke: PASS');
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error('backup-roundtrip-smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
});
