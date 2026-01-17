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
}

// エクスポート（グローバルで使用できるように）
window.initializeAuth = initializeAuth;
window.recordLearning = recordLearning;
window.logout = logout;
window.setupAuthEventListeners = setupAuthEventListeners;
// 初期値を設定
window.currentUser = null;
window.isGuestMode = false;
