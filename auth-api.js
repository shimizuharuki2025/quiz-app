// ========================================
// ユーザー認証API
// ========================================

const fs = require('fs');
const bcrypt = require('bcryptjs');

// ヘルパー関数：ユーザーデータを読み込む
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

// ヘルパー関数：ユーザーデータを保存する
function writeUsers(usersDataPath, users) {
    try {
        fs.writeFileSync(usersDataPath, JSON.stringify({ users }, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('ユーザーデータの保存エラー:', err);
        return false;
    }
}

// ヘルパー関数：学習履歴を読み込む
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

// ヘルパー関数：学習履歴を保存する
function writeLearningHistory(learningHistoryPath, history) {
    try {
        fs.writeFileSync(learningHistoryPath, JSON.stringify(history, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('学習履歴の保存エラー:', err);
        return false;
    }
}

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
            const users = readUsers(usersDataPath);

            // 既存ユーザーチェック
            const existingUser = users.find(u => u.employeeCode === employeeCode);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'この従業員コードは既に登録されています。'
                });
            }

            // パスワードをハッシュ化
            const passwordHash = await bcrypt.hash(password, 10);

            // 新しいユーザーを作成
            const newUser = {
                id: `user_${Date.now()}`,
                employeeCode,
                storeCode,
                name,
                passwordHash,
                isBanned: false,
                createdAt: new Date().toISOString(),
                lastLoginAt: null
            };

            users.push(newUser);

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'ユーザー登録に失敗しました。'
                });
            }

            // 学習履歴を初期化
            const history = readLearningHistory(learningHistoryPath);
            history[newUser.id] = {
                totalQuizzes: 0,
                totalScore: 0,
                averageScore: 0,
                bestScore: 0,
                quizHistory: []
            };
            writeLearningHistory(learningHistoryPath, history);

            console.log('新しいユーザーが登録されました:', employeeCode);

            // パスワードハッシュを除外してレスポンス
            const { passwordHash: _, ...userResponse } = newUser;

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
            const users = readUsers(usersDataPath);

            // ユーザーを検索
            const user = users.find(u => u.employeeCode === employeeCode);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '従業員コードまたはパスワードが正しくありません。'
                });
            }

            // バンされているかチェック
            if (user.isBanned) {
                return res.status(403).json({
                    success: false,
                    message: 'このアカウントは停止されています。管理者にお問い合わせください。'
                });
            }

            // パスワードを確認
            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: '従業員コードまたはパスワードが正しくありません。'
                });
            }

            // 最終ログイン日時を更新
            user.lastLoginAt = new Date().toISOString();
            writeUsers(usersDataPath, users);

            // セッションに保存
            req.session.userId = user.id;
            req.session.employeeCode = user.employeeCode;
            req.session.name = user.name;
            req.session.storeCode = user.storeCode;

            console.log('ユーザーがログインしました:', employeeCode);

            // パスワードハッシュを除外してレスポンス
            const { passwordHash: _, ...userResponse } = user;

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
            const users = readUsers(usersDataPath);
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザーが見つかりません。'
                });
            }

            // 新しいパスワードをハッシュ化
            const passwordHash = await bcrypt.hash(newPassword, 10);
            users[userIndex].passwordHash = passwordHash;

            if (!writeUsers(usersDataPath, users)) {
                return res.status(500).json({
                    success: false,
                    message: 'パスワードの保存に失敗しました。'
                });
            }

            console.log('ユーザーが自身のパスワードを更新しました:', users[userIndex].employeeCode);

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
        if (!req.session || !req.session.userId) {
            return res.json({
                success: false,
                loggedIn: false
            });
        }

        try {
            const users = readUsers(usersDataPath);
            const user = users.find(u => u.id === req.session.userId);

            if (!user) {
                req.session.destroy();
                return res.json({
                    success: false,
                    loggedIn: false
                });
            }

            // バンされているかチェック
            if (user.isBanned) {
                req.session.destroy();
                return res.status(403).json({
                    success: false,
                    message: 'このアカウントは停止されています。'
                });
            }

            // パスワードハッシュを除外してレスポンス
            const { passwordHash: _, ...userResponse } = user;

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
            const history = readLearningHistory(learningHistoryPath);

            // ユーザーの履歴を初期化（存在しない場合）
            if (!history[userId]) {
                history[userId] = {
                    totalQuizzes: 0,
                    totalScore: 0,
                    averageScore: 0,
                    bestScore: 0,
                    quizHistory: []
                };
            }

            // 新しいクイズ記録を追加
            const newRecord = {
                id: `history_${Date.now()}`,
                categoryId,
                categoryName,
                score,
                totalQuestions,
                correctAnswers: correctAnswers || score,
                completedAt: new Date().toISOString()
            };

            history[userId].quizHistory.push(newRecord);

            // 統計を更新
            history[userId].totalQuizzes += 1;
            history[userId].totalScore += score;
            history[userId].averageScore = Math.round(
                history[userId].totalScore / history[userId].totalQuizzes
            );
            history[userId].bestScore = Math.max(history[userId].bestScore, score);

            if (!writeLearningHistory(learningHistoryPath, history)) {
                return res.status(500).json({
                    success: false,
                    message: '学習記録の保存に失敗しました。'
                });
            }

            console.log('学習記録を保存しました:', userId, categoryName);

            res.json({
                success: true,
                message: '学習記録を保存しました。',
                record: newRecord
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
            const history = readLearningHistory(learningHistoryPath);
            const userHistory = history[userId] || {
                totalQuizzes: 0,
                totalScore: 0,
                averageScore: 0,
                bestScore: 0,
                quizHistory: []
            };

            res.json({
                success: true,
                history: userHistory
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
            const history = readLearningHistory(learningHistoryPath);
            const userHistory = history[userId];

            if (!userHistory) {
                return res.json({
                    success: true,
                    statistics: {
                        totalQuizzes: 0,
                        averageScore: 0,
                        bestScore: 0
                    }
                });
            }

            res.json({
                success: true,
                statistics: {
                    totalQuizzes: userHistory.totalQuizzes,
                    averageScore: userHistory.averageScore,
                    bestScore: userHistory.bestScore
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
