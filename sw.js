/* Minimal service worker per the red-team recipe:
   network-first for navigations (never stale-forever), cache-first for assets,
   versioned cache with cleanup. Bump CACHE_VERSION on every deploy. */
'use strict';

const CACHE_VERSION = 'transurfer-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/db.js',
  'js/sessions.js',
  'js/composer.js',
  'fonts/fonts.css',
  'fonts/geist-300.woff2',
  'fonts/geist-400.woff2',
  'fonts/geist-500.woff2',
  'fonts/geist-600.woff2',
  'fonts/geist-mono-400.woff2',
  'fonts/geist-mono-500.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // proxy/tunnel calls pass straight through

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: false }).then(hit => hit || fetch(e.request))
  );
});
