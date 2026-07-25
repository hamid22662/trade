import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));
const workflow = read('.github/workflows/build-apk.yml');
const builder = read('scripts/build-android-apk.mjs');
const verifier = read('scripts/android-apk-smoke.mjs');
const gradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const localBuildGuide = read('BUILD_ANDROID_APK.md');
const githubBuildGuide = read('GITHUB_APK_BUILD.md');
const buildSources = [workflow, builder, verifier, localBuildGuide, githubBuildGuide].join('\n');

assert(packageJson.scripts['build:android-apk'] === 'node scripts/build-android-apk.mjs', 'APK build script is not wired.');
assert(packageJson.scripts['build:android-bundle'] === 'npm run build:android-apk', 'Legacy Android command does not build an APK.');
assert(builder.includes("'assembleRelease', '--no-daemon'"), 'APK builder does not run Gradle assembleRelease.');
assert(builder.includes('android-apk-smoke.mjs'), 'APK builder does not verify its output.');
assert(workflow.includes('run: npm run build:android-apk'), 'GitHub workflow bypasses the verified APK builder.');
assert(workflow.includes('app-release.apk') && workflow.includes('if-no-files-found: error'), 'GitHub artifact is not fail-closed.');
assert(!/supabase|secrets\.|EXPO_PUBLIC_/i.test(buildSources), 'APK build path still references application secrets or environment values.');
assert(!/\benv:/i.test(workflow), 'GitHub APK workflow still injects application environment values.');
assert(gradle.includes('release {') && gradle.includes('signingConfig signingConfigs.debug'), 'Release APK has no installable signing configuration.');
assert(gradle.includes(`versionName "${appJson.expo.version}"`), 'Android versionName does not match app.json.');
assert(gradle.includes(`versionCode ${appJson.expo.android.versionCode}`), 'Android versionCode does not match app.json.');
assert(manifest.includes('android.intent.action.MAIN') && manifest.includes('android.intent.category.LAUNCHER'), 'Android app has no launcher activity.');
assert(verifier.includes("'assets/index.android.bundle'"), 'APK verifier does not require the embedded JavaScript bundle.');
assert(verifier.includes("'classes.dex'") && verifier.includes('libreactnative'), 'APK verifier does not require native app code.');
assert(verifier.includes("'apksigner',") || verifier.includes("const executable = process.platform"), 'APK verifier does not validate the signature.');

console.log('android-pipeline-smoke: PASS');
