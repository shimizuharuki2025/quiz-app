const fs = require('fs');
const path = require('path');
const https = require('https');

module.exports = function (app, DATA_DIR) {
    const cachePath = path.join(DATA_DIR, 'translation-cache.json');

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

    // Google翻訳匿名エンドポイントによる翻訳
    function translateWithGoogle(text, targetLang) {
        return new Promise((resolve, reject) => {
            const encodedText = encodeURIComponent(text);
            // 匿名で利用可能なエンドポイント (gtx)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${targetLang}&dt=t&q=${encodedText}`;

            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        // [[["翻訳結果","原文",...]]] という形式で返る
                        if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
                            // 複数行に分かれている場合を考慮して結合
                            const translatedText = parsed[0].map(item => item[0]).join('');
                            resolve(translatedText);
                        } else {
                            reject(new Error('翻訳結果のパース失敗'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (e) => {
                reject(e);
            });
        });
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

        // キャッシュがなければGoogleで翻訳
        try {
            console.log(`[Google Translate] ${targetLang}: ${text.substring(0, 20)}...`);
            const translatedText = await translateWithGoogle(text, targetLang);

            // キャッシュに保存
            cache[cacheKey] = translatedText;
            saveCache(cache);

            res.json({ success: true, translatedText, cached: false });
        } catch (error) {
            console.error('翻訳エラー:', error);
            res.status(500).json({ success: false, message: '翻訳サービスに一時的にアクセスできません。' });
        }
    });

    console.log('✓ 翻訳プロキシAPIを初期化しました（登録不要・匿名方式）');
};
