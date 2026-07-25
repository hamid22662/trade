import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apkPath = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdOffset = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  assert(eocdOffset >= 0, 'APK is not a valid ZIP archive.');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert(buffer.readUInt32LE(offset) === centralSignature, 'APK central directory is invalid.');
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push(buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8'));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

assert(fs.existsSync(apkPath), `Installable APK not found at ${path.relative(root, apkPath)}.`);
const apk = fs.readFileSync(apkPath);
assert(apk.length > 5_000_000, 'APK is unexpectedly small and may only contain a Metro bundle.');

const entries = listZipEntries(apk);
for (const required of [
  'AndroidManifest.xml',
  'classes.dex',
  'assets/index.android.bundle',
  'resources.arsc',
]) {
  assert(entries.includes(required), `APK is missing ${required}.`);
}
assert(entries.some((entry) => /^lib\/[^/]+\/libreactnative\.so$/.test(entry)), 'APK has no React Native native library.');

function androidSdkPath() {
  if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT) return process.env.ANDROID_SDK_ROOT;

  const propertiesPath = path.join(root, 'android', 'local.properties');
  if (!fs.existsSync(propertiesPath)) return '';
  const match = fs.readFileSync(propertiesPath, 'utf8').match(/^sdk\.dir=(.+)$/m);
  return match?.[1]?.replaceAll('\\\\', '\\') ?? '';
}

const buildToolsDirectory = path.join(androidSdkPath(), 'build-tools');
assert(fs.existsSync(buildToolsDirectory), 'Android build-tools were not found for APK signature verification.');
const buildToolsVersions = fs.readdirSync(buildToolsDirectory)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const executable = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
const apksignerPath = buildToolsVersions
  .reverse()
  .map((version) => path.join(buildToolsDirectory, version, executable))
  .find((candidate) => fs.existsSync(candidate));
assert(apksignerPath, 'apksigner was not found in the Android SDK.');

const signature = spawnSync(apksignerPath, ['verify', '--verbose', apkPath], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
assert(signature.status === 0, `APK signature verification failed:\n${signature.stderr || signature.stdout}`);

console.log(`android-apk-smoke: PASS (${(apk.length / 1024 / 1024).toFixed(1)} MiB, ${entries.length} entries, signed)`);
