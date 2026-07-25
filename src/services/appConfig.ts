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

/** Reads the public, same-origin runtime configuration without credentials. */
export async function getRuntimeAppConfig(): Promise<RuntimeAppConfig> {
  try {
    const response = await fetch(APP_CONFIG_PATH, {
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
