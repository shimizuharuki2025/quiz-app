const db = require('./db');

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
    } catch (error) {
        console.error('❌ マイグレーションエラー:', error);
        // エラーでも起動は続行させる（DB接続エラーなどの場合はAPIコール時に落ちる）
    }
}

module.exports = runMigrations;
