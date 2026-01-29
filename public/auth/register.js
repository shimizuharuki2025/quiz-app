// ユーザー登録画面のJavaScript

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const registerBtn = document.getElementById('register-btn');

    // 登録フォーム送信
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const employeeCode = document.getElementById('employee-code').value.trim();
        const storeCode = document.getElementById('store-code').value.trim();
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;

        // バリデーション
        if (!employeeCode || !storeCode || !name || !password || !passwordConfirm) {
            showError('すべての項目を入力してください。');
            return;
        }

        if (password !== passwordConfirm) {
            showError('パスワードが一致しません。');
            return;
        }

        if (employeeCode.length < 6) {
            showError('従業員コードは6桁以上で入力してください。');
            return;
        }

        if (storeCode.length !== 6) {
            showError('店舗コードは6桁で入力してください。');
            return;
        }

        if (password.length < 4) {
            showError('パスワードは4文字以上で設定してください。');
            return;
        }

        // ボタンを無効化
        registerBtn.disabled = true;
        registerBtn.textContent = '登録中...';

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    employeeCode,
                    storeCode,
                    name,
                    password
                })
            });

            const data = await response.json();

            if (data.success) {
                // 登録成功
                showSuccess('登録が完了しました！ログイン画面に移動します...');

                // 2秒後にログイン画面に移動
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                // 登録失敗
                showError(data.message || '登録に失敗しました。');
                registerBtn.disabled = false;
                registerBtn.textContent = '登録する';
            }
        } catch (error) {
            console.error('登録エラー:', error);
            showError('サーバーとの通信に失敗しました。');
            registerBtn.disabled = false;
            registerBtn.textContent = '登録する';
        }
    });

    // エラーメッセージを表示
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';

        // 5秒後に非表示
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // 成功メッセージを表示
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    // 従業員コード入力欄：数字のみ許可
    const employeeCodeInput = document.getElementById('employee-code');
    employeeCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    // 店舗コード入力欄：数字のみ許可
    const storeCodeInput = document.getElementById('store-code');
    storeCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
});
