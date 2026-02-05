// ========================================
// お知らせ管理機能
// ========================================

// お知らせ一覧を読み込んで表示
async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/all');
        const result = await response.json();

        if (result.success) {
            renderAnnouncementsList(result.announcements || []);
        } else {
            console.error('お知らせの読み込みに失敗しました:', result.message);
        }
    } catch (error) {
        console.error('お知らせの読み込みエラー:', error);
    }
}

// お知らせ一覧をHTMLに描画
function renderAnnouncementsList(announcements) {
    const announcementsListEl = document.getElementById('announcements-list');

    if (announcements.length === 0) {
        announcementsListEl.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">お知らせがまだ登録されていません</p>';
        return;
    }

    // 日付でソート（新しい順）
    announcements.sort((a, b) => {
        const dateA = a.startDate || '';
        const dateB = b.startDate || '';
        return dateB.localeCompare(dateA);
    });

    announcementsListEl.innerHTML = announcements.map(announcement => {
        const severityColors = {
            info: { bg: 'var(--info-bg)', border: 'var(--info-border)', emoji: '📘' },
            warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', emoji: '⚠️' },
            error: { bg: 'var(--announcement-error-bg)', border: 'var(--announcement-error-border)', emoji: '🚨' }
        };

        const colorScheme = severityColors[announcement.severity] || severityColors.info;
        const today = new Date().toISOString().split('T')[0];

        // 表示期間の状態を判定
        let statusBadge = '';
        if (announcement.enabled) {
            if (announcement.startDate && today < announcement.startDate) {
                statusBadge = '<span style="padding: 4px 8px; background: #FFF3CD; color: #856404; border-radius: 4px; font-size: 12px; font-weight: bold;">待機中</span>';
            } else if (announcement.endDate && today > announcement.endDate) {
                statusBadge = '<span style="padding: 4px 8px; background: #E0E0E0; color: #616161; border-radius: 4px; font-size: 12px; font-weight: bold;">期限切れ</span>';
            } else {
                statusBadge = '<span style="padding: 4px 8px; background: #D4EDDA; color: #155724; border-radius: 4px; font-size: 12px; font-weight: bold;">表示中</span>';
            }
        } else {
            statusBadge = '<span style="padding: 4px 8px; background: #F8D7DA; color: #721C24; border-radius: 4px; font-size: 12px; font-weight: bold;">非表示</span>';
        }

        return `
            <div class="announcement-item" data-announcement-id="${announcement.id}" style="
                margin-bottom: 15px;
                padding: 15px;
                border: 2px solid ${colorScheme.border};
                border-radius: 8px;
                background: ${colorScheme.bg};
            ">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${colorScheme.emoji}</span>
                        ${statusBadge}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-announcement-btn" style="
                            padding: 6px 12px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                        ">編集</button>
                        <button class="delete-announcement-btn" style="
                            padding: 6px 12px;
                            background: #F44336;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                        ">削除</button>
                    </div>
                </div>
                <div style="margin-bottom: 8px; font-size: 15px; line-height: 1.5; color: #333;">
                    ${announcement.message}
                </div>
                <div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
                    <span>📅 開始: ${announcement.startDate || '未設定'}</span>
                    <span>📅 終了: ${announcement.endDate || '未設定'}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 新しいお知らせを追加
async function addAnnouncement(announcementData) {
    try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(announcementData)
        });

        const result = await response.json();

        if (result.success) {
            // フォームをリセット
            document.getElementById('new-announcement-message').value = '';
            document.getElementById('new-announcement-severity').value = 'info';
            document.getElementById('new-announcement-start-date').value = '';
            document.getElementById('new-announcement-end-date').value = '';
            document.getElementById('new-announcement-enabled').checked = true;

            // フォームを非表示
            document.getElementById('announcement-add-form').style.display = 'none';

            // 一覧を再読み込み
            loadAnnouncements();

            alert('お知らせを追加しました！');
        } else {
            alert(`エラー: ${result.message}`);
        }
    } catch (error) {
        console.error('お知らせ追加エラー:', error);
        alert('お知らせの追加に失敗しました。');
    }
}

// プッシュ通知を送信
async function sendPushNotification(title, body, severity) {
    try {
        const response = await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                body: body,
                severity: severity,
                url: '/quiz-app/index.html'
            })
        });
        const result = await response.json();
        if (result.success) {
            console.log('Push sent:', result.results);
            return result.results;
        } else {
            console.error('Push failed:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Push error:', error);
        return null;
    }
}

// お知らせを更新
async function updateAnnouncement(id, updates) {
    try {
        const response = await fetch(`/api/announcements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        const result = await response.json();

        if (result.success) {
            loadAnnouncements();
            alert('お知らせを更新しました！');
        } else {
            alert(`エラー: ${result.message}`);
        }
    } catch (error) {
        console.error('お知らせ更新エラー:', error);
        alert('お知らせの更新に失敗しました。');
    }
}

// お知らせを削除
async function deleteAnnouncement(id) {
    if (!confirm('このお知らせを削除しますか？')) return;

    try {
        const response = await fetch(`/api/announcements/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            loadAnnouncements();
            alert('お知らせを削除しました。');
        } else {
            alert(`エラー: ${result.message}`);
        }
    } catch (error) {
        console.error('お知らせ削除エラー:', error);
        alert('お知らせの削除に失敗しました。');
    }
}

// イベントリスナーを追加
document.addEventListener('DOMContentLoaded', () => {
    // お知らせ管理機能が存在する場合のみ初期化
    const showAddAnnouncementBtn = document.getElementById('show-add-announcement-btn');
    if (!showAddAnnouncementBtn) return; // お知らせ機能のHTMLがない場合は何もしない

    const announcementAddForm = document.getElementById('announcement-add-form');
    const submitAnnouncementBtn = document.getElementById('submit-announcement-btn');
    const cancelAnnouncementBtn = document.getElementById('cancel-announcement-btn');
    const announcementsList = document.getElementById('announcements-list');

    // お知らせ一覧を読み込み（認証後に実行）
    const checkAdminContent = setInterval(() => {
        const adminContent = document.getElementById('admin-content');
        if (adminContent && adminContent.style.display !== 'none') {
            loadAnnouncements();
            clearInterval(checkAdminContent);
        }
    }, 500);

    // 「新しいお知らせを追加」ボタン
    showAddAnnouncementBtn.addEventListener('click', () => {
        announcementAddForm.style.display = 'block';
        // 今日の日付をデフォルトで設定
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('new-announcement-start-date').value = today;
    });

    // 「キャンセル」ボタン
    cancelAnnouncementBtn.addEventListener('click', () => {
        announcementAddForm.style.display = 'none';
    });

    // 「お知らせを追加」ボタン
    submitAnnouncementBtn.addEventListener('click', () => {
        const message = document.getElementById('new-announcement-message').value.trim();
        const severity = document.getElementById('new-announcement-severity').value;
        const startDate = document.getElementById('new-announcement-start-date').value;
        const endDate = document.getElementById('new-announcement-end-date').value;
        const enabled = document.getElementById('new-announcement-enabled').checked;

        const announcementData = {
            message,
            severity,
            startDate,
            endDate,
            enabled
        };

        const sendPush = document.getElementById('new-announcement-push').checked;

        addAnnouncement(announcementData).then(() => {
            if (sendPush) {
                const title = severity === 'error' ? '🚨 緊急のお知らせ' : (severity === 'warning' ? '⚠️ 警告' : '📢 お知らせ');
                sendPushNotification(title, message, severity).then(results => {
                    if (results) {
                        alert(`お知らせを追加し、${results.success} 件のデバイスに通知を送りました。`);
                    }
                });
            }
        });
    });

    // お知らせ一覧のボタンイベント（編集・削除）
    announcementsList.addEventListener('click', (e) => {
        const announcementItem = e.target.closest('.announcement-item');
        if (!announcementItem) return;

        const announcementId = announcementItem.dataset.announcementId;

        if (e.target.classList.contains('delete-announcement-btn')) {
            deleteAnnouncement(announcementId);
        } else if (e.target.classList.contains('edit-announcement-btn')) {
            editAnnouncementPrompt(announcementId);
        }
    });
});

// お知らせ編集用のプロンプト（簡易版）
async function editAnnouncementPrompt(id) {
    try {
        const response = await fetch('/api/announcements/all');
        const result = await response.json();

        if (!result.success) {
            alert('お知らせの読み込みに失敗しました。');
            return;
        }

        const announcement = result.announcements.find(a => a.id === id);
        if (!announcement) {
            alert('お知らせが見つかりませんでした。');
            return;
        }

        // 編集フォームを表示（既存の追加フォームを再利用）
        const announcementAddForm = document.getElementById('announcement-add-form');
        const submitBtn = document.getElementById('submit-announcement-btn');

        // フォームに現在の値を設定
        document.getElementById('new-announcement-message').value = announcement.message;
        document.getElementById('new-announcement-severity').value = announcement.severity;
        document.getElementById('new-announcement-start-date').value = announcement.startDate || '';
        document.getElementById('new-announcement-end-date').value = announcement.endDate || '';
        document.getElementById('new-announcement-enabled').checked = announcement.enabled;

        // フォームを表示
        announcementAddForm.style.display = 'block';

        // ボタンのテキストを「更新」に変更
        submitBtn.textContent = 'お知らせを更新';

        // 既存のイベントリスナーを削除して新しいものを設定
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

        newSubmitBtn.addEventListener('click', async () => {
            const message = document.getElementById('new-announcement-message').value.trim();
            const severity = document.getElementById('new-announcement-severity').value;
            const startDate = document.getElementById('new-announcement-start-date').value;
            const endDate = document.getElementById('new-announcement-end-date').value;
            const enabled = document.getElementById('new-announcement-enabled').checked;
            const sendPush = document.getElementById('new-announcement-push').checked;

            if (!message) {
                alert('お知らせ本文を入力してください。');
                return;
            }

            if (endDate && startDate && endDate < startDate) {
                alert('表示終了日は開始日以降に設定してください。');
                return;
            }

            await updateAnnouncement(id, { message, severity, startDate, endDate, enabled });

            if (sendPush) {
                const title = severity === 'error' ? '🚨 緊急のお知らせ' : (severity === 'warning' ? '⚠️ 警告' : '📢 お知らせ (更新)');
                sendPushNotification(title, message, severity).then(results => {
                    if (results) {
                        alert(`お知らせを更新し、${results.success} 件のデバイスに通知を送りました。`);
                    }
                });
            }

            // フォームをリセット
            announcementAddForm.style.display = 'none';
            newSubmitBtn.textContent = 'お知らせを追加';
            document.getElementById('new-announcement-message').value = '';
            document.getElementById('new-announcement-severity').value = 'info';
            document.getElementById('new-announcement-start-date').value = '';
            document.getElementById('new-announcement-end-date').value = '';
            document.getElementById('new-announcement-enabled').checked = true;
            document.getElementById('new-announcement-push').checked = false;
        }, { once: true });
    } catch (error) {
        console.error('お知らせ編集エラー:', error);
        alert('お知らせの編集に失敗しました。');
    }
}
