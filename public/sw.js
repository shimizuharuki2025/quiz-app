const CACHE_NAME = 'ks-training-v5'; // バージョンアップでキャッシュ刷新
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/theme.css',
    '/theme-toggle.js',
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

// ... (install / activate listeners remain the same)
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
                    return cachedResponse || fetchPromise;
                });
            })
        );
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

// ========================================
// プッシュ通知の受信
// ========================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data = {
        title: 'トレーニングアプリ',
        body: '新しいメッセージがあります',
        icon: '/quiz-app/lawson_logo.png',
        url: '/quiz-app/index.html'
    };

    try {
        data = event.data.json();
    } catch (e) {
        data.body = event.data.text();
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: '/quiz-app/lawson_logo.png', // Androidの通知用アイコン
        data: {
            url: data.url
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ========================================
// 通知をクリックした時の動作
// ========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data.url || '/quiz-app/index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // 既にアプリが開いている場合はフォーカスし、なければ新規作成
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
