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

// On the web/PWA build, a relative fetch('/app-config.json') resolves against whatever
// domain the app is hosted on - that's the whole point of the "same-origin static file"
// design. The Android/iOS app has no "current origin" to resolve a relative path against,
// so a plain fetch(APP_CONFIG_PATH) there always throws and silently falls back to the
// (normally empty) compile-time environment config below, which is why the sponsor banner
// never showed up in the installed APK even though it worked on the website.
//
// Update this if the hosting domain ever changes, then rebuild the APK.
const NATIVE_APP_CONFIG_BASE_URL = 'https://hrey.siteamade.com';

// navigator.product === 'ReactNative' is a lightweight, dependency-free way to detect the
// actual native app at runtime (avoids importing the full 'react-native' module here, which
// would break this file when it's loaded directly under plain Node by the smoke tests).
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
