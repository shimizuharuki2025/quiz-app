// ========================================
// 管理者用ユーザー管理API
// ========================================

const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db'); // データベース接続


// ミドルウェア：管理者チェック
function requireAdmin(req, res, next) {
    // 1. セッションにisAdminフラグがあるかチェック
    if (req.session && req.session.isAdmin) {
        return next();
    }

    // 認証されていない場合は401、権限がない場合は403
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'ログインが必要です。' });
    }

    return res.status(403).json({
        success: false,
        message: '管理者権限が必要です。'
    });
}

module.exports = function (app, usersDataPath, learningHistoryPath, quizDataPath) {

    // 全ユーザー一覧を取得（管理者専用）
    app.get('/api/admin/users', requireAdmin, async (req, res) => {
        try {
            // ユーザーと学習統計を結合して取得
            const result = await db.query(`
                SELECT u.*, 
                       COUNT(q.id) as total_quizzes, 
                       COALESCE(AVG(q.score), 0) as average_score, 
                       COALESCE(MAX(q.score), 0) as best_score
                FROM users u
                LEFT JOIN quiz_results q ON u.id = q.user_id
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `);

            // 店舗マスタを読み込む
            let storeMaster = [];
            try {
                const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
                storeMaster = quizData.storeMaster || [];
            } catch (e) {
                console.error('店舗マスタの読み込み失敗:', e);
            }

            // 各ユーザーの学習統計を含める
            const usersWithStats = result.rows.map(user => {
                // 店舗名を特定
                const store = storeMaster.find(s => s.code === user.store_code);
                const storeName = store ? store.name : '店舗不明';

                return {
                    id: user.id,
                    employeeCode: user.employee_code,
                    storeCode: user.store_code,
                    name: user.name,
                    isBanned: user.is_banned,
                    banReason: user.ban_reason,
                    isAdmin: user.is_admin,
                    createdAt: user.created_at,
                    lastLoginAt: user.last_login_at,
                    memo: user.memo,
                    storeName,
                    statistics: {
                        totalQuizzes: parseInt(user.total_quizzes),
                        averageScore: Math.round(parseFloat(user.average_score)),
                        bestScore: parseInt(user.best_score)
                    }
                };
            });

            res.json({
                success: true,
                users: usersWithStats
            });

        } catch (error) {
            console.error('ユーザー一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // 店舗マスタを取得
    app.get('/api/admin/stores', requireAdmin, (req, res) => {
        try {
            const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
            res.json({ success: true, stores: quizData.storeMaster || [] });
        } catch (error) {
            res.status(500).json({ success: false, message: '店舗情報の取得に失敗しました。' });
        }
    });

    // 店舗マスタを保存
    app.post('/api/admin/stores', requireAdmin, (req, res) => {
        const { stores } = req.body;
        if (!stores || !Array.isArray(stores)) {
            return res.status(400).json({ success: false, message: '無効な店舗データです。' });
        }

        try {
            const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
            quizData.storeMaster = stores;
            fs.writeFileSync(quizDataPath, JSON.stringify(quizData, null, 2), 'utf8');
            res.json({ success: true, message: '店舗マスタを保存しました。' });
        } catch (error) {
            res.status(500).json({ success: false, message: '店舗マスタの保存に失敗しました。' });
        }
    });

    // 管理者権限を切り替えるAPI
    app.put('/api/admin/users/:userId/admin-status', requireAdmin, async (req, res) => {
        const { userId } = req.params;
        const { isAdmin } = req.body;

        try {
            await db.query(
                'UPDATE users SET is_admin = $1 WHERE id = $2',
                [!!isAdmin, userId]
            );

            console.log(`管理者権限を更新しました: ${userId} -> ${isAdmin}`);
            res.json({ success: true, message: '管理者権限を更新しました。' });
        } catch (error) {
            console.error('管理者権限更新エラー:', error);
            res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
        }
    });

    // 特定ユーザーの詳細情報を取得（管理者専用）
    app.get('/api/admin/users/:userId', requireAdmin, async (req, res) => {
        const { userId } = req.params;

        try {
            // ユーザー情報取得
            const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0];

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            // 履歴取得
            const historyRes = await db.query(`
                SELECT id, category_id as "categoryId", category_name as "categoryName",
                       score, total_questions as "totalQuestions", correct_answers as "correctAnswers",
                       completed_at as "completedAt"
                FROM quiz_results
                WHERE user_id = $1
                ORDER BY completed_at DESC
            `, [userId]);

            res.json({
                success: true,
                user: {
                    id: user.id,
                    employeeCode: user.employee_code,
                    storeCode: user.store_code,
                    name: user.name,
                    isBanned: user.is_banned,
                    isAdmin: user.is_admin,
                    createdAt: user.created_at,
                    lastLoginAt: user.last_login_at,
                    memo: user.memo,
                    history: {
                        quizHistory: historyRes.rows
                    }
                }
            });

        } catch (error) {
            console.error('ユーザー詳細取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ユーザー情報を更新（管理者専用）
    app.put('/api/admin/users/:userId', requireAdmin, async (req, res) => {
        const { userId } = req.params;
        const { employeeCode, storeCode, name } = req.body;

        try {
            // 従業員コードの重複チェック（変更する場合）
            if (employeeCode) {
                const checkRes = await db.query(
                    'SELECT id FROM users WHERE employee_code = $1 AND id != $2',
                    [employeeCode, userId]
                );

                if (checkRes.rows.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'この従業員コードは既に使用されています。'
                    });
                }

                // 数字のみかチェック
                if (!/^\d+$/.test(employeeCode)) {
                    return res.status(400).json({
                        success: false,
                        message: '従業員コードは数字のみで入力してください。'
                    });
                }
            }

            // 店舗コードが数字のみかチェック
            if (storeCode && !/^\d+$/.test(storeCode)) {
                return res.status(400).json({
                    success: false,
                    message: '店舗コードは数字のみで入力してください。'
                });
            }

            // ユーザー情報を更新
            let updateFields = [];
            let values = [];
            let idx = 1;

            if (employeeCode) { updateFields.push(`employee_code = $${idx++}`); values.push(employeeCode); }
            if (storeCode) { updateFields.push(`store_code = $${idx++}`); values.push(storeCode); }
            if (name) { updateFields.push(`name = $${idx++}`); values.push(name); }
            if (req.body.memo !== undefined) { updateFields.push(`memo = $${idx++}`); values.push(req.body.memo); }

            if (req.body.password && req.body.password.length > 0) {
                const passwordHash = await bcrypt.hash(req.body.password, 10);
                updateFields.push(`password_hash = $${idx++}`);
                values.push(passwordHash);
            }

            if (updateFields.length > 0) {
                values.push(userId);
                await db.query(
                    `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${idx}`,
                    values
                );
            }

            // 更新後のデータを取得
            const updatedUserRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
            const updatedUser = updatedUserRes.rows[0];

            console.log('ユーザー情報を更新しました:', userId);

            res.json({
                success: true,
                message: 'ユーザー情報を更新しました。',
                user: {
                    id: updatedUser.id,
                    employeeCode: updatedUser.employee_code,
                    name: updatedUser.name
                }
            });

        } catch (error) {
            console.error('ユーザー情報更新エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ユーザーを削除（管理者専用）
    app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
        const { userId } = req.params;

        try {
            // カスケード削除が設定されている前提、または明示的に削除
            await db.query('DELETE FROM users WHERE id = $1', [userId]);

            console.log('ユーザーを削除しました:', userId);

            res.json({
                success: true,
                message: 'ユーザーを削除しました。'
            });

        } catch (error) {
            console.error('ユーザー削除エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ユーザーをバン（管理者専用）
    app.put('/api/admin/users/:userId/ban', requireAdmin, async (req, res) => {
        const { userId } = req.params;
        const { reason } = req.body;

        try {
            await db.query(
                'UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2',
                [reason || '管理者により停止されました。', userId]
            );

            console.log('ユーザーをバンしました:', userId);

            res.json({
                success: true,
                message: 'ユーザーをバンしました。'
            });

        } catch (error) {
            console.error('ユーザーバンエラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // ユーザーのバンを解除（管理者専用）
    app.put('/api/admin/users/:userId/unban', requireAdmin, async (req, res) => {
        const { userId } = req.params;

        try {
            await db.query('UPDATE users SET is_banned = false, ban_reason = null WHERE id = $1', [userId]);

            console.log('ユーザーのバンを解除しました:', userId);

            res.json({
                success: true,
                message: 'ユーザーのバンを解除しました。'
            });

        } catch (error) {
            console.error('ユーザーバン解除エラー:', error);
            res.status(500).json({
                success: false,
                message: 'サーバーエラーが発生しました。'
            });
        }
    });

    // 全体の学習統計を取得（管理者専用）
    app.get('/api/admin/stats', requireAdmin, async (req, res) => {
        try {
            // 店舗マスタを読み込んでマッピングを作成
            let storeMap = {};
            try {
                if (fs.existsSync(quizDataPath)) {
                    const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
                    if (quizData.storeMaster && Array.isArray(quizData.storeMaster)) {
                        quizData.storeMaster.forEach(store => {
                            storeMap[store.code] = store.name;
                        });
                    }
                }
            } catch (e) {
                console.error('店舗マスタ読込エラー:', e);
            }

            // DBから集計
            const userCountRes = await db.query('SELECT COUNT(*) FROM users');
            const quizCountRes = await db.query('SELECT COUNT(*) FROM quiz_results');
            const avgScoreRes = await db.query('SELECT AVG(score) FROM quiz_results');
            const totalCorrectRes = await db.query('SELECT SUM(correct_answers) FROM quiz_results');
            const totalQuestionsRes = await db.query('SELECT SUM(total_questions) FROM quiz_results');

            // アクティブユーザー（履歴があるユーザー）
            const activeUsersRes = await db.query('SELECT COUNT(DISTINCT user_id) FROM quiz_results');

            const stats = {
                summary: {
                    totalUsers: parseInt(userCountRes.rows[0].count),
                    activeUsers: parseInt(activeUsersRes.rows[0].count),
                    totalPlayCount: parseInt(quizCountRes.rows[0].count),
                    averageScore: Math.round(parseFloat(avgScoreRes.rows[0].avg || 0)),
                    totalCorrectAnswers: parseInt(totalCorrectRes.rows[0].sum || 0),
                    totalQuestions: parseInt(totalQuestionsRes.rows[0].sum || 0)
                },
                categoryStats: {}, // { categoryId: { name, playCount, totalScore, averageScore } }
                storeStats: {},    // { storeCode: { name, activeUsers: Set, playCount, totalScore, averageScore } }
                recentActivity: []
            };

            // カテゴリ別統計
            const catStatsRes = await db.query(`
                SELECT category_id, category_name, 
                       COUNT(*) as play_count, 
                       SUM(score) as total_score, 
                       SUM(correct_answers) as total_correct, 
                       SUM(total_questions) as total_questions
                FROM quiz_results
                GROUP BY category_id, category_name
            `);

            catStatsRes.rows.forEach(row => {
                stats.categoryStats[row.category_id] = {
                    name: row.category_name,
                    playCount: parseInt(row.play_count),
                    totalScore: parseInt(row.total_score),
                    totalCorrect: parseInt(row.total_correct),
                    totalQuestions: parseInt(row.total_questions),
                    averageScore: Math.round(parseInt(row.total_score) / parseInt(row.play_count))
                };
            });

            // 店舗別統計
            const storeStatsRes = await db.query(`
                SELECT u.store_code, 
                       COUNT(q.id) as play_count, 
                       SUM(q.score) as total_score, 
                       COUNT(DISTINCT q.user_id) as active_users
                FROM quiz_results q
                JOIN users u ON q.user_id = u.id
                GROUP BY u.store_code
            `);

            storeStatsRes.rows.forEach(row => {
                const storeName = storeMap[row.store_code] || '店舗不明';
                stats.storeStats[row.store_code] = {
                    name: storeName,
                    activeUsersCount: parseInt(row.active_users),
                    playCount: parseInt(row.play_count),
                    totalScore: parseInt(row.total_score),
                    averageScore: Math.round(parseInt(row.total_score) / parseInt(row.play_count))
                };
            });

            // 最近の活動（最新20件）
            const recentRes = await db.query(`
                SELECT q.*, u.name as user_name, u.employee_code, u.store_code
                FROM quiz_results q
                LEFT JOIN users u ON q.user_id = u.id
                ORDER BY q.completed_at DESC
                LIMIT 20
            `);

            stats.recentActivity = recentRes.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                userName: row.user_name || '不明なユーザー',
                employeeCode: row.employee_code,
                storeName: storeMap[row.store_code] || '店舗不明',
                categoryId: row.category_id,
                categoryName: row.category_name,
                score: row.score,
                completedAt: row.completed_at
            }));

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('統計データ取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '統計データの取得に失敗しました。'
            });
        }
    });

    console.log('✓ 管理者用ユーザー管理APIを初期化しました');
};
