import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'dist');
const serviceWorkerPath = path.join(outputDirectory, 'sw.js');
const marker = '  // __TRADELOG_PRECACHE_ASSETS__';
const excludedFiles = new Set([
  'app-config.json',
  'index.html',
  'metadata.json',
  'sw.js',
]);
const baseShellUrls = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

if (!fs.existsSync(serviceWorkerPath)) {
  throw new Error('dist/sw.js was not copied from public/sw.js.');
}

const files = walk(outputDirectory)
  .map((absolute) => path.relative(outputDirectory, absolute).split(path.sep).join('/'))
  .filter((relative) => !excludedFiles.has(relative) && !path.basename(relative).startsWith('.'))
  .sort();

const buildId = crypto.createHash('sha256')
  .update(files.map((relative) => relative).join('\n'));
for (const relative of files) {
  buildId.update('\0');
  buildId.update(fs.readFileSync(path.join(outputDirectory, relative)));
}
const buildVersion = buildId.digest('hex')
  .slice(0, 12);

const generatedEntries = files
  .map((relative) => `  '/${relative.replaceAll("'", "\\'")}',`)
  .join('\n');

let serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
if (!serviceWorker.includes(marker)) {
  throw new Error('PWA precache marker is missing from dist/sw.js.');
}

serviceWorker = serviceWorker
  .replace('__TRADELOG_BUILD_ID__', buildVersion)
  .replace(marker, generatedEntries);

fs.writeFileSync(serviceWorkerPath, serviceWorker);
const shellUrlCount = new Set([
  ...baseShellUrls,
  ...files.map((relative) => `/${relative}`),
]).size;
console.log(`prepare-pwa-output: cached ${shellUrlCount} shell URLs (${buildVersion})`);
