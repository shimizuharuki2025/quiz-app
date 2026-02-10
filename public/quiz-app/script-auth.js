// ========================================
// ユーザー認証統合機能
// ========================================

// グローバルな現在のユーザー情報
let currentUser = null;
let isGuestMode = false;
// let isGuestMode = false; // 削除
// const PUBLIC_VAPID_KEY = 'YOUR_PUBLIC_KEY'; // サーバーから取得するため削除

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

    // セッションキャッシュを確認（パフォーマンス向上）
    const cachedAuth = sessionStorage.getItem('cached_auth_user');
    if (cachedAuth) {
        try {
            const userData = JSON.parse(cachedAuth);
            currentUser = userData;
            window.currentUser = currentUser;
            window.isGuestMode = false;
            console.log('キャッシュからログイン情報を取得:', currentUser.name);
            showUserUI(currentUser);
            return currentUser;
        } catch (e) {
            console.error('認証キャッシュの解析エラー:', e);
            sessionStorage.removeItem('cached_auth_user');
        }
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

            // セッションキャッシュに保存
            sessionStorage.setItem('cached_auth_user', JSON.stringify(currentUser));

            console.log('ログイン中のユーザー:', currentUser.name);
            showUserUI(currentUser);
            return currentUser;
        } else {
            // 未ログインの場合、キャッシュをクリアしログイン画面にリダイレクト
            sessionStorage.removeItem('cached_auth_user');
            window.location.href = '../auth/login.html';
            return null;
        }
    } catch (error) {
        console.error('認証確認エラー:', error);
        // エラーの場合、一旦キャッシュをクリア
        sessionStorage.removeItem('cached_auth_user');
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

        // プッシュ通知ボタンの表示制御
        updatePushStatus();
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
        // キャッシュを先にクリア（UX向上のため）
        sessionStorage.removeItem('cached_auth_user');

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
            body: JSON.stringify({
                ...quizData,
                incorrectQuestionIds: window.incorrectQuestions ? window.incorrectQuestions.map(q => q.id) : []
            })
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

    // プッシュ通知トグルボタン
    const pushToggleBtn = document.getElementById('push-toggle-btn');
    if (pushToggleBtn) {
        pushToggleBtn.addEventListener('click', togglePushSubscription);
    }
}

// ========================================
// プッシュ通知関連のロジック
// ========================================

// Base64をUint8Arrayに変換 (VAPID用)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// プッシュ通知の状態を更新
async function updatePushStatus() {
    const pushToggleBtn = document.getElementById('push-toggle-btn');
    if (!pushToggleBtn || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    // ゲストモード or 未ログインなら隠す
    if (window.isGuestMode || !window.currentUser) {
        pushToggleBtn.style.display = 'none';
        return;
    }

    pushToggleBtn.style.display = 'flex';

    // iOSかつPWAモード（ホーム画面）でない場合、ボタンを非表示にするか、注意事項を表示する
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isIOS && !isStandalone) {
        // iOSでブラウザから見ている場合は、通知が使えない可能性が高い
        // ボタンは表示するが、クリック時に案内を出すようにする
        pushToggleBtn.innerHTML = '<span class="material-icons">notifications_off</span> 通知設定へ';
        // 背景色はCSSで管理するため削除
        pushToggleBtn.onclick = (e) => {
            e.stopPropagation();
            alert('iPhoneで通知を受け取るには、このアプリを「ホーム画面に追加」して、そこから起動する必要があります。\n\n手順:\n1. 共有ボタン（四角から矢印が出ているアイコン）を押す\n2. 「ホーム画面に追加」を選択\n3. ホーム画面に追加されたアイコンからアプリを開く');
        };
        return;
    } else {
        // イベントリスナーを再設定（上書き防止）
        pushToggleBtn.onclick = null;
        pushToggleBtn.addEventListener('click', togglePushSubscription);
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            pushToggleBtn.innerHTML = '<span class="material-icons">notifications_off</span> 通知OFF';
            // pushToggleBtn.style.background = '#757575'; // CSSで管理
        } else {
            pushToggleBtn.innerHTML = '<span class="material-icons">notifications</span> 通知ON';
            // pushToggleBtn.style.background = '#e91e63'; // CSSで管理
        }
    } catch (error) {
        console.error('Error checking push status:', error);
    }
}

// プッシュ通知の切り替え
async function togglePushSubscription() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        // 解除
        await unsubscribeFromPush(subscription);
    } else {
        // 登録
        await subscribeToPush(registration);
    }
    updatePushStatus();
}

// サブスクライブ
async function subscribeToPush(registration) {
    try {
        // サーバーからVAPID公開鍵を取得
        const keyResponse = await fetch('/api/push/public-key');
        const keyData = await keyResponse.json();
        const publicKey = keyData.publicKey;

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription,
                userId: window.currentUser ? window.currentUser.id : null,
                employeeCode: window.currentUser ? window.currentUser.employeeCode : null
            }),
            credentials: 'include'
        });

        if (response.ok) {
            alert('通知をONにしました。');
        } else {
            throw new Error('Server registration failed');
        }
    } catch (error) {
        console.error('Failed to subscribe:', error);
        if (error.name === 'NotAllowedError') {
            alert('通知がブロックされました。\niPhoneの設定 → 通知 → このアプリを選択し、「通知を許可」をONにしてください。');
        } else {
            alert('通知の有効化に失敗しました。iPhoneの場合はホーム画面に追加してから再度お試しください。');
        }
    }
}

// アンサブスクライブ
async function unsubscribeFromPush(subscription) {
    try {
        await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
            credentials: 'include'
        });

        await subscription.unsubscribe();
        alert('通知をOFFにしました。');
    } catch (error) {
        console.error('Failed to unsubscribe:', error);
        alert('解除に失敗しましたが、端末側の登録は削除しました。');
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
