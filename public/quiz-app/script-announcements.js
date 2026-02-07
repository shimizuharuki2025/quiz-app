// ========================================
// お知らせバナー表示機能
// ========================================

// お知らせを読み込んで表示
async function loadAndDisplayAnnouncements() {
    try {
        const response = await fetch('/api/announcements');
        const result = await response.json();

        if (result.success && result.announcements && result.announcements.length > 0) {
            // 重要度の高いもの（error > warning > info）を優先して表示
            const severityOrder = { error: 3, warning: 2, info: 1 };
            const sortedAnnouncements = result.announcements.sort((a, b) =>
                (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
            );

            // すべてのお知らせを表示（以前は[0]のみだった）
            displayAnnouncements(sortedAnnouncements);
        }
    } catch (error) {
        console.error('お知らせの読み込みエラー:', error);
    }
}

// 複数のお知らせバナーを表示
function displayAnnouncements(announcements) {
    const container = document.getElementById('announcements-container');
    if (!container) return;

    // コンテナをクリア
    container.innerHTML = '';

    announcements.forEach((announcement, index) => {
        const banner = createAnnouncementElement(announcement);
        container.appendChild(banner);

        // 少しずつずらしてアニメーション表示（0.1秒間隔）
        setTimeout(() => {
            banner.style.display = 'block';
            // display: blockが適用された後にアニメーションクラスを追加するためにわずかに待つ
            requestAnimationFrame(() => {
                banner.classList.add('announcement-show');
            });
        }, index * 100);
    });
}

// お知らせバナーのHTML要素を作成
function createAnnouncementElement(announcement) {
    const div = document.createElement('div');

    // 重要度に応じたアイコンと色設定
    const severityConfig = {
        info: { icon: '📘', className: 'announcement-info' },
        warning: { icon: '⚠️', className: 'announcement-warning' },
        error: { icon: '🚨', className: 'announcement-error' }
    };
    const config = severityConfig[announcement.severity] || severityConfig.info;

    div.className = `announcement-banner ${config.className}`;

    div.innerHTML = `
        <div class="announcement-content">
            <span class="announcement-icon">${config.icon}</span>
            <span class="announcement-message">${escapeHtml(announcement.message)}</span>
        </div>
    `;

    return div;
}

// XSS対策用エスケープ関数
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (match) {
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[match];
    });
}

// ページ読み込み時にお知らせを表示
document.addEventListener('DOMContentLoaded', () => {
    // ホーム画面が表示されるまで待つ
    const checkHomeScreen = setInterval(() => {
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen && homeScreen.style.display !== 'none') {
            loadAndDisplayAnnouncements();
            clearInterval(checkHomeScreen);
        }
    }, 500);

    // 10秒後にチェックを停止（無限ループ防止）
    setTimeout(() => clearInterval(checkHomeScreen), 10000);
});
