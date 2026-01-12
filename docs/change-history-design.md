# 変更履歴追跡システム設計

## 1. 目的

データの変更履歴を追跡することで、以下を実現する:

- デバッグの容易化
- データの整合性検証
- 監査ログの提供
- 将来的なUndo/Redo機能の実装基盤

## 2. データ構造

### 2.1 変更履歴エントリ

```javascript
{
  id: "change_1234567890123",      // 変更ID（タイムスタンプベース）
  timestamp: 1234567890123,         // 変更時刻（Unix timestamp）
  type: "ADD_MAIN_CATEGORY",        // 変更タイプ
  target: {                         // 変更対象
    type: "mainCategory",           // 対象タイプ
    id: "main_1234567890123",       // 対象ID
    name: "新しい大カテゴリ"        // 対象名（表示用）
  },
  data: {                           // 変更データ
    // 変更タイプに応じた詳細データ
  },
  user: "admin"                     // 変更者（将来的に実装）
}
```

### 2.2 変更タイプ

| 変更タイプ | 説明 | データ構造 |
|-----------|------|-----------|
| `ADD_MAIN_CATEGORY` | 大カテゴリ追加 | `{ mainCategory: {...} }` |
| `REMOVE_MAIN_CATEGORY` | 大カテゴリ削除 | `{ mainCategoryId: "..." }` |
| `ADD_SUB_CATEGORY` | 小カテゴリ追加 | `{ mainCategoryId: "...", subCategory: {...} }` |
| `REMOVE_SUB_CATEGORY` | 小カテゴリ削除 | `{ subCategoryId: "..." }` |
| `ADD_QUESTION` | 問題追加 | `{ subCategoryId: "...", question: {...} }` |
| `REMOVE_QUESTION` | 問題削除 | `{ subCategoryId: "...", questionIndex: 0 }` |
| `REORDER_QUESTION` | 問題並び替え | `{ subCategoryId: "...", oldIndex: 0, newIndex: 1 }` |
| `UPDATE_SUB_CATEGORY` | 小カテゴリ更新 | `{ subCategoryId: "...", updates: {...} }` |

## 3. 変更履歴管理クラス

```javascript
class ChangeHistoryManager {
  constructor() {
    this.history = [];
    this.maxHistorySize = 100; // 最大保存件数
  }
  
  // 変更を記録
  recordChange(type, target, data) {
    const change = {
      id: `change_${Date.now()}`,
      timestamp: Date.now(),
      type: type,
      target: target,
      data: data,
      user: "admin"
    };
    
    this.history.push(change);
    
    // 最大件数を超えた場合、古い履歴を削除
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    console.log(`[変更履歴] ${type}:`, target, data);
    
    return change;
  }
  
  // 変更履歴を取得
  getHistory(limit = 10) {
    return this.history.slice(-limit).reverse();
  }
  
  // 変更履歴をクリア
  clearHistory() {
    this.history = [];
  }
  
  // 変更履歴をエクスポート
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }
}
```

## 4. データ操作関数との統合

各データ操作関数で、変更履歴を記録する:

```javascript
function addMainCategoryToData(mainCategoryData) {
  allData.mainCategories.push(mainCategoryData);
  markUnsaved();
  
  // 変更履歴を記録
  changeHistoryManager.recordChange(
    'ADD_MAIN_CATEGORY',
    {
      type: 'mainCategory',
      id: mainCategoryData.id,
      name: mainCategoryData.name
    },
    { mainCategory: mainCategoryData }
  );
  
  console.log('大カテゴリを追加:', mainCategoryData);
}
```

## 5. UI実装

### 5.1 変更履歴パネル

管理画面に「変更履歴」ボタンを追加し、クリックすると変更履歴パネルを表示する:

```html
<div id="change-history-panel" style="display: none;">
  <h3>変更履歴</h3>
  <div id="change-history-list">
    <!-- 変更履歴のリスト -->
  </div>
  <button id="clear-history-btn">履歴をクリア</button>
  <button id="export-history-btn">履歴をエクスポート</button>
  <button id="close-history-btn">閉じる</button>
</div>
```

### 5.2 変更履歴の表示

各変更履歴エントリを以下の形式で表示する:

```
[2024-11-01 23:45:12] 大カテゴリを追加: 「最終テスト1101」
[2024-11-01 23:45:23] 小カテゴリを追加: 「最終テスト小カテゴリ」（最終テスト1101）
[2024-11-01 23:45:34] 保存完了
```

## 6. 実装の優先順位

1. **Phase 1**: 変更履歴管理クラスの実装
2. **Phase 2**: データ操作関数への変更履歴記録の追加
3. **Phase 3**: 変更履歴パネルのUI実装
4. **Phase 4**: 変更履歴のエクスポート機能

## 7. 将来的な拡張

- **Undo/Redo機能**: 変更履歴を使って元に戻す・やり直す機能を実装
- **変更の差分表示**: 変更前後のデータを比較表示
- **フィルタリング**: 変更タイプや対象でフィルタリング
- **永続化**: 変更履歴をローカルストレージやサーバーに保存

