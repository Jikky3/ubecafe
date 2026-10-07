/*
 * Ube Café service worker: makes the app installable and usable offline.
 *
 * - Precaches the app shell into a versioned cache on install.
 * - Same-origin GET requests are served cache-first; anything not precached is
 *   fetched once and added to the cache. Page navigations fall back to index.html.
 * - Google Fonts are stale-while-revalidate in their own cache. Offline with no
 *   cached copy, the stylesheet resolves to an empty one so the system fonts
 *   from styles.css take over without errors.
 * - Old caches are deleted when a new version activates.
 *
 * RELEASES: bump CACHE_VERSION whenever any precached file changes, otherwise
 * installed copies keep serving the old files. Add new files to APP_SHELL
 * (tests/backup.test.js checks that every js/ module is listed).
 */
const CACHE_VERSION = 'v1';
const CACHE = `ubecafe-shell-${CACHE_VERSION}`;
const FONT_CACHE = 'ubecafe-fonts-v1';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/main.js',
  'js/migrations.js',
  'js/state.js',
  'js/storage.js',
  'js/util.js',
  'js/data/constants.js',
  'js/data/foods.js',
  'js/data/nutrients.js',
  'js/data/seeds.js',
  'js/engines/accounts.js',
  'js/engines/backup.js',
  'js/engines/biometrics.js',
  'js/engines/grocery.js',
  'js/engines/ocr.js',
  'js/engines/recipe-match.js',
  'js/engines/recipe-parser.js',
  'js/engines/recommendations.js',
  'js/engines/schedule.js',
  'js/ui/account.js',
  'js/ui/backup.js',
  'js/ui/dashboard.js',
  'js/ui/grocery.js',
  'js/ui/ocr.js',
  'js/ui/planner.js',
  'js/ui/profile.js',
  'js/ui/recipe-view.js',
  'js/ui/recipes.js',
  'js/ui/recommendations.js',
  'js/ui/schedule.js',
  'js/ui/theme.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' skips the HTTP cache so a new version never precaches stale files.
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([CACHE, FONT_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('ubecafe-') && !keep.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

const appShell = async (request) => {
  const cache = await caches.open(CACHE);
  const isPage = request.mode === 'navigate';
  const cached = await cache.match(request, { ignoreSearch: isPage });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  } catch {
    if (isPage) {
      const page = await cache.match('index.html');
      if (page) return page;
    }
    return Response.error();
  }
};

const fonts = async (event) => {
  const { request } = event;
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  try {
    return await network;
  } catch {
    const isStylesheet = new URL(request.url).hostname === 'fonts.googleapis.com';
    return isStylesheet
      ? new Response('/* Fonts unavailable offline; system fonts are used. */', { headers: { 'Content-Type': 'text/css' } })
      : new Response('', { status: 503, statusText: 'Offline' });
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(appShell(request));
  else if (FONT_HOSTS.has(url.hostname)) event.respondWith(fonts(event));
});
