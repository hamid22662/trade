import {
  APP_CONFIG_PATH,
  getRuntimeAppConfig,
  normalizeRuntimeAppConfig,
} from '@/services/appConfig';
import { environmentRuntimeAppConfig } from '@/services/runtimeAppConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const staticFile = {
  telegram_support_username: '@TradeLogSupport',
  sponsor_banner: {
    image_url: 'https://cdn.example.com/banner.jpg',
    target_url: 'https://example.com/sponsor',
    enabled: true,
  },
  ad_network_ids: {
    adsense_web: 'ca-pub-1234567890',
    admob_android: 'ca-app-pub-1234567890/1234567890',
  },
  min_app_version: '1.2.3',
  force_update_message: 'Update TradeLog.',
};

const config = normalizeRuntimeAppConfig(staticFile);
assert(config.telegramSupportUsername === 'TradeLogSupport', 'Telegram username was not normalized.');
assert(config.sponsorBanner.enabled, 'Sponsor banner enabled flag was not read.');
assert(config.sponsorBanner.imageUrl === 'https://cdn.example.com/banner.jpg', 'Sponsor image URL was not read.');
assert(config.sponsorBanner.targetUrl === 'https://example.com/sponsor', 'Sponsor target URL was not read.');
assert(config.adNetworkIds.adsenseWeb === 'ca-pub-1234567890', 'AdSense ID was not read.');
assert(config.adNetworkIds.admobAndroid.includes('/'), 'AdMob ID was not read.');
assert(config.minAppVersion === '1.2.3', 'Minimum app version was not read.');
assert(config.forceUpdateMessage === 'Update TradeLog.', 'Force-update message was not read.');

const invalidBanner = normalizeRuntimeAppConfig({
  sponsor_banner: {
    image_url: 'javascript:alert(1)',
    target_url: 'https://example.com',
    enabled: true,
  },
});
assert(!invalidBanner.sponsorBanner.enabled, 'Unsafe sponsor image URL enabled the banner.');

const disabledBanner = normalizeRuntimeAppConfig({
  sponsor_banner: {
    image_url: 'https://cdn.example.com/banner.jpg',
    target_url: 'https://example.com',
    enabled: false,
  },
});
assert(!disabledBanner.sponsorBanner.enabled, 'Disabled sponsor banner became visible.');

async function testFetchAndFallback() {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let requestedPath = '';
  let requestedInit: RequestInit | undefined;

  try {
    globalThis.fetch = async (input, init) => {
      requestedPath = String(input);
      requestedInit = init;
      return new Response(JSON.stringify(staticFile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const fetched = await getRuntimeAppConfig();
    assert(requestedPath === APP_CONFIG_PATH, 'Runtime config did not use the same-origin static path.');
    assert(requestedInit?.cache === 'no-store', 'Runtime config fetch may return stale cached values.');
    assert(fetched.minAppVersion === '1.2.3', 'Fetched static config was not normalized.');

    console.warn = () => undefined;
    globalThis.fetch = async () => {
      throw new Error('FILE_NOT_FOUND');
    };
    const fallback = await getRuntimeAppConfig();
    assert(fallback === environmentRuntimeAppConfig, 'Missing static file did not use environment fallbacks.');
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

testFetchAndFallback()
  .then(() => console.log('app-config-read-smoke: PASS'))
  .catch((error) => {
    console.error('app-config-read-smoke: FAIL');
    console.error(error);
    process.exitCode = 1;
  });
