import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { DEFAULT_ACCOUNT_ID, getActiveAccountId } from '@/services/accounts';

export const MAX_TRADE_IMAGES = 4;
export const MAX_COMPRESSED_IMAGE_BYTES = 600 * 1024;

const CHART_DIRECTORY_NAME = 'tradelog-charts';

// The default account keeps the ORIGINAL, unsuffixed chart directory so upgrading
// single-account installs keep reading/writing the exact same files they already have.
function chartDirectoryNameForAccount(accountId: string) {
  return accountId === DEFAULT_ACCOUNT_ID ? CHART_DIRECTORY_NAME : `${CHART_DIRECTORY_NAME}-${accountId}`;
}

function getChartDirectoryForAccount(accountId: string) {
  if (!FileSystem.documentDirectory) {
    throw new Error('The app document directory is not available on this device.');
  }
  return `${FileSystem.documentDirectory}${chartDirectoryNameForAccount(accountId)}/`;
}

function extensionForAsset(asset: ImagePicker.ImagePickerAsset) {
  const fileName = asset.fileName || asset.uri.split(/[?#]/)[0];
  const extension = fileName.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)) {
    return extension;
  }

  const mimeExtensions: Record<string, string> = {
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return mimeExtensions[asset.mimeType ?? ''] ?? 'jpg';
}

/** Matches a chart file belonging to ANY account, so cross-account cleanup still works. */
export function isPersistedChartImage(uri: string) {
  if (!FileSystem.documentDirectory) return false;
  return uri.startsWith(`${FileSystem.documentDirectory}${CHART_DIRECTORY_NAME}`);
}

/** Removes only TradeLog-managed chart files; external picker URIs are never deleted. */
export async function deletePersistedChartImage(uri: string) {
  if (!isPersistedChartImage(uri)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function deletePersistedChartImages(uris: string[]) {
  await Promise.all([...new Set(uris)].map(deletePersistedChartImage));
}

/** Purges the currently active account's chart directory only. */
export async function purgePersistedChartImages() {
  const accountId = await getActiveAccountId();
  await purgePersistedChartImagesForAccount(accountId);
}

/** Purges a specific account's chart directory - used when that account is deleted. */
export async function purgePersistedChartImagesForAccount(accountId: string) {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.deleteAsync(getChartDirectoryForAccount(accountId), { idempotent: true });
}

export async function pickAndPersistChartImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const source = asset.uri;
  const accountId = await getActiveAccountId();
  const directory = getChartDirectoryForAccount(accountId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = extensionForAsset(asset);
  const destination = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  try {
    await FileSystem.copyAsync({ from: source, to: destination });
    const info = await FileSystem.getInfoAsync(destination);
    if (!info.exists || info.isDirectory) throw new Error('IMAGE_PERSIST_FAILED');
    return destination;
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}
