import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDirectory = path.join(root, 'public');
const outputDirectory = path.join(root, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relative, base = publicDirectory) {
  return fs.readFileSync(path.join(base, relative), 'utf8');
}

function pngDimensions(file) {
  const data = fs.readFileSync(file);
  assert(
    data.length > 24 && data.subarray(1, 4).toString('ascii') === 'PNG',
    `${path.relative(root, file)} is not a PNG file.`,
  );
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

const manifest = JSON.parse(read('manifest.webmanifest'));
assert(manifest.name && manifest.short_name, 'PWA manifest name fields are missing.');
assert(manifest.display === 'standalone', 'PWA display must be standalone.');
assert(manifest.start_url === '/' && manifest.scope === '/', 'PWA start_url/scope must target the deployed root.');
assert(manifest.theme_color === '#0A1633', 'PWA theme_color is incorrect.');
assert(manifest.background_color === '#0A1633', 'PWA background_color is incorrect.');

const expectedIcons = [
  { source: '/icons/icon-192.png', width: 192, purpose: 'any' },
  { source: '/icons/icon-512.png', width: 512, purpose: 'any' },
  { source: '/icons/icon-maskable-512.png', width: 512, purpose: 'maskable' },
];

for (const expected of expectedIcons) {
  const icon = manifest.icons.find((candidate) => candidate.src === expected.source);
  assert(icon, `Manifest icon ${expected.source} is missing.`);
  assert(icon.type === 'image/png', `Manifest icon ${expected.source} has the wrong type.`);
  assert(icon.purpose.split(/\s+/).includes(expected.purpose), `Manifest icon ${expected.source} has the wrong purpose.`);
  const file = path.join(publicDirectory, expected.source.slice(1));
  assert(fs.existsSync(file), `Manifest icon file ${expected.source} is missing.`);
  const dimensions = pngDimensions(file);
  assert(
    dimensions.width === expected.width && dimensions.height === expected.width,
    `Manifest icon ${expected.source} has incorrect dimensions.`,
  );
  assert(fs.statSync(file).size > 10_000, `Manifest icon ${expected.source} looks like a placeholder.`);
}

const appleIcon = path.join(publicDirectory, 'icons/apple-touch-icon.png');
const appleDimensions = pngDimensions(appleIcon);
assert(appleDimensions.width === 180 && appleDimensions.height === 180, 'Apple touch icon must be 180x180.');

const sourceHtml = read('index.html');
for (const required of [
  'rel="manifest"',
  'rel="apple-touch-icon"',
  'name="apple-mobile-web-app-capable"',
  'name="apple-mobile-web-app-status-bar-style"',
  "serviceWorker.register('/sw.js'",
]) {
  assert(sourceHtml.includes(required), `PWA HTML is missing ${required}.`);
}

if (fs.existsSync(outputDirectory)) {
  for (const relative of [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
  ]) {
    assert(fs.existsSync(path.join(outputDirectory, relative)), `dist/${relative} is missing.`);
  }

  const outputHtml = read('index.html', outputDirectory);
  const serviceWorker = read('sw.js', outputDirectory);
  assert(outputHtml.includes('rel="manifest"'), 'Built HTML does not link the manifest.');
  assert(!serviceWorker.includes('__TRADELOG_BUILD_ID__'), 'Built service worker has no cache version.');
  assert(!serviceWorker.includes('__TRADELOG_PRECACHE_ASSETS__'), 'Built service worker has no generated precache list.');
  assert(serviceWorker.includes('/_expo/static/js/web/'), 'Built service worker does not precache the Expo JavaScript shell.');
  assert(!serviceWorker.match(/APP_SHELL[\s\S]*['"]\/app-config\.json['"]/), 'app-config.json was added to the app shell cache.');
  assert(serviceWorker.includes("url.pathname === APP_CONFIG_PATH"), 'Service worker has no app-config network-only branch.');
  assert(serviceWorker.includes("cache: 'no-store'"), 'Service worker may cache app-config.json.');
}

console.log('pwa-smoke: PASS');
