# ユーザー認証システム実装ガイド

## 📝 実装概要

K'sプランニングトレーニングツールにユーザー認証システムが追加されました。

### 主な機能

1. **ユーザー登録・ログイン**
   - 従業員コードとパスワードでログイン
   - 店舗コード、名前の登録
   - 数字のみの従業員コード・店舗コード検証

2. **セッション管理**
   - 90日間の有効期限（最終アクセスから自動延長）
   - セキュアなCookie使用

3. **学習履歴管理**
   - クイズ結果の自動保存
   - 統計情報の追跡（総クイズ数、平均スコア、最高スコア）

4. **ゲストモード**
   - ログインなしでクイズ利用可能
   - 学習記録は保存されない

5. **管理者機能**（APIのみ実装済み）
   - ユーザー一覧取得
   - ユーザー情報編集・削除
   - ユーザーのバン・アンバン

## 🚀 使い方

### 初回起動

1. サーバーを起動:
   ```bash
   npm start
   ```

2. ブラウザで以下にアクセス:
   - http://localhost:10000

3. 自動的にログイン画面にリダイレクトされます

### ユーザー登録

1. ログイン画面の「こちら」をクリック
2. 従業員コード、店舗コード、名前、パスワードを入力
3. 「登録する」をクリック
4. 自動的にログイン画面に戻ります

### ログイン

1. 従業員コードとパスワードを入力
2. 「ログイン」をクリック
3. クイズアプリが表示されます

### ゲストモード

1. ログイン画面で「ゲストとして続ける」をクリック
2. ログインなしでクイズを利用できます
3. **注意**: 学習記録は保存されません

## 📂 ファイル構成

### バックエンド

- `server.js` - メインサーバー（セッション管理含む）
- `auth-api.js` - ユーザー認証API
- `admin-api.js` - 管理者用API
- `data/users.json` - ユーザー情報
- `data/learning-history.json` - 学習履歴
- `sessions/` - セッションファイル

### フロントエンド

- `public/index.html` - エントリーポイント（認証チェック）
- `public/auth/login.html` - ログイン画面
- `public/auth/register.html` - 登録画面
- `public/auth/login.js` - ログインロジック
- `public/auth/register.js` - 登録ロジック
- `public/auth/auth.css` - 認証画面スタイル
- `public/quiz-app/script-auth.js` - クイズアプリ認証統合
- `public/quiz-app/index.html` - クイズアプリ（ユーザー情報バー追加）
- `public/quiz-app/script.js` - クイズロジック（学習記録保存追加）

## 🔐 セキュリティ

- パスワードは`bcryptjs`でハッシュ化
- セッションは`httpOnly`Cookie使用
- セッション有効期限: 90日（自動延長）
- 機密データ（users.json, learning-history.json, sessions/）は`.gitignore`に追加済み

## 📊 API エンドポイント

### 認証API

- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### 学習履歴API

- `POST /api/learning/record` - 学習記録保存
- `GET /api/learning/history/:userId` - 学習履歴取得
- `GET /api/learning/statistics/:userId` - 統計情報取得

### 管理者API

- `GET /api/admin/users` - 全ユーザー一覧
- `GET /api/admin/users/:userId` - ユーザー詳細
- `PUT /api/admin/users/:userId` - ユーザー情報更新
- `DELETE /api/admin/users/:userId` - ユーザー削除
- `PUT /api/admin/users/:userId/ban` - ユーザーをバン
- `PUT /api/admin/users/:userId/unban` - ユーザーのバン解除

## 🔄 今後の拡張予定

- [ ] 学習履歴表示画面
- [ ] ユーザープロフィール画面
- [ ] 管理者用ユーザー管理UI
- [ ] パスワードリセット機能
- [ ] ダッシュボード（学習進捗可視化）

## ⚠️ 注意事項

1. **初回デプロイ時**
   - `data`ディレクトリが作成されます
   - `sessions`ディレクトリが作成されます
   - これらは自動生成されます

2. **セッションストア**
   - 現在はファイルベース（`session-file-store`）
   - 本番環境では Redis 等の検討を推奨

3. **バックアップ**
   - `data/users.json`と`data/learning-history.json`の定期バックアップを推奨

## 🐛 トラブルシューティング

### ログインできない

- 従業員コードとパスワードが正しいか確認
- ブラウザのCookieが有効か確認
- サーバーログを確認

### 学習記録が保存されない

- ログイン状態か確認（ゲストモードでは保存されません）
- ブラウザのコンソールでエラーを確認
- サーバーログを確認

### セッションが切れる

- 90日間アクセスがないとセッションが期限切れになります
- 再ログインしてください

## 📞 サポート

問題が発生した場合は、以下を確認してください:
- サーバーログ（`console`出力）
- ブラウザのコンソール（F12で開く）
- ネットワークタブ（APIリクエストの確認）
