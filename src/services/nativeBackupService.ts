type TextEncoding = 'utf8' | 'base64';

type BackupTradeImage = {
  id: number;
  trade_id: number;
  image_type: string;
  image_uri: string;
  created_at: string;
};

export type NativeBackupData = {
  version: number;
  exported_at: string;
  settings: unknown[];
  trades: unknown[];
  trade_images: BackupTradeImage[];
  [key: string]: unknown;
};

type PortableTradeImage = BackupTradeImage & {
  image_base64?: string;
  image_extension?: string;
};

type PortableBackupData = Omit<NativeBackupData, 'trade_images'> & {
  trade_images: PortableTradeImage[];
};

type PickedBackupFile = {
  uri: string;
  name: string;
  size?: number;
};

export type NativeBackupDependencies<T extends NativeBackupData> = {
  fileSystem: {
    documentDirectory: string | null;
    makeDirectory: (uri: string) => Promise<void>;
    writeString: (uri: string, value: string, encoding: TextEncoding) => Promise<void>;
    readString: (uri: string, encoding: TextEncoding) => Promise<string>;
    readDirectory: (uri: string) => Promise<string[]>;
    delete: (uri: string) => Promise<void>;
  };
  getBackupData: () => Promise<T>;
  restoreBackupData: (data: T) => Promise<void>;
  shareFile: (uri: string, mimeType: string, dialogTitle: string) => Promise<void>;
  pickBackupFile: () => Promise<PickedBackupFile | null>;
  now?: () => Date;
  randomId?: () => string;
};

export const MAX_PORTABLE_BACKUP_BYTES = 100 * 1024 * 1024;

function localDateStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function safeImageExtension(value: string) {
  const extension = value.split(/[?#]/)[0].match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
  return extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)
    ? extension
    : 'jpg';
}

function parseBackup(value: string): PortableBackupData {
  if (value.length > MAX_PORTABLE_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');
  const parsed = JSON.parse(value) as Partial<PortableBackupData> | null;
  if (
    !parsed
    || typeof parsed !== 'object'
    || !Array.isArray(parsed.settings)
    || !Array.isArray(parsed.trades)
    || !Array.isArray(parsed.trade_images)
    || !Number.isFinite(Number(parsed.version ?? 1))
    || Number(parsed.version ?? 1) > 2
  ) {
    throw new Error('INVALID_BACKUP');
  }
  return parsed as PortableBackupData;
}

export function createNativeBackupService<T extends NativeBackupData>(
  dependencies: NativeBackupDependencies<T>,
) {
  const {
    fileSystem,
    getBackupData,
    restoreBackupData,
    shareFile,
    pickBackupFile,
    now = () => new Date(),
    randomId = () => Math.random().toString(36).slice(2),
  } = dependencies;

  const appDirectory = () => {
    if (!fileSystem.documentDirectory) {
      throw new Error('The app document directory is not available on this device.');
    }
    return fileSystem.documentDirectory;
  };
  const backupDirectory = () => `${appDirectory()}tradelog-backups/`;
  const chartDirectory = () => `${appDirectory()}tradelog-charts/`;

  async function exportBackupJson() {
    const data = await getBackupData();
    const chartRoot = chartDirectory();
    const portableImages: PortableTradeImage[] = [];

    for (const image of data.trade_images ?? []) {
      if (!image.image_uri.startsWith(chartRoot)) {
        portableImages.push({ ...image });
        continue;
      }
      const imageBase64 = await fileSystem.readString(image.image_uri, 'base64');
      portableImages.push({
        ...image,
        image_base64: imageBase64,
        image_extension: safeImageExtension(image.image_uri),
      });
    }

    const payload: PortableBackupData = {
      ...data,
      version: 2,
      exported_at: now().toISOString(),
      trade_images: portableImages,
    };
    const serialized = JSON.stringify(payload, null, 2);
    if (serialized.length > MAX_PORTABLE_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');

    const directory = backupDirectory();
    await fileSystem.makeDirectory(directory);
    const uri = `${directory}tradelog_backup_${localDateStamp(now())}.json`;
    await fileSystem.writeString(uri, serialized, 'utf8');
    await shareFile(uri, 'application/json', 'Save TradeLog backup to Drive or Files');
    return uri;
  }

  async function listBackupFiles() {
    const directory = backupDirectory();
    try {
      const files = await fileSystem.readDirectory(directory);
      return files
        .filter((name) => name.toLowerCase().endsWith('.json'))
        .sort()
        .reverse()
        .map((name) => `${directory}${name}`);
    } catch {
      return [];
    }
  }

  async function restoreBackupFromFile(file: PickedBackupFile) {
    if (file.size && file.size > MAX_PORTABLE_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');
    const parsed = parseBackup(await fileSystem.readString(file.uri, 'utf8'));
    const createdImageUris: string[] = [];

    try {
      const images: BackupTradeImage[] = [];
      for (const image of parsed.trade_images) {
        const {
          image_base64: imageBase64,
          image_extension: imageExtension,
          ...record
        } = image;
        if (!imageBase64) {
          images.push(record);
          continue;
        }

        const directory = chartDirectory();
        await fileSystem.makeDirectory(directory);
        const extension = safeImageExtension(`image.${imageExtension ?? safeImageExtension(record.image_uri)}`);
        const destination = `${directory}restored-${now().getTime()}-${randomId()}-${record.id}.${extension}`;
        await fileSystem.writeString(destination, imageBase64, 'base64');
        createdImageUris.push(destination);
        images.push({ ...record, image_uri: destination });
      }

      await restoreBackupData({
        ...parsed,
        trade_images: images,
      } as T);
      return file.name;
    } catch (error) {
      await Promise.all(createdImageUris.map((uri) => fileSystem.delete(uri).catch(() => undefined)));
      throw error;
    }
  }

  async function restoreBackupJson() {
    const file = await pickBackupFile();
    return file ? restoreBackupFromFile(file) : null;
  }

  return {
    exportBackupJson,
    listBackupFiles,
    restoreBackupJson,
    restoreBackupFromFile,
  };
}
