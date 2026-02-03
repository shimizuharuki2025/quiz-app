const CACHE_NAME = 'ks-training-v4'; // バージョンアップでキャッシュ刷新
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/quiz-app/index.html',
    '/quiz-app/style.css',
    '/quiz-app/style-announcements.css',
    '/quiz-app/script.js',
    '/quiz-app/script-auth.js',
    '/quiz-app/script-announcements.js',
    '/quiz-app/lawson_logo.png',
    '/auth/login.html',
    '/auth/auth.css'
];

// インストール時に静的ファイルをキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Static assets cached');
            return cache.addAll(STATIC_ASSETS);
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
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// リクエストの処理
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. お知らせAPIや管理ツール、HTMLファイルはキャッシュしない（常にネットワーク優先）
    if (url.pathname.includes('/api/') ||
        url.pathname.includes('/admin-tool/') ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/') {
        return; // ブラウザの通常リクエスト（ネットワーク）に任せる
    }

    // 2. クイズデータAPI（Stale-While-Revalidate 戦略）
    if (url.pathname.includes('/api/quiz-data')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    // キャッシュがあればそれを返しつつ、バックグラウンドで更新
                    // キャッシュがなければネットワークの結果を待つ
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. その他APIリクエストはキャッシュしない（翻訳、学習記録など）
    if (url.pathname.includes('/api/')) {
        return;
    }

    // 4. 画像などの静的アセット（Cache-First 戦略）
    if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|mp3)$/)) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 5. デフォルト：キャッシュ優先（静的ファイル用）
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
