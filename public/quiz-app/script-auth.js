// ========================================
// ユーザー認証統合機能
// ========================================

// グローバルな現在のユーザー情報
let currentUser = null;
let isGuestMode = false;

// ページ読み込み時にユーザー情報を取得
async function initializeAuth() {
    // URLパラメータでゲストモードかチェック
    const urlParams = new URLSearchParams(window.location.search);
    isGuestMode = urlParams.get('guest') === 'true';

    if (isGuestMode) {
        // ゲストモードの場合
        console.log('ゲストモードで起動しました');
        window.isGuestMode = true;
        window.currentUser = null;
        showGuestUI();
        return null;
    }

    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.loggedIn && data.user) {
            currentUser = data.user;
            window.currentUser = currentUser;
            window.isGuestMode = false;
            console.log('ログイン中のユーザー:', currentUser.name);
            showUserUI(currentUser);
            return currentUser;
        } else {
            // 未ログインの場合、ログイン画面にリダイレクト
            window.location.href = '../auth/login.html';
            return null;
        }
    } catch (error) {
        console.error('認証確認エラー:', error);
        // エラーの場合、ログイン画面にリダイレクト
        window.location.href = '../auth/login.html';
        return null;
    }
}

// ユーザーUIを表示
function showUserUI(user) {
    console.log('showUserUI関数が呼ばれました。ユーザー:', user);

    // ユーザー情報バーを表示
    const userInfoBar = document.getElementById('user-info-bar');
    if (userInfoBar) {
        const userName = document.getElementById('user-name');
        if (userName) {
            userName.textContent = user.name;
        }
        userInfoBar.style.display = 'flex';
        console.log('✓ ユーザー情報バーを表示しました');

        // 管理者ボタンの表示制御
        const adminBtn = document.getElementById('admin-panel-btn');
        if (adminBtn) {
            if (user.isAdmin) {
                adminBtn.style.display = 'flex';
                adminBtn.onclick = () => window.location.href = '../admin-tool/admin.html';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    } else {
        console.error('❌ user-info-bar要素が見つかりません');
    }

    // ゲスト情報バーを非表示
    const guestInfoBar = document.getElementById('guest-info-bar');
    if (guestInfoBar) {
        guestInfoBar.style.display = 'none';
    }
}

// ゲストUIを表示
function showGuestUI() {
    // ゲスト情報バーを表示
    const guestInfoBar = document.getElementById('guest-info-bar');
    if (guestInfoBar) {
        guestInfoBar.style.display = 'flex';
    }

    // ユーザー情報バーを非表示
    const userInfoBar = document.getElementById('user-info-bar');
    if (userInfoBar) {
        userInfoBar.style.display = 'none';
    }
}

// ログアウト
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // ログイン画面にリダイレクト
        window.location.href = '../auth/login.html';
    } catch (error) {
        console.error('ログアウトエラー:', error);
        alert('ログアウトに失敗しました。');
    }
}

// 学習記録を保存（ログインユーザーのみ）
async function recordLearning(quizData) {
    // ゲストモードまたは未ログインの場合は保存しない
    if (isGuestMode || !currentUser) {
        console.log('ゲストモードまたは未ログインのため、学習記録は保存されません');
        return false;
    }

    try {
        const response = await fetch('/api/learning/record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(quizData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('学習記録を保存しました');
            return true;
        } else {
            console.error('学習記録の保存に失敗しました:', data.message);
            return false;
        }
    } catch (error) {
        console.error('学習記録保存エラー:', error);
        return false;
    }
}

// イベントリスナーを設定
function setupAuthEventListeners() {
    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // ログインリダイレクトボタン（ゲストモード用）
    const loginRedirectBtn = document.getElementById('login-redirect-btn');
    if (loginRedirectBtn) {
        loginRedirectBtn.addEventListener('click', () => {
            window.location.href = '../auth/login.html';
        });
    }

    // 学習履歴ボタン
    const viewHistoryBtn = document.getElementById('view-history-btn');
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            window.location.href = '../auth/history.html';
        });
    }

    // パスワード変更モーダル制御
    const passwordModal = document.getElementById('user-password-change-modal');
    const openModalBtn = document.getElementById('open-user-password-modal-btn');
    const closeModalBtn = document.getElementById('close-user-password-modal-btn');
    const savePasswordBtn = document.getElementById('save-player-password-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            passwordModal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            passwordModal.style.display = 'none';
        });
    }

    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById('new-player-password').value;
            const confirmPassword = document.getElementById('confirm-player-password').value;

            if (!newPassword || newPassword.length < 4) {
                alert('パスワードは4文字以上で入力してください。');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('パスワードが一致しません。');
                return;
            }

            try {
                const response = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword }),
                    credentials: 'include'
                });

                const data = await response.json();
                if (data.success) {
                    alert('パスワードを変更しました。');
                    passwordModal.style.display = 'none';
                    document.getElementById('new-player-password').value = '';
                    document.getElementById('confirm-player-password').value = '';
                } else {
                    alert('変更失敗: ' + data.message);
                }
            } catch (error) {
                console.error('Password change error:', error);
                alert('通信エラーが発生しました。');
            }
        });
    }
}

// エクスポート（グローバルで使用できるように）
window.initializeAuth = initializeAuth;
window.recordLearning = recordLearning;
window.logout = logout;
window.setupAuthEventListeners = setupAuthEventListeners;
// 初期値を設定
window.currentUser = null;
window.isGuestMode = false;
