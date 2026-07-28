import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

const deadFiles = [
  'src/features/admin/AdminScreen.tsx',
  'src/features/subscription/SubscriptionScreen.tsx',
  'src/components/SubscriptionNotice.tsx',
  'src/services/admin.ts',
  'src/services/feedbackService.ts',
  'src/context/AuthContext.tsx',
];

const removedSupabasePaths = [
  'src/lib/supabase.ts',
  'supabase',
  'scripts/backup-managed-supabase.sh',
  'scripts/backup-storage.mjs',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}

function sourceFiles(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(relative));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

const frontendFiles = ['App.tsx', ...sourceFiles('src')];
const frontendSources = frontendFiles.map((file) => ({ file, source: read(file) }));
const packageJson = JSON.parse(read('package.json'));
const app = read('App.tsx');
const navigator = read('src/AppNavigator.tsx');
const nativeDatabase = read('src/db/database.ts');
const nativeImages = read('src/services/images.ts');
const nativeRepository = read('src/db/repositories.ts');
const nativeExport = read('src/services/export.ts');
const nativeBackup = read('src/services/nativeBackupService.ts');
const webDatabase = read('src/db/webDatabase.ts');
const webRepository = read('src/db/repositories.web.ts');
const appConfigService = read('src/services/appConfig.ts');
const runtimeAppConfig = read('src/services/runtimeAppConfig.ts');
const sponsorBanner = read('src/components/SponsorBanner.tsx');
const dashboard = read('src/features/dashboard/DashboardScreen.tsx');
const settings = read('src/features/settings/SettingsScreen.tsx');
const privacy = read('src/features/settings/PrivacyScreen.tsx');
const translations = read('src/i18n/resources.ts');
const environmentExample = read('.env.example');
const apkWorkflow = read('.github/workflows/build-apk.yml');
const staticAppConfig = JSON.parse(read('public/app-config.json'));
const expectedConfigKeys = [
  'ad_network_ids',
  'force_update_message',
  'min_app_version',
  'sponsor_banner',
  'telegram_support_username',
];

check('Removed account/admin files stay deleted', deadFiles.every((file) => !fs.existsSync(path.join(root, file))));
check('App boots directly into the local-first shell', !app.includes('AuthProvider') && app.includes('AppProvider'));
check('Navigator has no auth, subscription, or admin routes', !/(Auth|Subscription|Admin)Screen/.test(navigator));
check('Feature screens use the platform-local repository', frontendSources
  .filter(({ file }) => file.includes(`${path.sep}features${path.sep}`))
  .every(({ source }) => !source.includes('repositories.cloud')));
check('Web data uses IndexedDB only', webDatabase.includes("from 'dexie'") && !webRepository.toLowerCase().includes('supabase'));
check('Native data uses persistent SQLite', nativeDatabase.includes("from 'expo-sqlite'") && nativeDatabase.includes('PRAGMA journal_mode = WAL'));
check('Native writes use exclusive SQLite transactions', nativeRepository.includes('withExclusiveTransactionAsync'));
check('Native chart images use the app document directory', nativeImages.includes("from 'expo-file-system/legacy'") && nativeImages.includes('FileSystem.documentDirectory'));
check('Native image deletion is constrained to managed files', nativeImages.includes('isPersistedChartImage') && nativeImages.includes('idempotent: true'));
check('Native backup restore uses the system document picker', nativeExport.includes("from 'expo-document-picker'") && nativeExport.includes('copyToCacheDirectory: true'));
check('Portable backup still embeds image bytes', nativeBackup.includes('image_base64') && nativeBackup.includes('version: 2'));
check('Runtime config uses the same-origin static file on web (fixed host on native)', appConfigService.includes("APP_CONFIG_PATH = '/app-config.json'") && appConfigService.includes('isRunningInNativeApp()') && appConfigService.includes('fetch(resolveAppConfigUrl()'));
check('Runtime config avoids stale cache and credentials', appConfigService.includes("cache: 'no-store'") && appConfigService.includes("credentials: 'omit'"));
check('Runtime config keeps environment fallback', appConfigService.includes('return environmentRuntimeAppConfig') && runtimeAppConfig.includes('environmentRuntimeAppConfig'));
check('Static config exposes only allowlisted public keys', JSON.stringify(Object.keys(staticAppConfig).sort()) === JSON.stringify(expectedConfigKeys));
check('Sponsor banner fails closed without valid complete config', sponsorBanner.includes('isRenderableSponsorBanner') && sponsorBanner.includes('if (!isRenderableSponsorBanner(banner)) return null'));
check('Sponsor image hides itself if it fails to load', sponsorBanner.includes("onError={() => setBanner(null)}"));
check('Sponsor links open outside the current app view', sponsorBanner.includes("'_blank'") && sponsorBanner.includes('Linking.openURL'));
check('Sponsor banner is placed on Dashboard and Settings', dashboard.includes('<SponsorBanner />') && settings.includes('<SponsorBanner />'));
check('Privacy screen is routed from Settings', navigator.includes('name="Privacy"') && settings.includes("navigation.navigate('Privacy')"));
check('Privacy copy states local-only data and future ad disclosure', privacy.includes("t('privacy.noCollectionBody')") && translations.includes('هیچ داده معاملاتی یا شخصی') && translations.includes('No advertising network is active in the current version'));
check('Supabase runtime and backend artifacts are removed', removedSupabasePaths.every((file) => !fs.existsSync(path.join(root, file))));
check('Supabase npm dependency is removed', !packageJson.dependencies?.['@supabase/supabase-js'] && !packageJson.devDependencies?.['@supabase/supabase-js']);
check('Frontend has no Supabase imports or keys', frontendSources.every(({ source }) => !/supabase|EXPO_PUBLIC_SUPABASE/i.test(source)));
check('Environment example contains no removed secrets', !/SUPABASE|APP_CONFIG_ADMIN_PASSWORD/.test(environmentExample));
check(
  'APK workflow only uses secrets for optional release signing, nothing else',
  !/supabase|EXPO_PUBLIC_/i.test(apkWorkflow)
  && (apkWorkflow.match(/secrets\.\w+/g) ?? []).every((match) => /^secrets\.RELEASE_/.test(match)),
);
check('Android build script produces and verifies a real APK', packageJson.scripts?.['build:android-apk'] === 'node scripts/build-android-apk.mjs'
  && read('scripts/build-android-apk.mjs').includes('assembleRelease')
  && read('scripts/build-android-apk.mjs').includes('android-apk-smoke.mjs'));
check('Advertising SDKs remain deferred', Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
  .every((name) => !/admob|adsense|google-mobile-ads/i.test(name)));

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'}  ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} local-first security check(s) failed.`);
  process.exit(1);
}
console.log(`\nLocal-first security checks passed (${checks.length}/${checks.length}).`);
