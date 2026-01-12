//【確定版 v4】server.js - Disk自動初期化対応 + 画像もDiskに保存
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 10000;

// --- ▼▼▼【Disk機能の設定】▼▼▼ ---
const DATA_DIR = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'public', 'quiz-app');
const quizDataPath = path.join(DATA_DIR, 'quiz-data.json');
const sourceDataPath = path.join(__dirname, 'public', 'quiz-app', 'quiz-data.json');

// 画像保存先もDiskに変更
const uploadPath = process.env.RENDER_DISK_MOUNT_PATH 
    ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'uploads')
    : path.join(__dirname, 'public', 'uploads');

// Diskディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✓ データディレクトリを作成しました: ${DATA_DIR}`);
}

// 画像保存用ディレクトリを作成
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log(`✓ 画像保存ディレクトリを作成しました: ${uploadPath}`);
}

// Diskに quiz-data.json が存在しない場合、初期データをコピー
if (!fs.existsSync(quizDataPath)) {
    if (fs.existsSync(sourceDataPath)) {
        fs.copyFileSync(sourceDataPath, quizDataPath);
        console.log(`✓ 初期データをコピーしました: ${sourceDataPath} → ${quizDataPath}`);
    } else {
        // 初期データも存在しない場合は空のデータを作成
        const emptyData = { mainCategories: [] };
        fs.writeFileSync(quizDataPath, JSON.stringify(emptyData, null, 2), 'utf8');
        console.log(`✓ 空の初期データを作成しました: ${quizDataPath}`);
    }
}
// --- ▲▲▲【ここまで】▲▲▲ ---

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, `image-${Date.now()}-${Math.floor(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// --- ▼▼▼【Diskに保存された画像を配信】▼▼▼ ---
// /uploads/ へのリクエストをDiskの画像ディレクトリから配信
if (process.env.RENDER_DISK_MOUNT_PATH) {
    app.use('/uploads', express.static(uploadPath));
    console.log(`✓ 画像配信パスを設定しました: /uploads → ${uploadPath}`);
}
// --- ▲▲▲【ここまで】▲▲▲ ---

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

app.post('/api/v1/auth/admin', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    if (password === adminPassword) res.json({ authenticated: true });
    else res.status(401).json({ authenticated: false, message: 'パスワードが正しくありません。' });
});

app.listen(port, () => {
    console.log(`========================================`);
    console.log(`サーバーがポート ${port} で起動しました。`);
    console.log(`データ保存先: ${quizDataPath}`);
    console.log(`画像保存先: ${uploadPath}`);
    console.log(`Disk機能: ${process.env.RENDER_DISK_MOUNT_PATH ? '有効 (/data)' : '無効 (ローカル)'}`);
    console.log(`========================================`);
});
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
