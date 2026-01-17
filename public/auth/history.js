// 学習履歴画面のJavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // ログインチェック
    try {
        const authResponse = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        const authData = await authResponse.json();

        if (!authData.loggedIn) {
            // 未ログインの場合はログイン画面にリダイレクト
            alert('ログインが必要です。');
            window.location.href = 'login.html';
            return;
        }

        const user = authData.user;

        // ユーザー名表示
        document.getElementById('user-name-display').textContent = `${user.name} さんの学習記録`;

        // ログアウトボタンのイベントリスナー
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    });
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('ログアウトエラー:', error);
                    alert('ログアウトに失敗しました。');
                }
            });
        }

        // 学習履歴を取得
        const historyResponse = await fetch(`/api/learning/history/${user.id}`, {
            credentials: 'include'
        });

        const historyData = await historyResponse.json();

        if (historyData.success) {
            const history = historyData.history;

            // 統計情報を表示
            document.getElementById('total-quizzes').textContent = history.totalQuizzes;
            document.getElementById('average-score').textContent = history.averageScore;
            document.getElementById('best-score').textContent = history.bestScore;

            // クイズ履歴を表示
            displayQuizHistory(history.quizHistory);
        } else {
            showError('学習履歴の取得に失敗しました。');
        }

    } catch (error) {
        console.error('エラー:', error);
        showError('サーバーとの通信に失敗しました。');
    }
});

function displayQuizHistory(quizHistory) {
    const historyContent = document.getElementById('history-content');

    if (!quizHistory || quizHistory.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-state">
                <p>📝 まだクイズを実施していません</p>
                <p>クイズを実施すると、ここに履歴が表示されます。</p>
            </div>
        `;
        return;
    }

    // 新しい順に並び替え
    const sortedHistory = [...quizHistory].sort((a, b) => {
        return new Date(b.completedAt) - new Date(a.completedAt);
    });

    const historyList = document.createElement('ul');
    historyList.className = 'history-list';

    sortedHistory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';

        const date = new Date(item.completedAt);
        const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        // スコアに応じてクラスを設定
        let scoreClass = 'history-score';
        if (item.score >= 90) {
            scoreClass += ' score-excellent';
        } else if (item.score >= 70) {
            scoreClass += ' score-good';
        } else if (item.score >= 50) {
            scoreClass += ' score-average';
        } else {
            scoreClass += ' score-poor';
        }

        li.innerHTML = `
            <div class="history-info">
                <h3>${item.categoryName}</h3>
                <p>${formattedDate} | 正解数: ${item.correctAnswers}/${item.totalQuestions}</p>
            </div>
            <div class="${scoreClass}">${item.score}点</div>
        `;

        historyList.appendChild(li);
    });

    historyContent.innerHTML = '';
    historyContent.appendChild(historyList);
}

function showError(message) {
    const historyContent = document.getElementById('history-content');
    historyContent.innerHTML = `
        <div class="empty-state">
            <p style="color: #f44336;">❌ ${message}</p>
        </div>
    `;
}
