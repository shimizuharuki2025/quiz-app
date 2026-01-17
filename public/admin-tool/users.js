// users.js - ユーザー管理ツールのロジック
document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const adminContent = document.getElementById('admin-content');
    const authContainer = document.getElementById('auth-container');
    const userListBody = document.getElementById('user-list-body');
    const loadingSpinner = document.getElementById('loading-spinner');
    const userTableContainer = document.getElementById('user-table-container');

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
                renderUserList(data.users);
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

    // ユーザー一覧の描画
    function renderUserList(users) {
        userListBody.innerHTML = '';

        if (users.length === 0) {
            userListBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">ユーザーが登録されていません。</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            const isBanned = user.isBanned || false;

            tr.innerHTML = `
                <td>${user.employeeCode}</td>
                <td>${user.name}</td>
                <td>${user.storeCode}</td>
                <td>
                    <span class="status-badge ${isBanned ? 'status-banned' : 'status-active'}">
                        ${isBanned ? 'バン済み' : '有効'}
                    </span>
                </td>
                <td>
                    <div class="stats-info">学習数: ${user.statistics.totalQuizzes}回</div>
                    <div class="stats-info">最高点: ${user.statistics.bestScore}点</div>
                </td>
                <td>
                    <div class="action-btns">
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
        document.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = () => openEditModal(btn.dataset.id));
        document.querySelectorAll('.ban-btn').forEach(btn => btn.onclick = () => toggleBan(btn.dataset.id, btn.dataset.banned === 'true'));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = () => deleteUser(btn.dataset.id));
    }

    // バン切り替え
    async function toggleBan(userId, currentBanned) {
        const action = currentBanned ? 'unban' : 'ban';
        const actionText = currentBanned ? '解除' : 'バン（停止）';

        showCustomConfirm(`ユーザーを${actionText}しますか？`, async () => {
            try {
                const response = await fetch(`/api/admin/users/${userId}/${action}`, { method: 'PUT' });
                const data = await response.json();
                if (data.success) {
                    loadUsers();
                } else {
                    alert('エラー: ' + data.message);
                }
            } catch (error) {
                console.error('Ban error:', error);
                alert('通信に失敗しました。');
            }
        });
    }

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
            password: document.getElementById('edit-user-password').value // パスワードを追加
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

    document.getElementById('close-modal-btn').onclick = () => {
        document.getElementById('edit-user-modal').style.display = 'none';
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
