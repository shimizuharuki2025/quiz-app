const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

module.exports = function (app, DATA_DIR) {
    const cachePath = path.join(DATA_DIR, 'translation-cache.json');
    const API_KEY = process.env.GEMINI_API_KEY;

    // キャッシュの読み込み
    function loadCache() {
        if (!fs.existsSync(cachePath)) return {};
        try {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } catch (e) {
            console.error('翻訳キャッシュの読み込み失敗:', e);
            return {};
        }
    }

    // キャッシュの保存
    function saveCache(cache) {
        try {
            fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
        } catch (e) {
            console.error('翻訳キャッシュの保存失敗:', e);
        }
    }

    // Gemini APIによる翻訳
    async function translateWithGemini(text, targetLang) {
        if (!API_KEY) {
            throw new Error('API_KEYが設定されていません。');
        }

        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Translate the following Japanese quiz text to ${targetLang}. 
Return ONLY the translated text. Do not include any explanations or extra characters.
Text: ${text}`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Gemini APIエラー:', error);
            if (error.message && error.message.includes('429')) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            }
            throw error;
        }
    }

    // 翻訳エンドポイント
    app.post('/api/translate', async (req, res) => {
        const { text, targetLang } = req.body;

        if (!text || !targetLang) {
            return res.status(400).json({ success: false, message: 'テキストと言語を指定してください。' });
        }

        const cache = loadCache();
        const cacheKey = `${text}_${targetLang}`;

        // キャッシュがあれば返す
        if (cache[cacheKey]) {
            console.log(`[Cache Hit] ${targetLang}: ${text.substring(0, 20)}...`);
            return res.json({ success: true, translatedText: cache[cacheKey], cached: true });
        }

        // キャッシュがなければAIで翻訳
        try {
            console.log(`[AI Translate] ${targetLang}: ${text.substring(0, 20)}...`);
            const translatedText = await translateWithGemini(text, targetLang);

            // キャッシュに保存
            cache[cacheKey] = translatedText;
            saveCache(cache);

            res.json({ success: true, translatedText, cached: false });
        } catch (error) {
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                return res.status(429).json({
                    success: false,
                    message: '翻訳サービスが混み合っております。1分ほど待ってから再度お試しください。'
                });
            }
            res.status(500).json({ success: false, message: '翻訳中にエラーが発生しました。' });
        }
    });

    console.log('✓ 翻訳プロキシAPIを初期化しました（Geminiモデル使用）');
};
