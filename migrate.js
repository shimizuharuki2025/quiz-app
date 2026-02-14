const db = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    console.log('🔄 データベースマイグレーションを開始します...');
    try {
        // 1. usersテーブルの作成
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                employee_code VARCHAR(255) UNIQUE NOT NULL,
                store_code VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_banned BOOLEAN DEFAULT FALSE,
                ban_reason TEXT,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP WITH TIME ZONE,
                memo TEXT
            );
        `);

        // 2. quiz_resultsテーブルの作成
        await db.query(`
            CREATE TABLE IF NOT EXISTS quiz_results (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                category_id VARCHAR(255) NOT NULL,
                category_name VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_answers INTEGER NOT NULL,
                completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                incorrect_questions JSONB,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // 3. インデックスの作成
        await db.query('CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);');
        await db.query('CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at);');
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);');

        // 4. カラム追加（既存テーブルへの変更用）
        await db.query('ALTER TABLE quiz_results ADD COLUMN IF NOT EXISTS incorrect_questions JSONB;');


        console.log('✅ データベースマイグレーションが完了しました。');

        // 5. データ移行（初回のみ）
        await migrateData();

    } catch (error) {
        console.error('❌ マイグレーションエラー:', error);
        // エラーでも起動は続行させる（DB接続エラーなどの場合はAPIコール時に落ちる）
    }
}

async function migrateData() {
    try {
        // ユーザー数が0かチェック
        const countRes = await db.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(countRes.rows[0].count, 10);

        if (userCount > 0) {
            console.log('ℹ️ ユーザーデータが既に存在するため、データ移行をスキップします。');
            return;
        }

        console.log('🔄 JSONファイルからデータベースへのデータ移行を開始します...');

        const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'data');
        const usersPath = path.join(dataDir, 'users.json');
        const historyPath = path.join(dataDir, 'learning-history.json');

        // users.jsonの移行
        if (fs.existsSync(usersPath)) {
            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const users = usersData.users || [];

            for (const user of users) {
                await db.query(`
                    INSERT INTO users (id, employee_code, store_code, name, password_hash, is_banned, ban_reason, is_admin, created_at, last_login_at, memo)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    user.id,
                    user.employeeCode,
                    user.storeCode,
                    user.name,
                    user.passwordHash,
                    user.isBanned || false,
                    user.banReason || null,
                    user.isAdmin || false,
                    user.createdAt || new Date(),
                    user.lastLoginAt || null,
                    user.memo || null
                ]);
            }
            console.log(`✅ ${users.length}件のユーザーを移行しました。`);
        } else {
            console.log('⚠️ users.jsonが見つかりません。');
        }

        // learning-history.jsonの移行
        if (fs.existsSync(historyPath)) {
            const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            let resultCount = 0;

            for (const [userId, data] of Object.entries(historyData)) {
                if (data.quizHistory && Array.isArray(data.quizHistory)) {
                    for (const result of data.quizHistory) {
                        await db.query(`
                            INSERT INTO quiz_results (id, user_id, category_id, category_name, score, total_questions, correct_answers, incorrect_questions, completed_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (id) DO NOTHING
                        `, [
                            result.id,
                            userId,
                            result.categoryId,
                            result.categoryName,
                            result.score,
                            result.totalQuestions || 0,
                            result.correctAnswers || 0,
                            result.incorrectQuestions ? JSON.stringify(result.incorrectQuestions) : null,
                            result.completedAt || new Date()
                        ]);
                        resultCount++;
                    }
                }
            }
            console.log(`✅ ${resultCount}件の学習履歴を移行しました。`);
        } else {
            console.log('⚠️ learning-history.jsonが見つかりません。');
        }

    } catch (error) {
        console.error('❌ データ移行中にエラーが発生しました:', error);
        // データ移行エラーは致命的ではないのでスローしない
    }
}

module.exports = runMigrations;
