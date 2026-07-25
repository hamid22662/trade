import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDirectory = path.join(root, 'android');
const isWindows = process.platform === 'win32';
const wrapper = path.join(androidDirectory, isWindows ? 'gradlew.bat' : 'gradlew');

if (!fs.existsSync(wrapper)) {
  throw new Error(`Gradle wrapper not found: ${path.relative(root, wrapper)}`);
}

if (!isWindows) fs.chmodSync(wrapper, 0o755);

const build = spawnSync(
  wrapper,
  ['assembleRelease', '--no-daemon'],
  {
    cwd: androidDirectory,
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
  },
);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const verify = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'android-apk-smoke.mjs')],
  { cwd: root, stdio: 'inherit' },
);

if (verify.error) throw verify.error;
process.exit(verify.status ?? 1);
