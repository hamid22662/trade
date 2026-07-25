type SponsorBannerValue = {
  image_url?: unknown;
  target_url?: unknown;
  enabled?: unknown;
};

type AdNetworkIdsValue = {
  adsense_web?: unknown;
  admob_android?: unknown;
};

export type RuntimeAppConfig = {
  telegramSupportUsername: string;
  sponsorBanner: {
    imageUrl: string;
    targetUrl: string;
    enabled: boolean;
  };
  adNetworkIds: {
    adsenseWeb: string;
    admobAndroid: string;
  };
  minAppVersion: string;
  forceUpdateMessage: string;
};

export const RUNTIME_APP_CONFIG_KEYS = [
  'telegram_support_username',
  'sponsor_banner',
  'ad_network_ids',
  'min_app_version',
  'force_update_message',
] as const;

export const normalizeTelegramUsername = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/^https?:\/\/(?:www\.)?t\.me\//i, '')
  .replace(/^@/, '')
  .split(/[/?#]/)[0]
  .replace(/[^A-Za-z0-9_]/g, '')
  .slice(0, 32);

function stringValue(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function publicUrl(value: unknown) {
  const cleaned = stringValue(value, 2048);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export const environmentRuntimeAppConfig: RuntimeAppConfig = {
  telegramSupportUsername: normalizeTelegramUsername(process.env.EXPO_PUBLIC_TELEGRAM_SUPPORT_ID),
  sponsorBanner: {
    imageUrl: publicUrl(process.env.EXPO_PUBLIC_SPONSOR_BANNER_IMAGE_URL),
    targetUrl: publicUrl(process.env.EXPO_PUBLIC_SPONSOR_BANNER_TARGET_URL),
    enabled: ['1', 'true'].includes(String(process.env.EXPO_PUBLIC_SPONSOR_BANNER_ENABLED ?? '').toLowerCase()),
  },
  adNetworkIds: {
    adsenseWeb: stringValue(process.env.EXPO_PUBLIC_ADSENSE_WEB_ID, 200),
    admobAndroid: stringValue(process.env.EXPO_PUBLIC_ADMOB_ANDROID_ID, 200),
  },
  minAppVersion: stringValue(process.env.EXPO_PUBLIC_MIN_APP_VERSION, 64),
  forceUpdateMessage: stringValue(process.env.EXPO_PUBLIC_FORCE_UPDATE_MESSAGE, 500),
};

export function normalizeRuntimeAppConfig(value: unknown): RuntimeAppConfig {
  const values = objectValue(value);
  const sponsor = objectValue(values.sponsor_banner) as SponsorBannerValue;
  const adNetworkIds = objectValue(values.ad_network_ids) as AdNetworkIdsValue;

  const imageUrl = publicUrl(sponsor.image_url) || environmentRuntimeAppConfig.sponsorBanner.imageUrl;
  const targetUrl = publicUrl(sponsor.target_url) || environmentRuntimeAppConfig.sponsorBanner.targetUrl;
  const sponsorEnabled = typeof sponsor.enabled === 'boolean'
    ? sponsor.enabled
    : environmentRuntimeAppConfig.sponsorBanner.enabled;

  return {
    telegramSupportUsername: normalizeTelegramUsername(
      typeof values.telegram_support_username === 'string'
        ? values.telegram_support_username
        : '',
    )
      || environmentRuntimeAppConfig.telegramSupportUsername,
    sponsorBanner: {
      imageUrl,
      targetUrl,
      enabled: sponsorEnabled && Boolean(imageUrl && targetUrl),
    },
    adNetworkIds: {
      adsenseWeb: stringValue(adNetworkIds.adsense_web, 200)
        || environmentRuntimeAppConfig.adNetworkIds.adsenseWeb,
      admobAndroid: stringValue(adNetworkIds.admob_android, 200)
        || environmentRuntimeAppConfig.adNetworkIds.admobAndroid,
    },
    minAppVersion: stringValue(values.min_app_version, 64)
      || environmentRuntimeAppConfig.minAppVersion,
    forceUpdateMessage: stringValue(values.force_update_message, 500)
      || environmentRuntimeAppConfig.forceUpdateMessage,
  };
}

/** Kept for compatibility with earlier callers and fixtures. */
export function normalizeRuntimeAppConfigRows(
  rows: Array<{ key: string; value: unknown }>,
): RuntimeAppConfig {
  return normalizeRuntimeAppConfig(Object.fromEntries(
    rows
      .filter((row) => RUNTIME_APP_CONFIG_KEYS.includes(
        row.key as typeof RUNTIME_APP_CONFIG_KEYS[number],
      ))
      .map((row) => [row.key, row.value]),
  ));
}
