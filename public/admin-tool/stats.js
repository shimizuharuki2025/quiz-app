document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const adminContent = document.getElementById('admin-content');
    const authContainer = document.getElementById('auth-container');
    const authMessage = document.getElementById('auth-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    let statsData = null;

    // 認証処理
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const employeeCode = document.getElementById('admin-employee-code-input').value;
        const password = document.getElementById('admin-password-input').value;
        authMessage.textContent = '';

        try {
            const response = await fetch('/api/v1/auth/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode, password })
            });

            const data = await response.json();
            if (response.ok && data.authenticated) {
                authContainer.style.display = 'none';
                adminContent.style.display = 'block';
                loadStats();
            } else {
                authMessage.textContent = data.message || '認証に失敗しました。';
            }
        } catch (error) {
            console.error('Auth error:', error);
            authMessage.textContent = '通信エラーが発生しました。';
        }
    });

    // 統計データの取得と読み込み
    async function loadStats() {
        loadingSpinner.style.display = 'block';

        try {
            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            if (data.success) {
                statsData = data.stats;
                renderDashboard(statsData);
            } else {
                alert('統計データの取得に失敗しました: ' + data.message);
            }
        } catch (error) {
            console.error('Fetch stats error:', error);
            alert('統計データの取得中にエラーが発生しました。');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderDashboard(stats) {
        // サマリーの反映
        document.getElementById('stat-total-users').textContent = `${stats.summary.totalUsers}人`;
        document.getElementById('stat-active-users').textContent = `${stats.summary.activeUsers}人`;
        document.getElementById('stat-total-plays').textContent = `${stats.summary.totalPlayCount}回`;
        document.getElementById('stat-avg-score').textContent = `${stats.summary.averageScore}点`;

        // 店舗別統計の反映
        const storeTableBody = document.querySelector('#store-stats-table tbody');
        if (storeTableBody && stats.storeStats) {
            storeTableBody.innerHTML = '';
            // プレイ回数の多い順にソート
            const sortedStores = Object.entries(stats.storeStats)
                .map(([code, data]) => ({ code, ...data }))
                .sort((a, b) => b.playCount - a.playCount);

            if (sortedStores.length === 0) {
                storeTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">データがありません</td></tr>';
            } else {
                sortedStores.forEach(store => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${store.name} <small style="color: #888;">(${store.code})</small></td>
                        <td style="text-align: right;">${store.activeUsersCount}名</td>
                        <td style="text-align: right;">${store.playCount}回</td>
                        <td style="text-align: right;"><span class="score-badge ${getScoreClass(store.averageScore)}">${store.averageScore}点</span></td>
                    `;
                    storeTableBody.appendChild(tr);
                });
            }
        }

        // カテゴリ別統計
        const categoryList = document.querySelector('#category-stats-table tbody');
        categoryList.innerHTML = '';

        Object.keys(stats.categoryStats).forEach(id => {
            const cat = stats.categoryStats[id];
            const accuracy = cat.totalQuestions > 0 ? Math.round((cat.totalCorrect / cat.totalQuestions) * 100) : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cat.name}</td>
                <td style="text-align: right;">${cat.playCount}回</td>
                <td style="text-align: right;"><span class="score-badge ${getScoreClass(cat.averageScore)}">${cat.averageScore}点</span></td>
                <td style="text-align: right;">${accuracy}%</td>
            `;
            categoryList.appendChild(tr);
        });

        // 最近の活動
        const recentList = document.querySelector('#recent-activity-table tbody');
        recentList.innerHTML = '';

        stats.recentActivity.forEach(activity => {
            const date = new Date(activity.completedAt).toLocaleString('ja-JP');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 0.85rem; color: #666;">${date}</td>
                <td><strong>${activity.userName}</strong><br><small style="color:#888;">${activity.employeeCode}</small></td>
                <td>${activity.storeName || '-'}</td>
                <td>${activity.categoryName}</td>
                <td style="text-align: right;"><span class="score-badge ${getScoreClass(activity.score)}">${activity.score}点</span></td>
            `;
            recentList.appendChild(tr);
        });
    }

    function getScoreClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 60) return 'score-mid';
        return 'score-low';
    }

    // CSV出力機能
    document.getElementById('download-csv-btn').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('download-csv-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons">sync</span> 生成中...';
            btn.disabled = true;

            const response = await fetch('/api/admin/users');
            const userData = await response.json();

            if (!userData.success) {
                alert('ユーザー情報の取得に失敗しました。');
                return;
            }

            const allLogs = [];
            for (const user of userData.users) {
                try {
                    const res = await fetch(`/api/admin/users/${user.id}`);
                    const d = await res.json();
                    if (d.success && d.user.history.quizHistory) {
                        d.user.history.quizHistory.forEach(historyItem => {
                            allLogs.push({
                                ...historyItem,
                                employeeCode: user.employeeCode,
                                name: user.name,
                                storeCode: user.storeCode,
                                storeName: user.storeName
                            });
                        });
                    }
                } catch (e) {
                    console.error('Error fetching user log:', user.id);
                }
            }

            if (allLogs.length === 0) {
                alert('出力可能な学習履歴がありません。');
                return;
            }

            // 日付順に並べ替え
            allLogs.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

            // CSVのヘッダー
            let csvContent = "\ufeff"; // BOM
            csvContent += "日時,従業員コード,名前,店舗コード,店舗名,カテゴリ名,得点,正解数,総問題数\n";

            // 行を追加
            allLogs.forEach(log => {
                const date = new Date(log.completedAt).toLocaleString('ja-JP').replace(/,/g, '');
                const row = [
                    `"${date}"`,
                    `"${log.employeeCode}"`,
                    `"${log.name}"`,
                    `"${log.storeCode}"`,
                    `"${log.storeName}"`,
                    `"${log.categoryName}"`,
                    log.score,
                    log.correctAnswers,
                    log.totalQuestions
                ].join(",");
                csvContent += row + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `学習履歴レポート_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            btn.innerHTML = originalText;
            btn.disabled = false;
        } catch (error) {
            console.error('CSV export error:', error);
            alert('CSVの生成中にエラーが発生しました。');
        }
    });
});
