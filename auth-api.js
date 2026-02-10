// ========================================
// ユーザー認証API
// ========================================

const bcrypt = require('bcryptjs');
const db = require('./db'); // 新規作成したdb.jsを読み込み

// ミドルウェア：ログインチェック
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'ログインが必要です。' });
    }
    next();
}

// ミドルウェア：管理者チェック（既存の管理者パスワードと統合）
function requireAdmin(req, res, next) {
    // 既存の管理者認証システムと統合
    // ここでは簡易的にセッション内のisAdminフラグでチェック
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ success: false, message: '管理者権限が必要です。' });
    }
    next();
}

module.exports = function (app, usersDataPath, learningHistoryPath) {

    // ========================================
    // 認証API
    // ========================================

    // ユーザー登録
    app.post('/api/auth/register', async (req, res) => {
        const { employeeCode, storeCode, name, password } = req.body;

        // バリデーション
        if (!employeeCode || !storeCode || !name || !password) {
            return res.status(400).json({
                success: false,
                message: '従業員コード、店舗コード、名前、パスワードはすべて必須です。'
            });
        }

        // 従業員コードと店舗コードが数字のみかチェック
        if (!/^\d+$/.test(employeeCode)) {
            return res.status(400).json({
                success: false,
                message: '従業員コードは数字のみで入力してください。'
            });
        }

        if (!/^\d+$/.test(storeCode)) {
            return res.status(400).json({
                success: false,
                message: '店舗コードは数字のみで入力してください。'
            });
        }

        try {
            // 既存ユーザーチェック
            const checkRes = await db.query('SELECT id FROM users WHERE employee_code = $1', [employeeCode]);

            if (checkRes.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'この従業員コードは既に登録されています。'
                });
            }

            // パスワードをハッシュ化
            const passwordHash = await bcrypt.hash(password, 10);

            // 新しいユーザーを作成
            const userId = `user_${Date.now()}`;
            const now = new Date().toISOString();

            await db.query(
                `INSERT INTO users (id, employee_code, store_code, name, password_hash, is_banned, is_admin, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userId, employeeCode, storeCode, name, passwordHash, false, false, now]
            );

            console.log('新しいユーザーが登録されました:', employeeCode);

            const userResponse = {
                id: userId,
                employeeCode,
                storeCode,
                name,
                isBanned: false,
                isAdmin: false,
                createdAt: now
            };

            // パスワードハッシュを除外してレスポンス
            res.json({
                success: true,
                message: 'ユーザー登録が完了しました。',
                user: userResponse
            });

        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ログイン
    app.post('/api/auth/login', async (req, res) => {
        const { employeeCode, password } = req.body;

        // バリデーション
        if (!employeeCode || !password) {
            return res.status(400).json({
                success: false,
                message: '従業員コードとパスワードを入力してください。'
            });
        }

        try {
            // ユーザーを検索
            const result = await db.query('SELECT * FROM users WHERE employee_code = $1', [employeeCode]);
            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '従業員コードまたはパスワードが正しくありません。'
                });
            }

            // バンされているかチェック
            if (user.is_banned) {
                return res.status(403).json({
                    success: false,
                    message: `このアカウントは停止されています。\n理由: ${user.ban_reason || '管理者にお問い合わせください。'}`
                });
            }

            // パスワードを確認
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: '従業員コードまたはパスワードが正しくありません。'
                });
            }

            // 最終ログイン日時を更新
            await db.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [new Date().toISOString(), user.id]);

            // セッションに保存
            req.session.userId = user.id;
            req.session.employeeCode = user.employee_code;
            req.session.name = user.name;
            req.session.storeCode = user.store_code;
            req.session.isAdmin = user.is_admin || false; // 管理者フラグをセッションに保存

            console.log('ユーザーがログインしました:', employeeCode);

            // パスワードハッシュを除外してレスポンス
            const userResponse = {
                id: user.id,
                employeeCode: user.employee_code,
                name: user.name,
                storeCode: user.store_code,
                isAdmin: user.is_admin
            };

            res.json({
                success: true,
                message: 'ログインしました。',
                user: userResponse
            });

        } catch (error) {
            console.error('ログインエラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // パスワード変更
    app.post('/api/auth/change-password', requireAuth, async (req, res) => {
        const userId = req.session.userId;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: '新しいパスワードは4文字以上で入力してください。'
            });
        }

        try {
            // 新しいパスワードをハッシュ化
            const passwordHash = await bcrypt.hash(newPassword, 10);

            await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

            console.log('ユーザーが自身のパスワードを更新しました:', userId);

            res.json({
                success: true,
                message: 'パスワードを変更しました。'
            });

        } catch (error) {
            console.error('パスワード変更エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ログアウト
    app.post('/api/auth/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('ログアウトエラー:', err);
                return res.status(500).json({
                    success: false,
                    message: 'ログアウトに失敗しました。'
                });
            }

            res.json({
                success: true,
                message: 'ログアウトしました。'
            });
        });
    });

    // 現在のユーザー情報取得
    app.get('/api/auth/me', (req, res) => {
        const sessionID = req.sessionID;
        const userId = req.session ? req.session.userId : 'none';
        const isAdmin = req.session ? req.session.isAdmin : false;

        console.log(`[AUTH-DEBUG] /api/auth/me - SessionID: ${sessionID}, UserID: ${userId}, IsAdmin: ${isAdmin}`);

        if (!req.session || !req.session.userId) {
            return res.json({
                success: false,
                loggedIn: false
            });
        }

        try {
            const result = await db.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
            const user = result.rows[0];

            if (!user) {
                req.session.destroy();
                return res.json({
                    success: false,
                    loggedIn: false
                });
            }

            // バンされているかチェック
            if (user.is_banned) {
                req.session.destroy();
                return res.status(403).json({
                    success: false,
                    message: `このアカウントは停止されています。\n理由: ${user.ban_reason || '管理者にお問い合わせください。'}`
                });
            }

            // パスワードハッシュを除外してレスポンス
            const userResponse = {
                id: user.id,
                employeeCode: user.employee_code,
                name: user.name,
                storeCode: user.store_code,
                isAdmin: user.is_admin
            };

            res.json({
                success: true,
                loggedIn: true,
                user: userResponse
            });

        } catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ========================================
    // 学習履歴API
    // ========================================

    // 学習記録を保存
    app.post('/api/learning/record', requireAuth, (req, res) => {
        const userId = req.session.userId;
        const { categoryId, categoryName, score, totalQuestions, correctAnswers } = req.body;

        // バリデーション
        if (!categoryId || !categoryName || score === undefined || !totalQuestions) {
            return res.status(400).json({
                success: false,
                message: '必須パラメータが不足しています。'
            });
        }

        try {
            // 新しいクイズ記録を追加
            const recordId = `history_${Date.now()}`;
            const now = new Date().toISOString();

            await db.query(
                `INSERT INTO quiz_results 
                (id, user_id, category_id, category_name, score, total_questions, correct_answers, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [recordId, userId, categoryId, categoryName, score, totalQuestions, correctAnswers || score, now]
            );

            console.log('学習記録を保存しました:', userId, categoryName);

            res.json({
                success: true,
                message: '学習記録を保存しました。',
                record: { id: recordId, score, completedAt: now }
            });

        } catch (error) {
            console.error('学習記録保存エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // 学習履歴を取得
    app.get('/api/learning/history/:userId', requireAuth, (req, res) => {
        const { userId } = req.params;

        // 自分の履歴のみ取得可能（管理者は後で実装）
        if (req.session.userId !== userId && !req.session.isAdmin) {
            return res.status(403).json({
                success: false,
                message: '他のユーザーの履歴は閲覧できません。'
            });
        }

        try {
            // 履歴を取得（最新100件）
            const result = await db.query(
                `SELECT 
                    id, category_id as "categoryId", category_name as "categoryName", 
                    score, total_questions as "totalQuestions", correct_answers as "correctAnswers", 
                    completed_at as "completedAt"
                 FROM quiz_results 
                 WHERE user_id = $1 
                 ORDER BY completed_at DESC 
                 LIMIT 100`,
                [userId]
            );

            res.json({
                success: true,
                history: {
                    quizHistory: result.rows
                }
            });

        } catch (error) {
            console.error('学習履歴取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // 統計情報を取得
    app.get('/api/learning/statistics/:userId', requireAuth, (req, res) => {
        const { userId } = req.params;

        // 自分の統計のみ取得可能（管理者は後で実装）
        if (req.session.userId !== userId && !req.session.isAdmin) {
            return res.status(403).json({
                success: false,
                message: '他のユーザーの統計は閲覧できません。'
            });
        }

        try {
            // 統計情報を集計
            const result = await db.query(
                `SELECT 
                    COUNT(*) as "totalQuizzes", 
                    COALESCE(AVG(score), 0) as "averageScore", 
                    COALESCE(MAX(score), 0) as "bestScore" 
                 FROM quiz_results 
                 WHERE user_id = $1`,
                [userId]
            );

            const stats = result.rows[0];

            res.json({
                success: true,
                statistics: {
                    totalQuizzes: parseInt(stats.totalQuizzes),
                    averageScore: Math.round(parseFloat(stats.averageScore)),
                    bestScore: parseInt(stats.bestScore)
                }
            });

        } catch (error) {
            console.error('統計情報取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    console.log('✓ ユーザー認証APIと学習履歴APIを初期化しました');
};
