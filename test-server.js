const express = require('express');
const app = express();
const PORT = 3000;

console.log('テストサーバーを起動します。');
console.log(`現在のディレクトリ: ${__dirname}`);
console.log('これから "public" フォルダを公開しようと試みます...');

// すべての機能を削ぎ落とし、これだけを実行
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`テストサーバーが http://localhost:${PORT} で起動しました 。`);
    console.log('もしブラウザで "Cannot GET /" と表示されたら、express.staticがあなたの環境で動作していない証拠です。');
});
