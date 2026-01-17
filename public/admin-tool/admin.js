// Version: 2025-11-12-005 - Final Corrected and Modularized Version
// Part 1/3: Global variables, Class definition, and Data manipulation functions

// --- グローバル変数 ---
let allData = { mainCategories: [] };
let selectedSubCategoryId = null;
let isDirty = false;
let changeHistoryManager = null;

// --- クラス定義 ---
class ChangeHistoryManager {
    constructor() { this.storageKey = 'quiz_admin_change_history'; this.maxHistorySize = 100; this.loadFromStorage(); }
    loadFromStorage() { try { const stored = localStorage.getItem(this.storageKey); this.history = stored ? JSON.parse(stored) : []; } catch (error) { console.error('[変更履歴] 読み込み失敗:', error); this.history = []; } }
    saveToStorage() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.history)); } catch (error) { console.error('[変更履歴] 保存失敗:', error); } }
    recordChange(type, target, data) { const change = { id: `change_${Date.now()}`, timestamp: Date.now(), type, target, data, user: "admin" }; this.history.push(change); if (this.history.length > this.maxHistorySize) this.history.shift(); this.saveToStorage(); return change; }
    getHistory(limit = 50) { return this.history.slice(-limit).reverse(); }
    clearHistory() { this.history = []; this.saveToStorage(); }
    exportHistory() { return JSON.stringify(this.history, null, 2); }
    formatChange(change) { const timeStr = new Date(change.timestamp).toLocaleString('ja-JP'); const targetName = change.target.name || change.target.id; let message = ''; switch (change.type) { case 'ADD_MAIN_CATEGORY': message = `大カテゴリを追加: 「${targetName}」`; break; case 'REMOVE_MAIN_CATEGORY': message = `大カテゴリを削除: 「${targetName}」`; break; case 'ADD_SUB_CATEGORY': message = `小カテゴリを追加: 「${targetName}」`; break; case 'REMOVE_SUB_CATEGORY': message = `小カテゴリを削除: 「${targetName}」`; break; case 'ADD_QUESTION': message = `問題を追加: 「${(change.data.question.question || "").substring(0, 20)}...」`; break; case 'REMOVE_QUESTION': message = `問題を削除: インデックス ${change.data.questionIndex}`; break; case 'REORDER_QUESTION': message = `問題を並び替え: ${change.data.oldIndex} → ${change.data.newIndex}`; break; case 'UPDATE_SUB_CATEGORY': message = `小カテゴリを更新: 「${targetName}」`; break; default: message = `不明な変更: ${change.type}`; } return `[${timeStr}] ${message}`; }
}

// --- データ操作関数 ---
function addMainCategoryToData(mainCategoryData) { if (!allData.mainCategories) allData.mainCategories = []; allData.mainCategories.push(mainCategoryData); markAsDirty(); changeHistoryManager.recordChange('ADD_MAIN_CATEGORY', { type: 'mainCategory', id: mainCategoryData.id, name: mainCategoryData.name }, { mainCategory: mainCategoryData }); return mainCategoryData; }
function removeMainCategoryFromData(mainCategoryId) { const index = allData.mainCategories.findIndex(m => m.id === mainCategoryId); if (index > -1) { const [removed] = allData.mainCategories.splice(index, 1); markAsDirty(); changeHistoryManager.recordChange('REMOVE_MAIN_CATEGORY', { type: 'mainCategory', id: mainCategoryId, name: removed.name }, { mainCategoryId }); return true; } return false; }
function addSubCategoryToData(mainCategoryId, subCategoryData) { const mainCat = allData.mainCategories.find(m => m.id === mainCategoryId); if (mainCat) { if (!mainCat.subCategories) mainCat.subCategories = []; mainCat.subCategories.push(subCategoryData); markAsDirty(); changeHistoryManager.recordChange('ADD_SUB_CATEGORY', { type: 'subCategory', id: subCategoryData.id, name: subCategoryData.name }, { mainCategoryId, subCategory: subCategoryData }); return subCategoryData; } return null; }
function removeSubCategoryFromData(subCategoryId) { for (const mainCat of allData.mainCategories) { const index = mainCat.subCategories.findIndex(s => s.id === subCategoryId); if (index > -1) { const [removed] = mainCat.subCategories.splice(index, 1); markAsDirty(); changeHistoryManager.recordChange('REMOVE_SUB_CATEGORY', { type: 'subCategory', id: subCategoryId, name: removed.name }, { subCategoryId }); return true; } } return false; }
function addQuestionToData(subCategoryId, questionData) { const subCat = findSubCategoryById(subCategoryId); if (subCat) { if (!subCat.questions) subCat.questions = []; subCat.questions.push(questionData); markAsDirty(); changeHistoryManager.recordChange('ADD_QUESTION', { type: 'question', id: subCategoryId, name: subCat.name }, { subCategoryId, question: questionData }); return questionData; } return null; }
function removeQuestionFromData(subCategoryId, questionIndex) { const subCat = findSubCategoryById(subCategoryId); if (subCat?.questions?.[questionIndex]) { subCat.questions.splice(questionIndex, 1); markAsDirty(); changeHistoryManager.recordChange('REMOVE_QUESTION', { type: 'question', id: subCategoryId, name: subCat.name }, { subCategoryId, questionIndex }); return true; } return false; }
function reorderQuestionInData(subCategoryId, oldIndex, newIndex) { const subCat = findSubCategoryById(subCategoryId); if (subCat?.questions) { const [movedItem] = subCat.questions.splice(oldIndex, 1); subCat.questions.splice(newIndex, 0, movedItem); markAsDirty(); changeHistoryManager.recordChange('REORDER_QUESTION', { type: 'question', id: subCategoryId, name: subCat.name }, { subCategoryId, oldIndex, newIndex }); return true; } return false; }
function updateSubCategoryData(subCategoryId, updates) { const subCat = findSubCategoryById(subCategoryId); if (subCat) { Object.assign(subCat, updates); markAsDirty(); changeHistoryManager.recordChange('UPDATE_SUB_CATEGORY', { type: 'subCategory', id: subCategoryId, name: subCat.name }, { subCategoryId, updates }); return true; } return false; }
function findSubCategoryById(subId) { if (!subId) return null; for (const mainCat of allData.mainCategories) { const found = mainCat.subCategories?.find(sc => sc.id === subId); if (found) return found; } return null; }
// Part 2/3: UI Rendering and Manipulation Functions

function setSaveStatus(status, message = '') {
    const saveStatusEl = document.getElementById('save-status');
    const saveToServerBtn = document.getElementById('save-to-server-btn');
    saveStatusEl.className = '';
    const statusTextEl = saveStatusEl.querySelector('.status-text');
    const iconEl = saveStatusEl.querySelector('.material-icons');
    const spinner = saveToServerBtn.querySelector('.spinner');
    iconEl.textContent = '';
    spinner.style.display = 'none';
    saveToServerBtn.querySelector('.btn-text').style.display = 'inline';
    saveToServerBtn.classList.remove('loading');
    switch (status) {
        case 'saved': saveStatusEl.classList.add('status-saved'); iconEl.textContent = 'check_circle'; statusTextEl.textContent = message || '保存済み'; isDirty = false; saveToServerBtn.disabled = true; break;
        case 'unsaved': saveStatusEl.classList.add('status-unsaved'); iconEl.textContent = 'edit'; statusTextEl.textContent = message || '未保存の変更があります'; isDirty = true; saveToServerBtn.disabled = false; break;
        case 'saving': saveStatusEl.classList.add('status-saving'); iconEl.textContent = 'sync'; statusTextEl.textContent = message || '保存中...'; spinner.style.display = 'inline-block'; saveToServerBtn.querySelector('.btn-text').style.display = 'none'; saveToServerBtn.classList.add('loading'); saveToServerBtn.disabled = true; break;
        case 'error': saveStatusEl.classList.add('status-error'); iconEl.textContent = 'error'; statusTextEl.textContent = message || '保存に失敗しました'; isDirty = true; saveToServerBtn.disabled = false; break;
    }
}

function markAsDirty() {
    if (!isDirty) setSaveStatus('unsaved');
}

function renderCategoryList() {
    const categoryListContainer = document.getElementById('category-list-container');
    categoryListContainer.innerHTML = '';
    if (!allData.mainCategories) allData.mainCategories = [];
    allData.mainCategories.forEach(mainCat => {
        const mainCatItem = document.createElement('div');
        mainCatItem.className = 'main-category-item';
        mainCatItem.dataset.mainId = mainCat.id;
        if (mainCat.subCategories?.some(sc => sc.id === selectedSubCategoryId)) {
            mainCatItem.classList.add('open');
        }
        mainCatItem.innerHTML = ` <div class="main-category-header"> <span class="category-name">${mainCat.name}</span> <button class="delete-main-category-btn"><span class="material-icons">delete_outline</span></button> </div> <div class="sub-category-list"></div> <div class="add-category-area"> <input type="text" class="new-sub-category-name" placeholder="新しい小カテゴリ名"> <button class="add-sub-category-btn">追加</button> </div>`;
        const subCategoryListEl = mainCatItem.querySelector('.sub-category-list');
        if (mainCat.subCategories?.length > 0) {
            mainCat.subCategories.forEach(subCat => {
                const subCatItem = document.createElement('div');
                subCatItem.className = 'sub-category-item';
                subCatItem.dataset.subId = subCat.id;
                if (subCat.id === selectedSubCategoryId) subCatItem.classList.add('selected');
                subCatItem.innerHTML = `<span class="category-name">${subCat.name}</span>`;
                subCategoryListEl.appendChild(subCatItem);
            });
        }
        categoryListContainer.appendChild(mainCatItem);
    });
    if (selectedSubCategoryId) {
        const subCat = findSubCategoryById(selectedSubCategoryId);
        if (subCat) {
            showEditor(subCat.name);
            renderQuestionList();
            renderSubCategorySettings();
        } else {
            selectedSubCategoryId = null;
            hideEditor();
        }
    } else {
        hideEditor();
    }
}

function showEditor(categoryName) { document.getElementById('editing-category-name').textContent = `編集中のカテゴリ: ${categoryName}`; document.getElementById('editor-area').style.display = 'block'; }
function hideEditor() { document.getElementById('editor-area').style.display = 'none'; }

function selectSubCategory(subId) {
    if (isDirty) {
        showCustomConfirm('未保存の変更があります。保存せずに移動しますか？', () => {
            isDirty = false;
            selectedSubCategoryId = subId;
            renderCategoryList();
        });
        return;
    }
    selectedSubCategoryId = subId;
    document.querySelectorAll('.sub-category-item.selected').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.querySelector(`.sub-category-item[data-sub-id="${subId}"]`);
    if (selectedEl) {
        selectedEl.classList.add('selected');
        selectedEl.closest('.main-category-item')?.classList.add('open');
    }
    const subCat = findSubCategoryById(subId);
    if (subCat) {
        showEditor(subCat.name);
        renderQuestionList();
        renderSubCategorySettings();
    }
}

function renderQuestionList() {
    const questionList = document.getElementById('question-list');
    const progressStatusEl = document.getElementById('progress-status');
    const questionItemTemplate = document.getElementById('question-item-template');
    questionList.innerHTML = '';
    progressStatusEl.textContent = '';
    if (!selectedSubCategoryId) return;
    const subCat = findSubCategoryById(selectedSubCategoryId);
    const questions = subCat?.questions || [];
    progressStatusEl.textContent = `全 ${questions.length} 問`;
    if (questions.length === 0) {
        questionList.innerHTML = '<p>この小カテゴリにはまだ問題がありません。</p>';
        return;
    }
    questions.forEach((question, index) => {
        const templateClone = questionItemTemplate.content.cloneNode(true);
        const qElement = templateClone.querySelector('.question-item');
        qElement.dataset.index = index;
        qElement.querySelector('.question-title').textContent = `問題 ${index + 1}`;
        qElement.querySelector('.question-text').value = question.question;
        updateImagePreview(qElement.querySelectorAll('.image-upload-container')[0], question.questionImage);

        const questionTypeSelect = qElement.querySelector('.question-type-select');
        const choiceContainer = qElement.querySelector('.choice-answers-container');
        const fillInBlankContainer = qElement.querySelector('.fill-in-the-blank-container');
        const isMultipleChoiceInput = qElement.querySelector('.is-multiple-choice-input');
        const answersGroup = qElement.querySelector('.answers-group');
        const fillInBlankInput = qElement.querySelector('.fill-in-the-blank-answers');

        const questionType = question.questionType || (question.isMultipleChoice ? 'multiple' : 'single');
        questionTypeSelect.value = questionType;

        const setupUIForQuestionType = (type) => {
            const isFillIn = type === 'fill-in-the-blank';
            choiceContainer.classList.toggle('hidden', isFillIn);
            fillInBlankContainer.classList.toggle('hidden', !isFillIn);
            if (!isFillIn) {
                isMultipleChoiceInput.checked = (type === 'multiple');
                renderChoiceAnswers();
            }
        };

        const renderChoiceAnswers = () => {
            const answerInputType = isMultipleChoiceInput.checked ? 'checkbox' : 'radio';
            answersGroup.innerHTML = (question.answers || []).map((ans, ansIndex) =>
                `<div class="answer-item">
                    <input type="${answerInputType}" name="correct-answer-${index}" class="is-correct-input" ${ans.correct ? 'checked' : ''} data-ans-index="${ansIndex}">
                    <input type="text" class="answer-text" value="${ans.text}" data-ans-index="${ansIndex}">
                </div>`
            ).join('');
        };

        questionTypeSelect.addEventListener('change', (e) => {
            setupUIForQuestionType(e.target.value);
            markAsDirty();
        });

        isMultipleChoiceInput.addEventListener('change', (e) => {
            questionTypeSelect.value = e.target.checked ? 'multiple' : 'single';
            renderChoiceAnswers();
            markAsDirty();
        });

        qElement.querySelector('.form-group-checkbox label').addEventListener('click', (e) => {
            e.preventDefault();
            isMultipleChoiceInput.checked = !isMultipleChoiceInput.checked;
            isMultipleChoiceInput.dispatchEvent(new Event('change'));
        });

        setupUIForQuestionType(questionType);
        if (questionType === 'fill-in-the-blank') {
            fillInBlankInput.value = (question.answers || []).filter(a => a.correct).map(a => a.text).join(',');
        } else {
            renderChoiceAnswers();
        }

        qElement.querySelector('.explanation-text').value = question.explanation;
        updateImagePreview(qElement.querySelectorAll('.image-upload-container')[1], question.explanationImage);
        questionList.appendChild(qElement);
    });
    Sortable.create(questionList, { handle: '.drag-handle', animation: 150, onEnd: (evt) => { reorderQuestionInData(selectedSubCategoryId, evt.oldIndex, evt.newIndex); renderQuestionList(); } });
}

function renderSubCategorySettings() {
    const subCategoryNameInput = document.getElementById('sub-category-name-edit');
    const subCategoryDescriptionInput = document.getElementById('sub-category-description-edit');
    const subCategoryColorInput = document.getElementById('sub-category-color-edit');
    const subCategoryPasswordInput = document.getElementById('sub-category-password-edit');
    const subCategoryRandomCheckbox = document.getElementById('sub-category-random-edit');
    const subCategoryGuestCheckbox = document.getElementById('sub-category-guest-edit');
    if (!selectedSubCategoryId) return;
    const subCat = findSubCategoryById(selectedSubCategoryId);
    if (!subCat) return;
    subCategoryNameInput.value = subCat.name;
    subCategoryDescriptionInput.value = subCat.description || '';
    subCategoryColorInput.value = subCat.color || '#cccccc';
    subCategoryPasswordInput.value = subCat.password || '';
    subCategoryRandomCheckbox.checked = !!subCat.randomOrder;
    subCategoryGuestCheckbox.checked = !!subCat.isGuestAllowed;
}
// Part 3/3: Data Collection, Server Communication, and Event Listeners

function collectUIData() {
    if (!selectedSubCategoryId) return;
    const subCat = findSubCategoryById(selectedSubCategoryId);
    if (!subCat) return;
    const subCategoryNameInput = document.getElementById('sub-category-name-edit');
    const subCategoryDescriptionInput = document.getElementById('sub-category-description-edit');
    const subCategoryColorInput = document.getElementById('sub-category-color-edit');
    const subCategoryPasswordInput = document.getElementById('sub-category-password-edit');
    const subCategoryRandomCheckbox = document.getElementById('sub-category-random-edit');
    const subCategoryGuestCheckbox = document.getElementById('sub-category-guest-edit');
    const questionList = document.getElementById('question-list');

    subCat.name = subCategoryNameInput.value.trim();
    subCat.description = subCategoryDescriptionInput.value.trim();
    subCat.color = subCategoryColorInput.value;
    subCat.password = subCategoryPasswordInput.value.trim() || null;
    subCat.randomOrder = subCategoryRandomCheckbox.checked;
    subCat.isGuestAllowed = subCategoryGuestCheckbox.checked;
    const newQuestions = [];
    questionList.querySelectorAll('.question-item').forEach(item => {
        const qImgContainer = item.querySelectorAll('.image-upload-container')[0];
        const exImgContainer = item.querySelectorAll('.image-upload-container')[1];
        const qImgSrc = qImgContainer.querySelector('img').getAttribute('src');
        const exImgSrc = exImgContainer.querySelector('img').getAttribute('src');

        const questionType = item.querySelector('.question-type-select').value;
        let newAnswers = [];
        let isMultipleChoice = false;

        if (questionType === 'fill-in-the-blank') {
            const answersText = item.querySelector('.fill-in-the-blank-answers').value;
            newAnswers = answersText.split(',').map(text => text.trim()).filter(text => text).map(text => ({ text: text, correct: true }));
        } else {
            isMultipleChoice = item.querySelector('.is-multiple-choice-input').checked;
            item.querySelectorAll('.answer-item').forEach(ansItem => {
                newAnswers.push({
                    text: ansItem.querySelector('.answer-text').value,
                    correct: ansItem.querySelector('.is-correct-input').checked
                });
            });
        }

        newQuestions.push({
            question: item.querySelector('.question-text').value,
            questionImage: qImgSrc && qImgSrc.startsWith('.') ? new URL(qImgSrc, location.href).pathname.replace('/admin-tool', '') : (qImgSrc || null),
            questionType: questionType,
            isMultipleChoice: isMultipleChoice,
            answers: newAnswers,
            explanation: item.querySelector('.explanation-text').value,
            explanationImage: exImgSrc && exImgSrc.startsWith('.') ? new URL(exImgSrc, location.href).pathname.replace('/admin-tool', '') : (exImgSrc || null),
        });
    });
    subCat.questions = newQuestions;
}

async function saveToServer() {
    collectUIData();
    const categoryListContainer = document.getElementById('category-list-container');
    const mainCategoryItems = categoryListContainer.querySelectorAll('.main-category-item');
    const newMainCategories = Array.from(mainCategoryItems).map(mainCatItem => {
        const mainCatId = mainCatItem.dataset.mainId;
        const mainCat = allData.mainCategories.find(mc => mc.id === mainCatId);
        if (!mainCat) return null;
        const subCategoryItems = mainCatItem.querySelectorAll('.sub-category-item');
        mainCat.subCategories = Array.from(subCategoryItems).map(subCatItem => {
            const subCatId = subCatItem.dataset.subId;
            return mainCat.subCategories.find(sc => sc.id === subCatId);
        }).filter(Boolean);
        return mainCat;
    }).filter(Boolean);
    allData.mainCategories = newMainCategories;
    setSaveStatus('saving');
    try {
        const response = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allData, null, 2) });
        const result = await response.json();
        if (result.success) {
            setSaveStatus('saved', '正常に保存されました');
            isDirty = false;
        } else {
            setSaveStatus('error', result.message || '保存に失敗');
        }
    } catch (error) {
        setSaveStatus('error', 'サーバー接続エラー');
    }
}

function showCustomConfirm(message, onOk) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const messageEl = document.getElementById('custom-confirm-message');
    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');
    messageEl.textContent = message;
    overlay.classList.remove('custom-confirm-hidden');
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    const closeDialog = () => overlay.classList.add('custom-confirm-hidden');
    newOkBtn.addEventListener('click', () => { onOk(); closeDialog(); }, { once: true });
    newCancelBtn.addEventListener('click', closeDialog, { once: true });
}

function updateImagePreview(container, imageUrl) {
    if (!container) return;
    const preview = container.querySelector('.image-preview');
    const img = preview.querySelector('img');
    const uploadBtn = container.querySelector('.image-upload-btn');
    if (imageUrl) {
        img.src = `.${imageUrl}`;
        preview.style.display = 'block';
        uploadBtn.style.display = 'none';
    } else {
        preview.style.display = 'none';
        img.src = '';
        uploadBtn.style.display = 'block';
    }
}

async function handleImageUpload(file, questionIndex, imageType) {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            const subCat = findSubCategoryById(selectedSubCategoryId);
            if (subCat?.questions?.[questionIndex]) {
                subCat.questions[questionIndex][imageType === 'question' ? 'questionImage' : 'explanationImage'] = result.imageUrl;
            }
            markAsDirty();
            const questionItem = document.querySelector(`.question-item[data-index="${questionIndex}"]`);
            if (questionItem) {
                const containers = questionItem.querySelectorAll('.image-upload-container');
                updateImagePreview(imageType === 'question' ? containers[0] : containers[1], result.imageUrl);
            }
        } else {
            alert(`画像アップロード失敗: ${result.message}`);
        }
    } catch (error) {
        console.error('画像アップロードエラー:', error);
        alert('画像アップロード中にエラーが発生しました。');
    }
}

// --- イベントリスナーの初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const addMainCategoryBtn = document.getElementById('add-main-category-btn');
    const deleteSubCategoryBtn = document.getElementById('delete-sub-category-btn');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const questionList = document.getElementById('question-list');
    const categoryListContainer = document.getElementById('category-list-container');
    const editorArea = document.getElementById('editor-area');
    const saveToServerBtn = document.getElementById('save-to-server-btn');
    const tabNav = document.querySelector('.tab-nav');
    const showHistoryBtn = document.getElementById('show-history-btn');
    const changeHistoryPanel = document.getElementById('change-history-panel');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const exportHistoryBtn = document.getElementById('export-history-btn');

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminPasswordInput = document.getElementById('admin-password-input');
        const authMessage = document.getElementById('auth-message');
        authMessage.textContent = '';
        const password = adminPasswordInput.value;
        try {
            const response = await fetch(window.location.origin + '/api/v1/auth/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            if (response.ok && data.authenticated) {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('admin-content').style.display = 'block';
                loadInitialData();
            } else {
                authMessage.textContent = data.message || '認証に失敗しました。パスワードを確認してください。';
                adminPasswordInput.value = '';
            }
        } catch (error) {
            console.error('認証エラー:', error);
            authMessage.textContent = 'サーバーとの通信に失敗しました。';
        }
    });

    async function loadInitialData() {
        changeHistoryManager = new ChangeHistoryManager();
        try {
            const response = await fetch(`/api/quiz-data?t=${new Date().getTime()}`);
            allData = response.ok ? await response.json() : { mainCategories: [] };
            if (!allData || !Array.isArray(allData.mainCategories)) allData = { mainCategories: [] };
        } catch (error) {
            console.error('データ読込エラー:', error);
            allData = { mainCategories: [] };
            setSaveStatus('error', 'データ読込失敗');
        } finally {
            renderCategoryList();
            setSaveStatus('saved');
        }
    }

    addMainCategoryBtn.addEventListener('click', () => {
        const newMainCategoryInput = document.getElementById('new-main-category-name');
        const name = newMainCategoryInput.value.trim();
        if (!name) return alert('大カテゴリ名を入力してください。');
        const newMainCategory = { id: 'main_' + Date.now(), name, subCategories: [] };
        addMainCategoryToData(newMainCategory);
        newMainCategoryInput.value = '';
        renderCategoryList();
    });

    deleteSubCategoryBtn.addEventListener('click', () => {
        if (!selectedSubCategoryId) return;
        const subCat = findSubCategoryById(selectedSubCategoryId);
        if (!subCat) return;
        showCustomConfirm(`小カテゴリ「${subCat.name}」を削除しますか？`, () => {
            removeSubCategoryFromData(selectedSubCategoryId);
            selectedSubCategoryId = null;
            hideEditor();
            renderCategoryList();
        });
    });

    addQuestionBtn.addEventListener('click', () => {
        if (!selectedSubCategoryId) return;
        const newQuestion = {
            question: "新しい問題文を入力してください。",
            questionImage: null,
            questionType: 'single',
            isMultipleChoice: false,
            answers: [
                { text: "選択肢1 (正解)", correct: true },
                { text: "選択肢2", correct: false },
                { text: "選択肢3", correct: false },
                { text: "選択肢4", correct: false }
            ],
            explanation: "ここに解説文を入力してください。",
            explanationImage: null
        };
        addQuestionToData(selectedSubCategoryId, newQuestion);
        renderQuestionList();
    });

    questionList.addEventListener('click', (e) => {
        const questionItem = e.target.closest('.question-item');
        if (!questionItem) return;
        const questionIndex = parseInt(questionItem.dataset.index, 10);
        if (e.target.closest('.delete-question-btn')) {
            showCustomConfirm(`問題 ${questionIndex + 1} を削除しますか？`, () => {
                removeQuestionFromData(selectedSubCategoryId, questionIndex);
                renderQuestionList();
            });
        } else if (e.target.closest('.image-upload-btn')) {
            const container = e.target.closest('.image-upload-container');
            container.querySelector('.image-upload-input').click();
        } else if (e.target.closest('.delete-image-btn')) {
            const container = e.target.closest('.image-upload-container');
            const isQuestionImage = Array.from(questionItem.querySelectorAll('.image-upload-container')).indexOf(container) === 0;
            showCustomConfirm('この画像を削除しますか？', () => {
                const subCat = findSubCategoryById(selectedSubCategoryId);
                if (subCat?.questions?.[questionIndex]) {
                    subCat.questions[questionIndex][isQuestionImage ? 'questionImage' : 'explanationImage'] = null;
                }
                markAsDirty();
                renderQuestionList();
            });
        }
    });

    questionList.addEventListener('change', (e) => {
        const questionItem = e.target.closest('.question-item');
        if (!questionItem) return;
        markAsDirty();
        if (e.target.classList.contains('image-upload-input') && e.target.files.length > 0) {
            const questionIndex = parseInt(questionItem.dataset.index, 10);
            const container = e.target.closest('.image-upload-container');
            const isQuestionImage = Array.from(questionItem.querySelectorAll('.image-upload-container')).indexOf(container) === 0;
            handleImageUpload(e.target.files[0], questionIndex, isQuestionImage ? 'question' : 'explanation');
        }
    });

    categoryListContainer.addEventListener('click', (e) => {
        const mainItem = e.target.closest('.main-category-item');
        if (!mainItem) return;
        if (e.target.closest('.main-category-header') && !e.target.closest('button')) {
            mainItem.classList.toggle('open');
        } else if (e.target.closest('.delete-main-category-btn')) {
            const mainCat = allData.mainCategories.find(mc => mc.id === mainItem.dataset.mainId);
            if (mainCat) {
                showCustomConfirm(`大カテゴリ「${mainCat.name}」を削除しますか？`, () => {
                    if (mainCat.subCategories?.some(sc => sc.id === selectedSubCategoryId)) {
                        selectedSubCategoryId = null;
                        hideEditor();
                    }
                    removeMainCategoryFromData(mainItem.dataset.mainId);
                    renderCategoryList();
                });
            }
        } else if (e.target.closest('.sub-category-item')) {
            selectSubCategory(e.target.closest('.sub-category-item').dataset.subId);
        } else if (e.target.closest('.add-sub-category-btn')) {
            const input = mainItem.querySelector('.new-sub-category-name');
            const name = input.value.trim();
            if (!name) return alert('小カテゴリ名を入力してください。');
            const newSubCategory = { id: 'sub_' + Date.now(), name, description: '', color: '#cccccc', password: null, randomOrder: false, questions: [] };
            addSubCategoryToData(mainItem.dataset.mainId, newSubCategory);
            input.value = '';
            renderCategoryList();
        }
    });

    editorArea.addEventListener('input', (e) => {
        if (e.target.closest('.question-item') || e.target.closest('#tab-settings')) {
            markAsDirty();
        }
    });

    editorArea.addEventListener('change', (e) => {
        if (e.target.type === 'color' || e.target.type === 'checkbox') {
            markAsDirty();
        }
    });

    saveToServerBtn.addEventListener('click', saveToServer);

    tabNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-link')) {
            const targetTabId = e.target.dataset.tab;
            tabNav.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(targetTabId).classList.add('active');
        }
    });

    showHistoryBtn.addEventListener('click', () => {
        renderChangeHistory();
        changeHistoryPanel.style.display = 'flex';
    });

    closeHistoryBtn.addEventListener('click', () => {
        changeHistoryPanel.style.display = 'none';
    });

    clearHistoryBtn.addEventListener('click', () => {
        showCustomConfirm('変更履歴をすべてクリアしますか？', () => {
            changeHistoryManager.clearHistory();
            renderChangeHistory();
        });
    });

    exportHistoryBtn.addEventListener('click', () => {
        const historyJson = changeHistoryManager.exportHistory();
        const blob = new Blob([historyJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `change-history-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // --- パスワード変更モーダルの制御 ---
    const passwordModal = document.getElementById('password-change-modal');
    const openPasswordModalBtn = document.getElementById('open-password-modal-btn');
    const closePasswordModalBtn = document.getElementById('close-password-modal-btn');
    const savePasswordBtn = document.getElementById('save-password-btn');

    if (openPasswordModalBtn) {
        openPasswordModalBtn.addEventListener('click', () => {
            passwordModal.style.display = 'flex';
        });
    }

    if (closePasswordModalBtn) {
        closePasswordModalBtn.addEventListener('click', () => {
            passwordModal.style.display = 'none';
        });
    }

    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById('new-admin-password').value;
            const confirmPassword = document.getElementById('confirm-admin-password').value;

            if (!newPassword || newPassword.length < 4) {
                alert('パスワードは4文字以上で入力してください。');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('パスワードが一致しません。');
                return;
            }

            try {
                const response = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                });

                const data = await response.json();
                if (data.success) {
                    alert('パスワードを変更しました。次回ログイン時から有効になります。');
                    passwordModal.style.display = 'none';
                    // 入力欄をクリア
                    document.getElementById('new-admin-password').value = '';
                    document.getElementById('confirm-admin-password').value = '';
                } else {
                    alert('変更失敗: ' + data.message);
                }
            } catch (error) {
                console.error('Password change error:', error);
                alert('通信エラーが発生しました。');
            }
        });
    }

    function renderChangeHistory() {
        const changeHistoryList = document.getElementById('change-history-list');
        const history = changeHistoryManager.getHistory(50);
        if (history.length === 0) {
            changeHistoryList.innerHTML = '<div class="history-empty">変更履歴がありません</div>';
            return;
        }
        changeHistoryList.innerHTML = history.map(change => {
            const formattedChange = changeHistoryManager.formatChange(change);
            return `<div class="history-item">${formattedChange}</div>`;
        }).join('');
    }
});
