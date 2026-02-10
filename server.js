//【確定版 v5】server.js - ユーザー認証とセッション管理機能追加
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const webpush = require('web-push');
const db = require('./db'); // データベース接続

const app = express();
const port = process.env.PORT || 10000;

// Renderなどのリバースプロキシを信頼する
app.set('trust proxy', 1);

// キャッシュ制御ミドルウェア
app.use((req, res, next) => {
    const url = req.url;
    // HTMLファイルや管理ツール関連はキャッシュさせない（常に最新をチェックさせる）
    if (url.endsWith('.html') || url.includes('/admin-tool/') || url.includes('/api/auth/')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// --- ▼▼▼【Disk機能の設定】▼▼▼ ---
// 全ての重要データを永続化ディスク(/data)に配置する
const DATA_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'data');
const quizDataPath = path.join(DATA_DIR, 'quiz-data.json');
const usersDataPath = path.join(DATA_DIR, 'users.json');
const learningHistoryPath = path.join(DATA_DIR, 'learning-history.json');
const sourceDataPath = path.join(__dirname, 'public', 'quiz-app', 'quiz-data.json');
const subscriptionsDataPath = path.join(DATA_DIR, 'subscriptions.json');
const vapidKeysPath = path.join(DATA_DIR, 'vapid-keys.json');

// 画像保存先もDiskに変更
const uploadPath = path.join(DATA_DIR, 'uploads');

// 各種ディレクトリの作成（Disk内）
[DATA_DIR, uploadPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ ディレクトリを作成しました: ${dir}`);
    }
});

// Diskに quiz-data.json が存在しない場合、初期データをコピー
if (!fs.existsSync(quizDataPath)) {
    if (fs.existsSync(sourceDataPath)) {
        fs.copyFileSync(sourceDataPath, quizDataPath);
        console.log(`✓ 初期データをコピーしました: ${sourceDataPath} → ${quizDataPath}`);
    } else {
        const emptyData = { mainCategories: [] };
        fs.writeFileSync(quizDataPath, JSON.stringify(emptyData, null, 2), 'utf8');
        console.log(`✓ 空の初期データを作成しました: ${quizDataPath}`);
    }
}

// VAPID設定
// VAPID設定（キーが無ければ生成）
if (!fs.existsSync(vapidKeysPath)) {
    const vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidKeysPath, JSON.stringify(vapidKeys, null, 2));
    console.log('✓ VAPIDキーを新規生成しました。');
}

if (fs.existsSync(vapidKeysPath)) {
    const vapidKeys = JSON.parse(fs.readFileSync(vapidKeysPath, 'utf8'));
    webpush.setVapidDetails(
        'mailto:admin@ks-training.app',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
    // クライアント側で使うため、パブリックキーをAPIで提供できるようにする
    app.get('/api/push/public-key', (req, res) => {
        res.json({ publicKey: vapidKeys.publicKey });
    });
    console.log('✓ VAPIDキーをロードしました。');
} else {
    console.warn('⚠️ VAPIDキーが見つかりません。プッシュ通知が動作しません。');
}
// --- ▲▲▲【ここまで】▲▲▲ ---


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, `image-${Date.now()}-${Math.floor(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

app.use(express.json({ limit: '50mb' }));

// 1. ルートパス (/) のハンドラを静的ファイルより先に定義（強制的に index.html を返す）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2.// キャッシュリセット用ミドルウェア (特定のファイルへのアクセス時に強力なキャッシュクリアを行う)
app.use((req, res, next) => {
    // ユーザー管理画面や管理トップへのアクセス時
    if (req.path.includes('/admin-tool/users.html') || req.path.includes('/admin-tool/admin.html')) {
        res.set('Clear-Site-Data', '"cache"');
    }
    next();
});

// キャッシュリセット用ミドルウェア (特定のファイルへのアクセス時に強力なキャッシュクリアを行う)
app.use((req, res, next) => {
    // ユーザー管理画面や管理トップへのアクセス時
    if (req.path.includes('/admin-tool/users.html') || req.path.includes('/admin-tool/admin.html')) {
        res.set('Clear-Site-Data', '"cache"');
    }
    next();
});

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// --- ▼▼▼【セッション管理の設定】▼▼▼ ---
// セッションファイル保存ディレクトリ
const sessionsDir = path.join(DATA_DIR, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log(`✓ セッション保存ディレクトリを作成しました: ${sessionsDir}`);
}

app.use(session({
    store: new FileStore({
        path: sessionsDir,
        ttl: 90 * 24 * 60 * 60, // 90日間（秒単位）
        reapInterval: 24 * 60 * 60, // 1日ごとに期限切れセッションを削除
        logFn: function (msg) {
            // ENOENT以外の重要なエラーのみを出力
            if (msg && !msg.includes('ENOENT')) {
                console.log('[SessionStore]', msg);
            }
        }
    }),
    secret: process.env.SESSION_SECRET || 'quiz-app-secret-key-2026',
    resave: false, // セッションが変更されていない限り再保存しない
    saveUninitialized: false, // 未初期化のセッションは保存しない
    proxy: true, // Renderなどのリバースプロキシ環境で必要
    rolling: true, // アクセスごとに期限を延長
    cookie: {
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90日間（ミリ秒単位）
        httpOnly: true, // XSS対策
        secure: false, // HTTPSの場合はtrueに変更（Render環境でも通常はfalseで動作）
        path: '/' // 全パスでクッキーが送信されるように明示
    }
}));
console.log('✓ セッション管理を初期化しました（有効期限: 90日・自動延長）');
// --- ▲▲▲【ここまで】▲▲▲ ---

// --- ▼▼▼【Diskに保存された画像を配信】▼▼▼ ---
// /uploads/ へのリクエストをDiskの画像ディレクトリから配信
app.use('/uploads', express.static(uploadPath));
// --- ▲▲▲【ここまで】 ▲▲▲ ---
// ミドルウェア：管理者チェック
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: '管理者権限が必要です。' });
    }
    next();
}

// APIエンドポイント：クイズデータを取得する
app.get('/api/quiz-data', (req, res) => {
    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json({ mainCategories: [] });
            }
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー：データの読み込みに失敗しました。' });
        }
        try {
            // パフォーマンス最適化のため、ブラウザでのキャッシュを許可（10分間）
            // サービスワーカーの stale-while-revalidate 戦略と組み合わせて高速化を実現
            res.setHeader('Cache-Control', 'public, max-age=600');
            res.json(JSON.parse(data));
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'サーバーエラー：データ形式が正しくありません。' });
        }
    });
});



app.post('/save', (req, res) => {
    const dataToSave = JSON.stringify(req.body, null, 2);
    fs.writeFile(quizDataPath, dataToSave, 'utf8', (err) => {
        if (err) {
            console.error('ファイルの保存に失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー：ファイルの保存に失敗しました。' });
        }
        console.log('quiz-data.jsonが正常に保存されました。');
        res.json({ success: true, message: 'データは正常に保存されました。' });
    });
});

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'ファイルがアップロードされませんでした。' });
    res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
});

app.post('/api/v1/auth/admin', async (req, res) => {
    const { employeeCode, password } = req.body;

    // 1. 個別の従業員アカウントでの認証を試行
    if (employeeCode && password) {
        const result = await db.query('SELECT * FROM users WHERE employee_code = $1', [employeeCode]);
        const user = result.rows[0];

        if (user && !user.is_banned && user.is_admin) {
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (isPasswordValid) {
                if (req.session) {
                    req.session.userId = user.id;
                    req.session.employeeCode = user.employee_code;
                    req.session.name = user.name;
                    req.session.isAdmin = true;
                }
                console.log('管理者としてログインしました(個別):', employeeCode);
                return res.json({ authenticated: true, method: 'individual' });
            }
        }
    }

    // 2. 従来の共有パスワードでの認証 (移行期間用)
    const sharedPassword = password || req.body.password; // employeeCodeなしで送られてきた場合用
    if (sharedPassword) {
        fs.readFile(quizDataPath, 'utf8', (err, data) => {
            let adminPasswordHash = null;
            const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';

            if (!err) {
                try {
                    const quizData = JSON.parse(data);
                    adminPasswordHash = quizData.adminPasswordHash;
                } catch (e) {
                    console.error('管理者設定の解析に失敗しました');
                }
            }

            const isMatch = adminPasswordHash
                ? bcrypt.compareSync(sharedPassword, adminPasswordHash)
                : sharedPassword === defaultPassword;

            if (isMatch) {
                if (req.session) {
                    req.session.isAdmin = true;
                }
                console.log('管理者としてログインしました(共有パスワード)');
                return res.json({ authenticated: true, method: 'shared' });
            } else {
                return res.status(401).json({ authenticated: false, message: '従業員コードまたはパスワードが正しくありません。' });
            }
        });
    } else {
        res.status(400).json({ authenticated: false, message: '従業員コードとパスワードを入力してください。' });
    }
});

// 管理者パスワード変更APIは削除されました

// ========================================
// お知らせ管理用API
// ========================================

// 有効なお知らせ一覧を取得（表示期間内のもののみ）
app.get('/api/announcements', (req, res) => {
    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        try {
            const quizData = JSON.parse(data);
            const announcements = quizData.announcements || [];

            // 現在の日付を取得（YYYY-MM-DD形式）
            const today = new Date().toISOString().split('T')[0];

            // 有効なお知らせのみフィルタリング
            const activeAnnouncements = announcements.filter(announcement => {
                if (!announcement.enabled) return false;

                const startDate = announcement.startDate || '';
                const endDate = announcement.endDate || '';

                // 開始日と終了日のチェック
                if (startDate && today < startDate) return false;
                if (endDate && today > endDate) return false;

                return true;
            });

            res.json({ success: true, announcements: activeAnnouncements });
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'データ形式エラー' });
        }
    });
});

// すべてのお知らせを取得（管理者用）
app.get('/api/announcements/all', (req, res) => {
    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        try {
            const quizData = JSON.parse(data);
            const announcements = quizData.announcements || [];
            res.json({ success: true, announcements });
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'データ形式エラー' });
        }
    });
});

// 新しいお知らせを追加
app.post('/api/announcements', (req, res) => {
    const { message, severity, startDate, endDate, enabled } = req.body;

    // バリデーション
    if (!message || !severity) {
        return res.status(400).json({ success: false, message: 'メッセージと重要度は必須です。' });
    }

    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        try {
            const quizData = JSON.parse(data);
            if (!quizData.announcements) {
                quizData.announcements = [];
            }

            // 新しいお知らせを作成
            const newAnnouncement = {
                id: `announcement_${Date.now()}`,
                message,
                severity,
                startDate: startDate || '',
                endDate: endDate || '',
                enabled: enabled !== undefined ? enabled : true
            };

            quizData.announcements.push(newAnnouncement);

            // データを保存
            fs.writeFile(quizDataPath, JSON.stringify(quizData, null, 2), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('ファイルの保存に失敗しました:', writeErr);
                    return res.status(500).json({ success: false, message: 'データ保存エラー' });
                }

                console.log('新しいお知らせが追加されました:', newAnnouncement.id);
                res.json({ success: true, announcement: newAnnouncement });
            });
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'データ形式エラー' });
        }
    });
});

// お知らせを更新
app.put('/api/announcements/:id', (req, res) => {
    const { id } = req.params;
    const { message, severity, startDate, endDate, enabled } = req.body;

    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        try {
            const quizData = JSON.parse(data);
            const announcements = quizData.announcements || [];

            const index = announcements.findIndex(a => a.id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'お知らせが見つかりません。' });
            }

            // お知らせを更新
            announcements[index] = {
                ...announcements[index],
                message: message !== undefined ? message : announcements[index].message,
                severity: severity !== undefined ? severity : announcements[index].severity,
                startDate: startDate !== undefined ? startDate : announcements[index].startDate,
                endDate: endDate !== undefined ? endDate : announcements[index].endDate,
                enabled: enabled !== undefined ? enabled : announcements[index].enabled
            };

            quizData.announcements = announcements;

            // データを保存
            fs.writeFile(quizDataPath, JSON.stringify(quizData, null, 2), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('ファイルの保存に失敗しました:', writeErr);
                    return res.status(500).json({ success: false, message: 'データ保存エラー' });
                }

                console.log('お知らせが更新されました:', id);
                res.json({ success: true, announcement: announcements[index] });
            });
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'データ形式エラー' });
        }
    });
});

// お知らせを削除
app.delete('/api/announcements/:id', (req, res) => {
    const { id } = req.params;

    fs.readFile(quizDataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('データファイルの読み込みに失敗しました:', err);
            return res.status(500).json({ success: false, message: 'サーバーエラー' });
        }

        try {
            const quizData = JSON.parse(data);
            const announcements = quizData.announcements || [];

            const initialLength = announcements.length;
            quizData.announcements = announcements.filter(a => a.id !== id);

            if (quizData.announcements.length === initialLength) {
                return res.status(404).json({ success: false, message: 'お知らせが見つかりません。' });
            }

            // データを保存
            fs.writeFile(quizDataPath, JSON.stringify(quizData, null, 2), 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error('ファイルの保存に失敗しました:', writeErr);
                    return res.status(500).json({ success: false, message: 'データ保存エラー' });
                }

                console.log('お知らせが削除されました:', id);
                res.json({ success: true, message: 'お知らせが削除されました。' });
            });
        } catch (parseErr) {
            console.error('JSONデータの解析に失敗しました:', parseErr);
            res.status(500).json({ success: false, message: 'データ形式エラー' });
        }
    });
});


// ========================================
// ユーザー認証と学習履歴API
// ========================================
require('./auth-api')(app, usersDataPath, learningHistoryPath);

// ========================================
// プッシュ通知用API
// ========================================

// サブスクリプション保存関数
function saveSubscription(subscription, userId = null, employeeCode = null) {
    let subscriptions = [];
    if (fs.existsSync(subscriptionsDataPath)) {
        try {
            subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));
        } catch (e) {
            console.error('Subscriptions parse error:', e);
        }
    }

    // 既存のサブスクリプションを探す
    const existingIndex = subscriptions.findIndex(s => s.endpoint === subscription.endpoint);

    const newSubData = {
        ...subscription,
        userId: userId,           // ユーザーIDを紐付け
        employeeCode: employeeCode, // 従業員コードも念のため
        updatedAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
        // 更新（ユーザー情報が変わった可能性があるので上書き）
        subscriptions[existingIndex] = newSubData;
        fs.writeFileSync(subscriptionsDataPath, JSON.stringify(subscriptions, null, 2));
        return true;
    } else {
        // 新規追加
        subscriptions.push(newSubData);
        fs.writeFileSync(subscriptionsDataPath, JSON.stringify(subscriptions, null, 2));
        return true;
    }
}

// サブスクリプション削除関数
function removeSubscription(endpoint) {
    if (fs.existsSync(subscriptionsDataPath)) {
        try {
            let subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));
            const initialLength = subscriptions.length;
            subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
            if (subscriptions.length !== initialLength) {
                fs.writeFileSync(subscriptionsDataPath, JSON.stringify(subscriptions, null, 2));
                return true;
            }
        } catch (e) {
            console.error('Subscriptions parse error during removal:', e);
        }
    }
    return false;
}

app.post('/api/push/subscribe', (req, res) => {
    // クライアントからのリクエストボディを解析
    const body = req.body;

    // サブスクリプションオブジェクトを取得（構造によって場所が違う可能性を考慮）
    const subscription = body.subscription || body;

    // ユーザー情報を取得
    const userId = body.userId || (req.session ? req.session.userId : null);
    const employeeCode = body.employeeCode || (req.session ? req.session.employeeCode : null);

    // 純粋なSubscriptionオブジェクトを作成（余計なプロパティを除去）
    const cleanSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys
    };

    if (subscription && subscription.endpoint) {
        if (saveSubscription(cleanSubscription, userId, employeeCode)) {
            res.status(201).json({ success: true, message: 'サブスクリプションを保存しました。' });
        } else {
            res.status(200).json({ success: true, message: '更新しました。' });
        }
    } else {
        res.status(400).json({ success: false, message: '無効なリクエストです。' });
    }
});

app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (removeSubscription(endpoint)) {
        res.json({ success: true, message: 'サブスクリプションを解除しました。' });
    } else {
        res.status(404).json({ success: false, message: 'サブスクリプションが見つかりません。' });
    }
});

// プッシュ通知送信API (管理者用)
app.post('/api/push/send', requireAdmin, (req, res) => {
    const { title, body, icon, url, severity } = req.body;

    if (!fs.existsSync(subscriptionsDataPath)) {
        return res.status(404).json({ success: false, message: '有効な登録者がいません。' });
    }

    const subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));
    const payload = JSON.stringify({
        title: title || 'トレーニングアプリ',
        body: body || '新しいお知らせがあります',
        icon: icon || '/quiz-app/lawson_logo.png',
        url: url || '/quiz-app/index.html',
        severity: severity || 'info'
    });

    const results = {
        total: subscriptions.length,
        success: 0,
        failure: 0
    };

    const pushPromises = subscriptions.map(sub => {
        return webpush.sendNotification(sub, payload)
            .then(() => {
                results.success++;
            })
            .catch(err => {
                console.error('Push error:', err.endpoint, err.statusCode);
                results.failure++;
                // 期限切れや無効なトークンを自動削除する（404, 410）
                if (err.statusCode === 404 || err.statusCode === 410) {
                    removeSubscription(sub.endpoint);
                }
            });
    });

    Promise.all(pushPromises).then(() => {
        res.json({ success: true, results });
    });
});

// 特定ユーザーへのプッシュ通知送信API (管理者用)
app.post('/api/push/send-user', requireAdmin, (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ success: false, message: 'ユーザーIDとメッセージは必須です。' });
    }

    if (!fs.existsSync(subscriptionsDataPath)) {
        return res.status(404).json({ success: false, message: '有効な登録者がいません。' });
    }

    const subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));

    // 対象ユーザーのサブスクリプションを抽出
    const userSubscriptions = subscriptions.filter(sub => sub.userId === userId);

    if (userSubscriptions.length === 0) {
        return res.status(404).json({ success: false, message: 'このユーザーはプッシュ通知を許可していません（またはデータが見つかりません）。' });
    }

    const payload = JSON.stringify({
        title: '管理者からのメッセージ',
        body: message,
        icon: '/quiz-app/lawson_logo.png',
        url: '/quiz-app/index.html',
        severity: 'info'
    });

    const results = {
        total: userSubscriptions.length,
        success: 0,
        failure: 0
    };

    const pushPromises = userSubscriptions.map(sub => {
        return webpush.sendNotification(sub, payload)
            .then(() => {
                results.success++;
            })
            .catch(err => {
                console.error('User Push error:', err.endpoint, err.statusCode);
                results.failure++;
                // 404/410なら削除
                if (err.statusCode === 404 || err.statusCode === 410) {
                    removeSubscription(sub.endpoint);
                }
            });
    });

    Promise.all(pushPromises).then(() => {
        if (results.success > 0) {
            res.json({ success: true, message: `${results.success}件のデバイスに送信しました。` });
        } else {
            res.status(500).json({ success: false, message: '送信に失敗しました。ユーザーが通知を拒否している可能性があります。' });
        }
    });
});

// プッシュ通知のステータス確認API (管理者用)
app.get('/api/push/status', requireAdmin, (req, res) => {
    if (!fs.existsSync(subscriptionsDataPath)) {
        return res.json({ success: true, count: 0 });
    }
    try {
        const subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));
        res.json({ success: true, count: subscriptions.length });
    } catch (e) {
        res.status(500).json({ success: false, message: 'データ読み込みエラー' });
    }
});

// テスト通知送信API (管理者用)
app.post('/api/push/send-test', requireAdmin, (req, res) => {
    if (!fs.existsSync(subscriptionsDataPath)) {
        return res.status(404).json({ success: false, message: '有効な登録者がいません。' });
    }

    const subscriptions = JSON.parse(fs.readFileSync(subscriptionsDataPath, 'utf8'));
    // テスト用のペイロード
    const payload = JSON.stringify({
        title: 'テスト通知',
        body: 'これはプッシュ通知のテストです。正しく表示されていますか？',
        icon: '/quiz-app/lawson_logo.png',
        url: '/quiz-app/index.html',
        severity: 'info'
    });

    const results = { count: subscriptions.length, success: 0, failure: 0 };
    const pushPromises = subscriptions.map(sub => {
        return webpush.sendNotification(sub, payload)
            .then(() => results.success++)
            .catch(err => {
                console.error('Test Push error:', err.statusCode);
                results.failure++;
                if (err.statusCode === 404 || err.statusCode === 410) {
                    removeSubscription(sub.endpoint);
                }
            });
    });

    Promise.all(pushPromises).then(() => {
        res.json({ success: true, results });
    });
});

// ========================================
// 管理者用ユーザー管理API
// ========================================
require('./admin-api')(app, usersDataPath, learningHistoryPath, quizDataPath);

// ========================================
// 翻訳用API（Gemini）
// ========================================
require('./translate-api')(app, DATA_DIR);

// ========================================
// バックアップダウンロード用API
// ========================================
app.get('/api/backup', (req, res) => {
    // データが保存されているファイルのパスを取得
    const dataPath = path.join(DATA_DIR, 'quiz-data.json');

    // ファイルをユーザーにダウンロードさせる
    // ダウンロード時のファイル名を 'quiz-data-backup-YYYY-MM-DD.json' の形式にする
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const backupFilename = `quiz-data-backup-${formattedDate}.json`;

    res.download(dataPath, backupFilename, (err) => {
        if (err) {
            console.error('バックアップのダウンロード中にエラーが発生しました:', err);
            // エラーが発生しても、クライアント側ではダウンロード失敗として処理されるため、
            // ここでレスポンスを送信しようとすると二重送信エラーになる可能性がある。
            // サーバー側のログに記録するだけで十分。
        }
    });
});

// マイグレーション実行（DB初期化・更新）
const runMigrations = require('./migrate');
runMigrations().then(() => {
    app.listen(port, () => {
        console.log(`========================================`);
        console.log(`サーバーがポート ${port} で起動しました。`);
        console.log(`データ保存先: ${quizDataPath}`);
        console.log(`画像保存先: ${uploadPath}`);
        console.log(`Disk機能: ${process.env.RENDER_DISK_MOUNT_PATH ? '有効 (/data)' : '無効 (ローカル)'}`);
        console.log(`========================================`);
    });
});
    });
