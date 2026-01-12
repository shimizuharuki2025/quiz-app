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

            // 最も重要度の高いお知らせを表示
            const announcement = sortedAnnouncements[0];
            displayAnnouncementBanner(announcement);
        }
    } catch (error) {
        console.error('お知らせの読み込みエラー:', error);
    }
}

// お知らせバナーを表示
function displayAnnouncementBanner(announcement) {
    const banner = document.getElementById('announcement-banner');
    const icon = document.getElementById('announcement-icon');
    const message = document.getElementById('announcement-message');

    if (!banner || !icon || !message) return;

    // 重要度に応じたアイコンと色設定
    const severityConfig = {
        info: { icon: '📘', className: 'announcement-info' },
        warning: { icon: '⚠️', className: 'announcement-warning' },
        error: { icon: '🚨', className: 'announcement-error' }
    };

    const config = severityConfig[announcement.severity] || severityConfig.info;

    // バナーの内容を設定
    icon.textContent = config.icon;
    message.textContent = announcement.message;

    // 既存のクラスをリセット
    banner.className = 'announcement-banner';
    banner.classList.add(config.className);

    // バナーを表示（アニメーション付き）
    banner.style.display = 'block';
    setTimeout(() => banner.classList.add('announcement-show'), 100);
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
