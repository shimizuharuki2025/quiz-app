// users.js - ユーザー管理ツールのロジック
document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const adminContent = document.getElementById('admin-content');
    const authContainer = document.getElementById('auth-container');
    const userListBody = document.getElementById('user-list-body');
    const loadingSpinner = document.getElementById('loading-spinner');
    const userTableContainer = document.getElementById('user-table-container');
    const searchInput = document.getElementById('user-search-input');
    const sortSelect = document.getElementById('user-sort-select');

    let allUsers = []; // 全ユーザー（検索・ソート用）
    let currentFilteredUsers = [];

    // 認証処理
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password-input').value;
        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = '';

        try {
            const response = await fetch('/api/v1/auth/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            if (response.ok && data.authenticated) {
                authContainer.style.display = 'none';
                adminContent.style.display = 'block';
                loadUsers();
            } else {
                messageEl.textContent = data.message || '認証に失敗しました。';
            }
        } catch (error) {
            console.error('Auth error:', error);
            messageEl.textContent = '通信エラーが発生しました。';
        }
    });

    // ユーザー一覧の読み込み
    async function loadUsers() {
        loadingSpinner.style.display = 'block';
        userTableContainer.style.display = 'none';

        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();

            if (data.success) {
                allUsers = data.users;
                applySearchAndSort();
            } else {
                alert('ユーザー一覧の取得に失敗しました: ' + data.message);
            }
        } catch (error) {
            console.error('Fetch users error:', error);
            alert('ユーザー一覧の取得中にエラーが発生しました。');
        } finally {
            loadingSpinner.style.display = 'none';
            userTableContainer.style.display = 'block';
        }
    }

    // 検索とソートを適用
    function applySearchAndSort() {
        const query = searchInput.value.toLowerCase();
        const sortType = sortSelect.value;

        // 検索フィルタリング
        currentFilteredUsers = allUsers.filter(user => {
            return (
                user.name.toLowerCase().includes(query) ||
                user.employeeCode.includes(query) ||
                user.storeCode.includes(query) ||
                (user.storeName && user.storeName.toLowerCase().includes(query))
            );
        });

        // サーバー側の統計データを利用してソート
        currentFilteredUsers.sort((a, b) => {
            switch (sortType) {
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'name':
                    return a.name.localeCompare(b.name, 'ja');
                case 'play-count':
                    return b.statistics.totalQuizzes - a.statistics.totalQuizzes;
                case 'store':
                    return a.storeCode.localeCompare(b.storeCode);
                case 'newest':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        renderUserList(currentFilteredUsers);
    }

    searchInput.addEventListener('input', applySearchAndSort);
    sortSelect.addEventListener('change', applySearchAndSort);

    // ユーザー一覧の描画
    function renderUserList(users) {
        userListBody.innerHTML = '';

        if (users.length === 0) {
            userListBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ユーザーが見つかりません。</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            const isBanned = user.isBanned || false;

            tr.innerHTML = `
                <td>${user.employeeCode}</td>
                <td>${user.name}</td>
                <td>${user.storeCode}</td>
                <td>${user.storeName || '店舗不明'}</td>
                <td>
                    <span class="status-badge ${isBanned ? 'status-banned' : 'status-active'}" title="${isBanned ? '理由: ' + (user.banReason || 'なし') : ''}">
                        ${isBanned ? 'バン済み' : '有効'}
                    </span>
                </td>
                <td>
                    <div class="stats-info">学習数: ${user.statistics.totalQuizzes}回</div>
                    <div class="stats-info">最高点: ${user.statistics.bestScore}点</div>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-primary btn-small history-btn" data-id="${user.id}">履歴</button>
                        <button class="btn-secondary btn-small edit-btn" data-id="${user.id}">編集</button>
                        <button class="${isBanned ? 'btn-primary' : 'btn-danger'} btn-small ban-btn" data-id="${user.id}" data-banned="${isBanned}">
                            ${isBanned ? '解除' : 'バン'}
                        </button>
                        <button class="btn-danger btn-small delete-btn" data-id="${user.id}">削除</button>
                    </div>
                </td>
            `;
            userListBody.appendChild(tr);
        });

        // ボタンイベントの設定
        document.querySelectorAll('.history-btn').forEach(btn => btn.onclick = () => openHistoryModal(btn.dataset.id));
        document.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = () => openEditModal(btn.dataset.id));
        document.querySelectorAll('.ban-btn').forEach(btn => btn.onclick = () => toggleBan(btn.dataset.id, btn.dataset.banned === 'true'));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = () => deleteUser(btn.dataset.id));
    }

    // 学習履歴モーダル
    async function openHistoryModal(userId) {
        const modal = document.getElementById('user-history-modal');
        const listBody = document.getElementById('user-history-body');
        const noHistory = document.getElementById('no-history-message');
        const title = document.getElementById('history-modal-title');

        listBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">読み込み中...</td></tr>';
        noHistory.style.display = 'none';
        modal.style.display = 'flex';

        try {
            const response = await fetch(`/api/admin/users/${userId}`);
            const data = await response.json();

            if (data.success) {
                const user = data.user;
                title.textContent = `${user.name} さんの学習履歴`;
                const history = user.history.quizHistory || [];

                if (history.length === 0) {
                    listBody.innerHTML = '';
                    noHistory.style.display = 'block';
                } else {
                    listBody.innerHTML = '';
                    // 新しい順に並べる
                    const sortedHistory = [...history].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

                    sortedHistory.forEach(item => {
                        const date = new Date(item.completedAt).toLocaleString('ja-JP');
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${date}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.categoryName}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${item.score >= 80 ? '#4caf50' : '#333'}">${item.score}点</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.correctAnswers} / ${item.totalQuestions}</td>
                        `;
                        listBody.appendChild(tr);
                    });
                }
            } else {
                listBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">データの取得に失敗しました。</td></tr>';
            }
        } catch (error) {
            console.error('History fetch error:', error);
            listBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">通信エラーが発生しました。</td></tr>';
        }
    }

    document.getElementById('close-history-modal-btn').onclick = () => {
        document.getElementById('user-history-modal').style.display = 'none';
    };

    // バン切り替え（理由入力付き）
    let currentBanTargetId = null;

    function toggleBan(userId, currentBanned) {
        if (currentBanned) {
            // 解除は確認のみ
            showCustomConfirm('このユーザーの利用停止を解除しますか？', async () => {
                try {
                    const response = await fetch(`/api/admin/users/${userId}/unban`, { method: 'PUT' });
                    const data = await response.json();
                    if (data.success) loadUsers();
                } catch (e) {
                    alert('解除に失敗しました。');
                }
            });
        } else {
            // バンは理由を入力
            currentBanTargetId = userId;
            document.getElementById('ban-reason-input').value = '';
            document.getElementById('ban-reason-modal').style.display = 'flex';
        }
    }

    document.getElementById('confirm-ban-btn').onclick = async () => {
        const reason = document.getElementById('ban-reason-input').value;
        try {
            const response = await fetch(`/api/admin/users/${currentBanTargetId}/ban`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('ban-reason-modal').style.display = 'none';
                loadUsers();
            } else {
                alert('エラー: ' + data.message);
            }
        } catch (e) {
            alert('通信に失敗しました。');
        }
    };

    document.getElementById('close-ban-modal-btn').onclick = () => {
        document.getElementById('ban-reason-modal').style.display = 'none';
    };

    // ユーザー削除
    async function deleteUser(userId) {
        showCustomConfirm('このユーザーを完全に削除しますか？\n学習履歴も同時に削除される可能性があります。', async () => {
            try {
                const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                    loadUsers();
                } else {
                    alert('削除に失敗しました: ' + data.message);
                }
            } catch (error) {
                console.error('Delete error:', error);
                alert('通信に失敗しました。');
            }
        });
    }

    // 編集モーダル
    async function openEditModal(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`);
            const data = await response.json();
            if (data.success) {
                const user = data.user;
                document.getElementById('edit-user-id').value = user.id;
                document.getElementById('edit-employee-code').value = user.employeeCode;
                document.getElementById('edit-store-code').value = user.storeCode;
                document.getElementById('edit-user-name').value = user.name;
                document.getElementById('edit-user-password').value = ''; // 常にクリアしておく
                document.getElementById('edit-user-memo').value = user.memo || ''; // メモをセット
                document.getElementById('edit-user-modal').style.display = 'flex';
            }
        } catch (error) {
            console.error('Edit modal error:', error);
        }
    }

    document.getElementById('save-user-btn').onclick = async () => {
        const userId = document.getElementById('edit-user-id').value;
        const payload = {
            employeeCode: document.getElementById('edit-employee-code').value,
            storeCode: document.getElementById('edit-store-code').value,
            name: document.getElementById('edit-user-name').value,
            password: document.getElementById('edit-user-password').value, // パスワードを追加
            memo: document.getElementById('edit-user-memo').value // メモを追加
        };

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('edit-user-modal').style.display = 'none';
                loadUsers();
            } else {
                alert('更新失敗: ' + data.message);
            }
        } catch (error) {
            console.error('Save user error:', error);
        }
    };

    document.getElementById('close-user-modal-btn').onclick = () => {
        document.getElementById('edit-user-modal').style.display = 'none';
    };

    // --- 店舗マスタ管理 ---
    const storesModal = document.getElementById('stores-modal');
    const storeListBody = document.getElementById('store-list-body');

    document.getElementById('open-stores-btn').onclick = async () => {
        renderStoreList(); // まずはモーダルを開いてから
        storesModal.style.display = 'flex';

        try {
            const res = await fetch('/api/admin/stores');
            const data = await res.json();
            if (data.success) {
                renderStoreList(data.stores);
            }
        } catch (e) {
            console.error('店舗マスタ取得エラー:', e);
        }
    };

    function renderStoreList(stores = []) {
        storeListBody.innerHTML = '';
        if (stores.length === 0) {
            addStoreRow(); // 最初から1行出す
        } else {
            stores.forEach(s => addStoreRow(s.code, s.name));
        }
    }

    function addStoreRow(code = '', name = '') {
        const div = document.createElement('div');
        div.className = 'store-item';
        div.innerHTML = `
            <input type="text" placeholder="コード (例: 001)" value="${code}" style="width: 100px;">
            <input type="text" placeholder="店舗名 (例: 新宿店)" value="${name}" style="flex: 1;">
            <button class="btn-danger btn-small delete-store-row">削除</button>
        `;
        div.querySelector('.delete-store-row').onclick = () => div.remove();
        storeListBody.appendChild(div);
    }

    document.getElementById('add-store-row-btn').onclick = () => addStoreRow();

    document.getElementById('save-stores-btn').onclick = async () => {
        const rows = storeListBody.querySelectorAll('.store-item');
        const stores = Array.from(rows).map(row => {
            const inputs = row.querySelectorAll('input');
            return { code: inputs[0].value, name: inputs[1].value };
        }).filter(s => s.code && s.name); // 両方空でないもののみ

        try {
            const res = await fetch('/api/admin/stores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stores })
            });
            const data = await res.json();
            if (data.success) {
                alert('店舗マスタを更新しました。');
                storesModal.style.display = 'none';
                loadUsers(); // 店舗名表示を更新するために再読み込み
            }
        } catch (e) {
            alert('保存に失敗しました。');
        }
    };

    document.getElementById('close-stores-btn').onclick = () => {
        storesModal.style.display = 'none';
    };

    // カスタム確認ダイアログ
    function showCustomConfirm(message, onOk) {
        const overlay = document.getElementById('custom-confirm-overlay');
        const messageEl = document.getElementById('custom-confirm-message');
        const okBtn = document.getElementById('custom-confirm-ok');
        const cancelBtn = document.getElementById('custom-confirm-cancel');

        messageEl.textContent = message;
        overlay.classList.remove('custom-confirm-hidden');

        const close = () => overlay.classList.add('custom-confirm-hidden');

        okBtn.onclick = () => { onOk(); close(); };
        cancelBtn.onclick = close;
    }
});
