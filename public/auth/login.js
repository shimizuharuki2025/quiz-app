// ログイン画面のJavaScript

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loginBtn = document.getElementById('login-btn');
    const guestModeBtn = document.getElementById('guest-mode-btn');

    // ログインフォーム送信
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const employeeCode = document.getElementById('employee-code').value.trim();
        const password = document.getElementById('password').value;

        // バリデーション
        if (!employeeCode || !password) {
            showError('従業員コードとパスワードを入力してください。');
            return;
        }

        // ボタンを無効化
        loginBtn.disabled = true;
        loginBtn.textContent = 'ログイン中...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Cookieを含める
                body: JSON.stringify({ employeeCode, password })
            });

            const data = await response.json();

            if (data.success) {
                // ログイン成功
                window.location.href = '../quiz-app/index.html';
            } else {
                // ログイン失敗
                showError(data.message || 'ログインに失敗しました。');
                loginBtn.disabled = false;
                loginBtn.textContent = 'ログイン';
            }
        } catch (error) {
            console.error('ログインエラー:', error);
            showError('サーバーとの通信に失敗しました。');
            loginBtn.disabled = false;
            loginBtn.textContent = 'ログイン';
        }
    });

    // ゲストモードボタン
    guestModeBtn.addEventListener('click', () => {
        // ゲストモードでクイズアプリに移動
        window.location.href = '../quiz-app/index.html?guest=true';
    });

    // エラーメッセージを表示
    function showError(message) {
        errorMessage.innerText = message;
        errorMessage.style.display = 'block';

        // 3秒後に非表示
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // 従業員コード入力欄：数字のみ許可
    const employeeCodeInput = document.getElementById('employee-code');
    employeeCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
});
