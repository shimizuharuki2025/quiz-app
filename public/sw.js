const CACHE_NAME = 'ks-training-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/quiz-app/index.html',
    '/quiz-app/style.css',
    '/quiz-app/script.js',
    '/quiz-app/lawson_logo.png',
    '/auth/login.html',
    '/auth/auth.css'
];

// インストール時に静的ファイルをキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 古いキャッシュの削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// リクエストの処理（キャッシュ優先）
self.addEventListener('fetch', (event) => {
    // APIリクエストなどはキャッシュしない（ネットワーク優先）
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
