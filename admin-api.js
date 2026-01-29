// ========================================
// 管理者用ユーザー管理API
// ========================================

const fs = require('fs');
const bcrypt = require('bcryptjs');

// ヘルパー関数（auth-api.jsと同じものを再利用）
function readUsers(usersDataPath) {
    if (!fs.existsSync(usersDataPath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(usersDataPath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.users || [];
    } catch (err) {
        console.error('ユーザーデータの読み込みエラー:', err);
        return [];
    }
}

function writeUsers(usersDataPath, users) {
    try {
        fs.writeFileSync(usersDataPath, JSON.stringify({ users }, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('ユーザーデータの保存エラー:', err);
        return false;
    }
}

function readLearningHistory(learningHistoryPath) {
    if (!fs.existsSync(learningHistoryPath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(learningHistoryPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('学習履歴の読み込みエラー:', err);
        return {};
    }
}

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
    app.get('/api/admin/users', requireAdmin, (req, res) => {
        try {
            const users = readUsers(usersDataPath);
            const history = readLearningHistory(learningHistoryPath);

            // 店舗マスタを読み込む
            let storeMaster = [];
            try {
                const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
                storeMaster = quizData.storeMaster || [];
            } catch (e) {
                console.error('店舗マスタの読み込み失敗:', e);
            }

            // 各ユーザーの学習統計を含める
            const usersWithStats = users.map(user => {
                const userHistory = history[user.id] || {
                    totalQuizzes: 0,
                    averageScore: 0,
                    bestScore: 0
                };

                // 店舗名を特定
                const store = storeMaster.find(s => s.code === user.storeCode);
                const storeName = store ? store.name : '店舗不明';

                // パスワードハッシュを除外
                const { passwordHash, ...userWithoutPassword } = user;

                return {
                    ...userWithoutPassword,
                    storeName,
                    statistics: {
                        totalQuizzes: userHistory.totalQuizzes,
                        averageScore: userHistory.averageScore,
                        bestScore: userHistory.bestScore
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
        if (!Array.isArray(stores)) return res.status(400).json({ success: false, message: 'データ形式が不正です。' });

        try {
            const quizData = JSON.parse(fs.readFileSync(quizDataPath, 'utf8'));
            quizData.storeMaster = stores;
            fs.writeFileSync(quizDataPath, JSON.stringify(quizData, null, 2), 'utf8');
            res.json({ success: true, message: '店舗マスタを保存しました。' });
        } catch (error) {
            res.status(500).json({ success: false, message: '店舗マスタの保存に失敗しました。' });
        }
    });

    // 特定ユーザーの詳細情報を取得（管理者専用）
    app.get('/api/admin/users/:userId', requireAdmin, (req, res) => {
        const { userId } = req.params;

        try {
            const users = readUsers(usersDataPath);
            const history = readLearningHistory(learningHistoryPath);

            const user = users.find(u => u.id === userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            const userHistory = history[userId] || {
                totalQuizzes: 0,
                totalScore: 0,
                averageScore: 0,
                bestScore: 0,
                quizHistory: []
            };

            // パスワードハッシュを除外
            const { passwordHash, ...userWithoutPassword } = user;

            res.json({
                success: true,
                user: {
                    ...userWithoutPassword,
                    history: userHistory
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
    app.put('/api/admin/users/:userId', requireAdmin, (req, res) => {
        const { userId } = req.params;
        const { employeeCode, storeCode, name } = req.body;

        try {
            const users = readUsers(usersDataPath);
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            // 従業員コードの重複チェック（変更する場合）
            if (employeeCode && employeeCode !== users[userIndex].employeeCode) {
                const duplicate = users.find(u => u.employeeCode === employeeCode && u.id !== userId);
                if (duplicate) {
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
            if (employeeCode) users[userIndex].employeeCode = employeeCode;
            if (storeCode) users[userIndex].storeCode = storeCode;
            if (name) users[userIndex].name = name;
            if (req.body.memo !== undefined) users[userIndex].memo = req.body.memo;

            // パスワードの変更（新しいパスワードが含まれている場合）
            if (req.body.password && req.body.password.length > 0) {
                const salt = bcrypt.genSaltSync(10);
                users[userIndex].passwordHash = bcrypt.hashSync(req.body.password, salt);
                console.log('ユーザーのパスワードを更新しました:', userId);
            }

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'ユーザー情報の更新に失敗しました。'
                });
            }

            console.log('ユーザー情報を更新しました:', userId);

            // パスワードハッシュを除外してレスポンス
            const { passwordHash, ...userResponse } = users[userIndex];

            res.json({
                success: true,
                message: 'ユーザー情報を更新しました。',
                user: userResponse
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
    app.delete('/api/admin/users/:userId', requireAdmin, (req, res) => {
        const { userId } = req.params;

        try {
            let users = readUsers(usersDataPath);
            const initialLength = users.length;

            users = users.filter(u => u.id !== userId);

            if (users.length === initialLength) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'ユーザーの削除に失敗しました。'
                });
            }

            // 学習履歴も削除（オプション）
            const history = readLearningHistory(learningHistoryPath);
            if (history[userId]) {
                delete history[userId];
                const fs = require('fs');
                fs.writeFileSync(learningHistoryPath, JSON.stringify(history, null, 2), 'utf8');
            }

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
    app.put('/api/admin/users/:userId/ban', requireAdmin, (req, res) => {
        const { userId } = req.params;
        const { reason } = req.body;

        try {
            const users = readUsers(usersDataPath);
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            users[userIndex].isBanned = true;
            users[userIndex].banReason = reason || '管理者により停止されました。';

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'ユーザーのバンに失敗しました。'
                });
            }

            console.log('ユーザーをバンしました:', userId);

            res.json({
                success: true,
                message: 'ユーザーをバンしました。',
                user: users[userIndex]
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
    app.put('/api/admin/users/:userId/unban', requireAdmin, (req, res) => {
        const { userId } = req.params;

        try {
            const users = readUsers(usersDataPath);
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            users[userIndex].isBanned = false;

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'ユーザーのバン解除に失敗しました。'
                });
            }

            console.log('ユーザーのバンを解除しました:', userId);

            res.json({
                success: true,
                message: 'ユーザーのバンを解除しました。',
                user: users[userIndex]
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
    app.get('/api/admin/stats', requireAdmin, (req, res) => {
        try {
            const history = readLearningHistory(learningHistoryPath);
            const users = readUsers(usersDataPath);

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

            const stats = {
                summary: {
                    totalUsers: users.length,
                    activeUsers: 0,
                    totalPlayCount: 0,
                    averageScore: 0,
                    totalCorrectAnswers: 0,
                    totalQuestions: 0
                },
                categoryStats: {}, // { categoryId: { name, playCount, totalScore, averageScore } }
                storeStats: {},    // { storeCode: { name, activeUsers: Set, playCount, totalScore, averageScore } }
                recentActivity: []
            };

            let allHistoryItems = [];
            let userIdsWithHistory = new Set();

            Object.keys(history).forEach(userId => {
                const userStats = history[userId];
                if (userStats.quizHistory && userStats.quizHistory.length > 0) {
                    userIdsWithHistory.add(userId);
                    stats.summary.totalPlayCount += userStats.quizHistory.length;

                    // ユーザー情報を取得
                    const user = users.find(u => u.id === userId);
                    const storeCode = user ? user.storeCode : 'unknown';
                    // 店舗マスタから名前を解決、なければ「店舗不明」
                    const storeName = storeMap[storeCode] || '店舗不明';

                    // 店舗統計の初期化
                    if (!stats.storeStats[storeCode]) {
                        stats.storeStats[storeCode] = {
                            name: storeName,
                            activeUsers: [], // SetはJSON化できないので配列変換用に一時保持、あるいはロジック内で処理
                            activeUserIds: new Set(),
                            playCount: 0,
                            totalScore: 0,
                            averageScore: 0
                        };
                    }
                    stats.storeStats[storeCode].activeUserIds.add(userId);

                    userStats.quizHistory.forEach(item => {
                        allHistoryItems.push({
                            ...item,
                            userId,
                            userName: user ? user.name : '不明なユーザー',
                            employeeCode: user ? user.employeeCode : '',
                            storeName: storeName
                        });

                        // カテゴリ別統計
                        if (!stats.categoryStats[item.categoryId]) {
                            stats.categoryStats[item.categoryId] = {
                                name: item.categoryName,
                                playCount: 0,
                                totalScore: 0,
                                totalCorrect: 0,
                                totalQuestions: 0
                            };
                        }
                        const cat = stats.categoryStats[item.categoryId];
                        cat.playCount++;
                        cat.totalScore += item.score;
                        cat.totalCorrect += item.correctAnswers;
                        cat.totalQuestions += item.totalQuestions;

                        // 店舗別統計（プレイ回数・スコア）
                        const st = stats.storeStats[storeCode];
                        st.playCount++;
                        st.totalScore += item.score;
                    });
                }
            });

            stats.summary.activeUsers = userIdsWithHistory.size;

            if (stats.summary.totalPlayCount > 0) {
                let sumScore = 0;
                let sumCorrect = 0;
                let sumQuestions = 0;

                allHistoryItems.forEach(item => {
                    sumScore += item.score;
                    sumCorrect += item.correctAnswers;
                    sumQuestions += item.totalQuestions;
                });

                stats.summary.averageScore = Math.round(sumScore / stats.summary.totalPlayCount);
                stats.summary.totalCorrectAnswers = sumCorrect;
                stats.summary.totalQuestions = sumQuestions;
            }

            // カテゴリ平均点の計算
            Object.keys(stats.categoryStats).forEach(id => {
                const cat = stats.categoryStats[id];
                cat.averageScore = Math.round(cat.totalScore / cat.playCount);
            });

            // 店舗統計の仕上げ（Setのサイズ取得と平均点計算）
            Object.keys(stats.storeStats).forEach(code => {
                const st = stats.storeStats[code];
                st.activeUsersCount = st.activeUserIds.size;
                delete st.activeUserIds; // JSONレスポンスからSetを削除
                st.averageScore = st.playCount > 0 ? Math.round(st.totalScore / st.playCount) : 0;
            });

            // 最近の活動（最新20件）
            stats.recentActivity = allHistoryItems
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                .slice(0, 20);

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
