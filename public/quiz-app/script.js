// Version: 2026-01-15-001 - Add user authentication integration
window.onload = async function () {

    // ========================================
    // ユーザー認証機能の初期化
    // ========================================
    if (typeof initializeAuth === 'function') {
        await initializeAuth();
        setupAuthEventListeners();
    }

    const APP_PASSWORD = '3963';

    const correctSound = new Audio('sounds/correct.mp3');
    const incorrectSound = new Audio('sounds/incorrect.mp3');
    correctSound.volume = 0.7;
    incorrectSound.volume = 0.7;

    const screens = {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
    };
    const homeElements = {
        accordionContainer: document.getElementById('accordion-container'),
        passwordModal: document.getElementById('password-modal'),
        passwordCategoryName: document.getElementById('password-category-name'),
        passwordInput: document.getElementById('password-input'),
        passwordSubmitBtn: document.getElementById('password-submit'),
        passwordCancelBtn: document.getElementById('password-cancel'),
    };
    const appPasswordElements = {
        modal: document.getElementById('app-password-modal'),
        form: document.getElementById('app-password-form'),
        input: document.getElementById('app-password-input'),
    };
    const quizElements = {
        muteBtn: document.getElementById('mute-btn'),
        quitQuizBtn: document.getElementById('quit-quiz-btn'),
        progressBar: document.getElementById('progress-bar'),
        questionNumber: document.getElementById('question-number'),
        questionText: document.getElementById('question-text'),
        questionImage: document.getElementById('question-image'),
        answerButtons: document.getElementById('answer-buttons'),
        fillInTheBlankContainer: document.getElementById('fill-in-the-blank-container'),
        fillInTheBlankInput: document.getElementById('fill-in-the-blank-input'),
        confirmAnswerBtn: document.getElementById('confirm-answer-btn'),
        explanationContainer: document.getElementById('explanation-container'),
        feedbackTitle: document.getElementById('feedback-title'),
        explanationText: document.getElementById('explanation-text'),
        explanationImage: document.getElementById('explanation-image'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        fontSizeUpBtn: document.getElementById('font-size-up'),
        fontSizeDownBtn: document.getElementById('font-size-down'),
    };
    const resultElements = {
        scoreText: document.getElementById('score-text'),
        evaluationText: document.getElementById('evaluation-text'),
        highScoreText: document.getElementById('high-score-text'),
        restartBtn: document.getElementById('restart-btn'),
        backToHomeBtn: document.getElementById('back-to-home-btn'),
        reviewIncorrectBtn: document.getElementById('review-incorrect-btn'),
        incorrectListContainer: document.getElementById('incorrect-list-container'),
        incorrectList: document.getElementById('incorrect-list'),
    };

    let quizData = null;
    let currentQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let incorrectQuestions = [];
    let selectedSubCategoryId = null;
    let isSoundEnabled = localStorage.getItem('isSoundEnabled') !== 'false';
    let currentFontSizeLevel = 1;
    const FONT_SIZE_LEVELS = {
        question: ['1.2rem', '1.5rem', '1.8rem'],
        answer: ['0.9rem', '1.1rem', '1.3rem']
    };

    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } return array; }
    function showScreen(screenName) { Object.values(screens).forEach(screen => screen.style.display = 'none'); if (screens[screenName]) screens[screenName].style.display = 'block'; }
    function applyFontSize() {
        const questionSize = FONT_SIZE_LEVELS.question[currentFontSizeLevel];
        const answerSize = FONT_SIZE_LEVELS.answer[currentFontSizeLevel];
        quizElements.questionText.style.setProperty('font-size', questionSize, 'important');
        quizElements.answerButtons.querySelectorAll('button').forEach(button => {
            button.style.setProperty('font-size', answerSize, 'important');
        });
    }

    // 画像パスの正規化ヘルパー
    function getImageUrl(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        if (path.startsWith('/')) return path; // ルートからの絶対パス
        return `../${path}`; // 相対パス
    }

    async function loadQuizData() {
        try {
            const response = await fetch(`/api/quiz-data?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error(`サーバーエラー (HTTP ${response.status})`);
            quizData = await response.json();
            if (!quizData || !Array.isArray(quizData.mainCategories)) throw new Error('データ形式が不正です。');

            // 認証初期化を確実に待ってからホーム画面を表示
            if (typeof initializeAuth === 'function') {
                await initializeAuth();
            }

            // ログイン済みユーザーまたはゲストモードの場合、パスワードモーダルをスキップ
            if (window.currentUser || window.isGuestMode) {
                initializeAndShowHomeScreen();
            } else {
                appPasswordElements.modal.style.display = 'flex';
                appPasswordElements.input.focus();
            }
        } catch (error) {
            console.error('クイズデータの読み込み失敗:', error);
            document.querySelector('.app-container').innerHTML = `<div style="text-align: center; padding: 40px;"><h1>エラー</h1><p>クイズデータの読み込みに失敗しました。</p><p style="color: red;">詳細: ${error.message}</p></div>`;
            appPasswordElements.modal.style.display = 'none';
        }
    }

    function initializeAndShowHomeScreen() {
        showScreen('home');
        homeElements.accordionContainer.innerHTML = '';
        if (!quizData?.mainCategories?.length) {
            homeElements.accordionContainer.innerHTML = '<p style="text-align: center; color: #d9534f;">現在挑戦できるカテゴリがありません。</p>';
            return;
        }
        quizData.mainCategories.forEach(mainCategory => {
            const mainCategoryDiv = document.createElement('div');
            mainCategoryDiv.className = 'main-category';
            const header = document.createElement('div');
            header.className = 'main-category-header';
            header.textContent = mainCategory.name;
            header.addEventListener('click', () => mainCategoryDiv.classList.toggle('open'));
            mainCategoryDiv.appendChild(header);
            const subList = document.createElement('div');
            subList.className = 'sub-category-list';
            if (mainCategory.subCategories?.length > 0) {
                mainCategory.subCategories.forEach(subCategory => {
                    const item = document.createElement('div');
                    item.className = 'sub-category-item';
                    item.dataset.subCategoryId = subCategory.id;

                    // ゲストアクセスの判定を厳格化（trueの場合のみ許可、それ以外は制限）
                    const isRestrictedForGuest = window.isGuestMode && subCategory.isGuestAllowed !== true;
                    if (isRestrictedForGuest) {
                        item.classList.add('restricted');
                    }

                    const highScore = localStorage.getItem(`highScore_${subCategory.id}`) || 0;

                    let badgeHtml = '';
                    if (subCategory.isGuestAllowed) {
                        badgeHtml = '<span class="guest-badge">お試しプレイ</span>';
                    } else if (window.isGuestMode) {
                        badgeHtml = '<span class="lock-icon">🔒</span>';
                    }

                    item.innerHTML = `
                        <div class="icon" style="background-color: ${subCategory.color || '#cccccc'};"></div>
                        ${badgeHtml}
                        <div class="name">${subCategory.name}</div>
                        <div class="highscore">HS: ${highScore}点</div>`;

                    item.addEventListener('click', () => {
                        if (isRestrictedForGuest) {
                            alert('このカテゴリはメンバー専用です。\nログインするとプレイ・記録ができます！');
                            return;
                        }

                        selectedSubCategoryId = subCategory.id;
                        if (subCategory.password) {
                            homeElements.passwordCategoryName.textContent = subCategory.name;
                            homeElements.passwordModal.style.display = 'flex';
                            homeElements.passwordInput.value = '';
                            homeElements.passwordInput.focus();
                        } else {
                            startQuiz(subCategory.id);
                        }
                    });
                    subList.appendChild(item);
                });
            }
            mainCategoryDiv.appendChild(subList);
            homeElements.accordionContainer.appendChild(mainCategoryDiv);
        });
    }

    function startQuiz(subCategoryId, isReview = false) {
        let questionsToLoad;
        if (isReview) {
            if (!incorrectQuestions?.length) return alert('復習する問題がありません。');
            questionsToLoad = [...incorrectQuestions];
        } else {
            const selectedSubCategory = quizData.mainCategories.flatMap(main => main.subCategories).find(sub => sub.id === subCategoryId);
            if (!selectedSubCategory?.questions?.length) return alert('このカテゴリには問題がありません。');
            questionsToLoad = selectedSubCategory.randomOrder ? shuffleArray([...selectedSubCategory.questions]) : [...selectedSubCategory.questions];
        }
        currentQuestions = questionsToLoad;
        currentQuestionIndex = 0;
        score = 0;
        incorrectQuestions = [];
        showScreen('quiz');
        displayQuestion();
    }

    function displayQuestion() {
        quizElements.explanationContainer.style.display = 'none';
        quizElements.answerButtons.innerHTML = '';
        quizElements.answerButtons.style.display = 'none';
        quizElements.fillInTheBlankContainer.style.display = 'none';
        quizElements.fillInTheBlankInput.value = '';
        quizElements.fillInTheBlankInput.disabled = false;
        quizElements.fillInTheBlankInput.className = '';
        quizElements.confirmAnswerBtn.style.display = 'none';

        // イベントリスナーの蓄積を防ぐため、onclickを使用
        quizElements.confirmAnswerBtn.onclick = null;

        const question = currentQuestions[currentQuestionIndex];
        const questionType = question.questionType || (question.isMultipleChoice ? 'multiple' : 'single');

        quizElements.progressBar.style.width = `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%`;
        quizElements.questionNumber.textContent = `第${currentQuestionIndex + 1}問`;
        quizElements.questionText.textContent = question.question;

        if (question.questionImage) {
            quizElements.questionImage.src = getImageUrl(question.questionImage);
            quizElements.questionImage.style.display = 'block';
        } else {
            quizElements.questionImage.style.display = 'none';
        }

        switch (questionType) {
            case 'single':
            case 'multiple':
                quizElements.answerButtons.style.display = 'grid';
                const shuffledAnswers = shuffleArray([...question.answers]);
                shuffledAnswers.forEach(answer => {
                    const button = document.createElement('button');
                    button.textContent = answer.text;
                    button.dataset.text = answer.text;
                    if (questionType === 'multiple') {
                        button.addEventListener('click', () => button.classList.toggle('selected'));
                    } else {
                        button.addEventListener('click', () => selectAnswer(answer, button));
                    }
                    quizElements.answerButtons.appendChild(button);
                });
                if (questionType === 'multiple') {
                    quizElements.confirmAnswerBtn.style.display = 'block';
                    quizElements.confirmAnswerBtn.onclick = () => {
                        const selectedButtons = quizElements.answerButtons.querySelectorAll('button.selected');
                        checkMultipleAnswers(selectedButtons);
                    };
                }
                break;

            case 'fill-in-the-blank':
                quizElements.fillInTheBlankContainer.style.display = 'block';
                quizElements.confirmAnswerBtn.style.display = 'block';
                quizElements.fillInTheBlankInput.focus();
                quizElements.confirmAnswerBtn.onclick = () => {
                    checkFillInTheBlankAnswer();
                };
                break;
        }
        applyFontSize();
    }

    function selectAnswer(answer, button) {
        Array.from(quizElements.answerButtons.children).forEach(btn => btn.disabled = true);
        const question = currentQuestions[currentQuestionIndex];
        if (answer.correct) {
            score++;
            if (isSoundEnabled) correctSound.play();
            quizElements.feedbackTitle.textContent = '正解！';
            button.classList.add('correct');
        } else {
            if (isSoundEnabled) incorrectSound.play();
            quizElements.feedbackTitle.textContent = '不正解...';
            button.classList.add('incorrect');
            incorrectQuestions.push(question);
            const correctButton = Array.from(quizElements.answerButtons.children).find(btn => {
                const originalCorrectAnswer = question.answers.find(a => a.correct);
                return btn.dataset.text === originalCorrectAnswer.text;
            });
            if (correctButton) correctButton.classList.add('correct');
        }
        showExplanation(question);
    }

    function checkMultipleAnswers(selectedButtons) {
        Array.from(quizElements.answerButtons.children).forEach(btn => btn.disabled = true);
        quizElements.confirmAnswerBtn.style.display = 'none';
        const question = currentQuestions[currentQuestionIndex];
        const correctAnswers = question.answers.filter(a => a.correct).map(a => a.text);
        const selectedAnswers = Array.from(selectedButtons).map(btn => btn.dataset.text);
        const isPerfectlyCorrect = correctAnswers.length === selectedAnswers.length && correctAnswers.every(ans => selectedAnswers.includes(ans));
        if (isPerfectlyCorrect) {
            score++;
            if (isSoundEnabled) correctSound.play();
            quizElements.feedbackTitle.textContent = '正解！';
            selectedButtons.forEach(btn => btn.classList.add('correct'));
        } else {
            if (isSoundEnabled) incorrectSound.play();
            quizElements.feedbackTitle.textContent = '不正解...';
            incorrectQuestions.push(question);
            quizElements.answerButtons.querySelectorAll('button').forEach(btn => {
                const answerText = btn.dataset.text;
                const isCorrectChoice = correctAnswers.includes(answerText);
                const wasSelected = selectedAnswers.includes(answerText);
                if (isCorrectChoice) btn.classList.add('correct');
                else if (wasSelected) btn.classList.add('incorrect');
            });
        }
        showExplanation(question);
    }

    function checkFillInTheBlankAnswer() {
        quizElements.fillInTheBlankInput.disabled = true;
        quizElements.confirmAnswerBtn.style.display = 'none';
        const question = currentQuestions[currentQuestionIndex];
        const correctAnswers = question.answers.filter(a => a.correct).map(a => a.text);
        const userAnswer = quizElements.fillInTheBlankInput.value.trim();
        const isCorrect = correctAnswers.includes(userAnswer);

        if (isCorrect) {
            score++;
            if (isSoundEnabled) correctSound.play();
            quizElements.feedbackTitle.textContent = '正解！';
            quizElements.fillInTheBlankInput.classList.add('correct');
        } else {
            if (isSoundEnabled) incorrectSound.play();
            quizElements.feedbackTitle.textContent = '不正解...';
            incorrectQuestions.push(question);
            quizElements.fillInTheBlankInput.classList.add('incorrect');
        }
        showExplanation(question);
    }

    function showExplanation(question) {
        if (question.explanationImage) {
            quizElements.explanationImage.src = getImageUrl(question.explanationImage);
            quizElements.explanationImage.style.display = 'block';
        } else {
            quizElements.explanationImage.style.display = 'none';
        }
        quizElements.explanationText.textContent = question.explanation;
        quizElements.explanationContainer.style.display = 'block';
        applyFontSize();
    }

    function nextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            showResult();
        }
    }

    function showResult() {
        showScreen('result');
        const finalScore = currentQuestions.length > 0 ? Math.round((score / currentQuestions.length) * 100) : 0;
        resultElements.scoreText.textContent = `スコア: ${finalScore}点`;
        let evaluation = 'まだまだこれから！復習しましょう。';
        if (finalScore === 100) evaluation = '素晴らしい！完璧です！';
        else if (finalScore >= 80) evaluation = '優秀です！あと少し！';
        else if (finalScore >= 60) evaluation = '良い調子です！';
        resultElements.evaluationText.textContent = evaluation;
        const highScoreKey = `highScore_${selectedSubCategoryId}`;
        const currentHighScore = localStorage.getItem(highScoreKey) || 0;
        if (finalScore > currentHighScore) {
            localStorage.setItem(highScoreKey, finalScore);
            resultElements.highScoreText.textContent = `ハイスコア更新！: ${finalScore}点`;
        } else {
            resultElements.highScoreText.textContent = `ハイスコア: ${currentHighScore}点`;
        }
        resultElements.incorrectList.innerHTML = '';
        resultElements.incorrectListContainer.style.display = incorrectQuestions.length > 0 ? 'block' : 'none';
        resultElements.reviewIncorrectBtn.style.display = incorrectQuestions.length > 0 ? 'inline-block' : 'none';
        if (incorrectQuestions.length > 0) {
            incorrectQuestions.forEach(q => {
                const item = document.createElement('div');
                item.className = 'incorrect-question-item';
                item.innerHTML = `<p class="incorrect-q"><strong>Q.</strong> ${q.question}</p><p class="incorrect-a"><strong>A.</strong> ${q.explanation}</p>`;
                resultElements.incorrectList.appendChild(item);
            });
        }

        // ========================================
        // 学習記録を保存（ログインユーザーのみ）
        // ========================================
        if (typeof recordLearning === 'function') {
            const selectedSubCategory = quizData.mainCategories
                .flatMap(main => main.subCategories)
                .find(sub => sub.id === selectedSubCategoryId);

            if (selectedSubCategory) {
                recordLearning({
                    categoryId: selectedSubCategoryId,
                    categoryName: selectedSubCategory.name,
                    score: finalScore,
                    totalQuestions: currentQuestions.length,
                    correctAnswers: score
                }).catch(err => {
                    console.error('学習記録の保存に失敗しました:', err);
                });
            }
        }
    }

    appPasswordElements.form.addEventListener('submit', (e) => { e.preventDefault(); if (appPasswordElements.input.value === APP_PASSWORD) { appPasswordElements.modal.style.display = 'none'; initializeAndShowHomeScreen(); } else { alert('パスワードが違います。'); appPasswordElements.input.value = ''; } });
    homeElements.passwordSubmitBtn.addEventListener('click', () => { const selectedSubCategory = quizData.mainCategories.flatMap(main => main.subCategories).find(sub => sub.id === selectedSubCategoryId); if (selectedSubCategory && homeElements.passwordInput.value === selectedSubCategory.password) { homeElements.passwordModal.style.display = 'none'; startQuiz(selectedSubCategoryId); } else { alert('パスワードが違います。'); homeElements.passwordInput.value = ''; } });
    homeElements.passwordCancelBtn.addEventListener('click', () => { homeElements.passwordModal.style.display = 'none'; });
    quizElements.muteBtn.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        localStorage.setItem('isSoundEnabled', isSoundEnabled);
        const iconSpan = quizElements.muteBtn.querySelector('.button-icon');
        if (iconSpan) {
            iconSpan.textContent = isSoundEnabled ? '🔊' : '🔇';
        }
        quizElements.muteBtn.classList.toggle('muted', !isSoundEnabled);
    });
    quizElements.quitQuizBtn.addEventListener('click', () => { if (confirm('クイズを中断してホーム画面に戻りますか？')) { initializeAndShowHomeScreen(); } });
    quizElements.nextQuestionBtn.addEventListener('click', nextQuestion);
    resultElements.restartBtn.addEventListener('click', () => startQuiz(selectedSubCategoryId));
    resultElements.backToHomeBtn.addEventListener('click', initializeAndShowHomeScreen);
    resultElements.reviewIncorrectBtn.addEventListener('click', () => startQuiz(selectedSubCategoryId, true));
    quizElements.fontSizeUpBtn.addEventListener('click', () => { if (currentFontSizeLevel < FONT_SIZE_LEVELS.question.length - 1) { currentFontSizeLevel++; applyFontSize(); } });
    quizElements.fontSizeDownBtn.addEventListener('click', () => { if (currentFontSizeLevel > 0) { currentFontSizeLevel--; applyFontSize(); } });

    const initialIconSpan = quizElements.muteBtn.querySelector('.button-icon');
    if (initialIconSpan) {
        initialIconSpan.textContent = isSoundEnabled ? '🔊' : '🔇';
    }
    quizElements.muteBtn.classList.toggle('muted', !isSoundEnabled);
    loadQuizData();
};
