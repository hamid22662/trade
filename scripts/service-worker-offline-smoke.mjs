import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const serviceWorkerSource = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
const listeners = new Map();
const stores = new Map();
const networkRequests = [];
let offline = false;

function keyFor(request) {
  const value = typeof request === 'string' ? request : request.url;
  return new URL(value, 'https://tradelog.test').pathname;
}

function cacheFor(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    async addAll(urls) {
      for (const url of urls) entries.set(keyFor(url), new Response(`cached:${url}`));
    },
    async put(request, response) {
      entries.set(keyFor(request), response);
    },
    async match(request) {
      return entries.get(keyFor(request));
    },
  };
}

const context = vm.createContext({
  URL,
  Request,
  Response,
  Promise,
  Set,
  console,
  caches: {
    async open(name) {
      return cacheFor(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
    async match(request) {
      for (const entries of stores.values()) {
        const response = entries.get(keyFor(request));
        if (response) return response;
      }
      return undefined;
    },
  },
  async fetch(request) {
    networkRequests.push(request);
    if (offline) throw new Error('OFFLINE');
    return new Response('network', { status: 200 });
  },
  self: {
    location: { origin: 'https://tradelog.test' },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  },
});

vm.runInContext(serviceWorkerSource, context, { filename: 'dist/sw.js' });

function dispatchWithLifetime(type, event = {}) {
  let lifetime;
  listeners.get(type)({
    ...event,
    waitUntil(promise) {
      lifetime = promise;
    },
  });
  return lifetime;
}

await dispatchWithLifetime('install');
await dispatchWithLifetime('activate');

const cachedPaths = new Set([...stores.values()].flatMap((entries) => [...entries.keys()]));
if (!cachedPaths.has('/index.html')) throw new Error('Offline shell does not cache index.html.');
if (![...cachedPaths].some((item) => item.startsWith('/_expo/static/js/web/'))) {
  throw new Error('Offline shell does not cache the Expo JavaScript bundle.');
}
if (cachedPaths.has('/app-config.json')) throw new Error('app-config.json was cached.');

let configResponse;
listeners.get('fetch')({
  request: new Request('https://tradelog.test/app-config.json'),
  respondWith(promise) {
    configResponse = promise;
  },
});
await configResponse;
const configRequest = networkRequests.at(-1);
if (!(configRequest instanceof Request) || configRequest.cache !== 'no-store') {
  throw new Error('app-config.json was not requested with cache: no-store.');
}

offline = true;
let navigationResponse;
listeners.get('fetch')({
  request: {
    method: 'GET',
    mode: 'navigate',
    url: 'https://tradelog.test/dashboard',
  },
  respondWith(promise) {
    navigationResponse = promise;
  },
});

const offlineResponse = await navigationResponse;
if (!offlineResponse || !(await offlineResponse.text()).startsWith('cached:')) {
  throw new Error('Offline navigation did not fall back to the cached app shell.');
}

console.log('service-worker-offline-smoke: PASS');
