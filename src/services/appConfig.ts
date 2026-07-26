import {
  environmentRuntimeAppConfig,
  normalizeRuntimeAppConfig,
  normalizeRuntimeAppConfigRows,
  type RuntimeAppConfig,
} from '@/services/runtimeAppConfig';

export {
  normalizeRuntimeAppConfig,
  normalizeRuntimeAppConfigRows,
  normalizeTelegramUsername,
  type RuntimeAppConfig,
} from '@/services/runtimeAppConfig';

export const APP_CONFIG_PATH = '/app-config.json';

const NATIVE_APP_CONFIG_BASE_URL = 'https://hrey.siteamade.com';

function isRunningInNativeApp() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

function resolveAppConfigUrl() {
  return isRunningInNativeApp() ? `${NATIVE_APP_CONFIG_BASE_URL}${APP_CONFIG_PATH}` : APP_CONFIG_PATH;
}

/** Reads the public runtime configuration (same-origin on web, fixed host on native) without credentials. */
export async function getRuntimeAppConfig(): Promise<RuntimeAppConfig> {
  try {
    const response = await fetch(resolveAppConfigUrl(), {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`APP_CONFIG_HTTP_${response.status}`);
    return normalizeRuntimeAppConfig(await response.json());
  } catch (error) {
    console.warn('Could not load /app-config.json; using environment fallbacks.', error);
    return environmentRuntimeAppConfig;
  }
}

export const getAppConfig = getRuntimeAppConfig;

export async function getTelegramSupportUsername() {
  return (await getRuntimeAppConfig()).telegramSupportUsername;
}
