const fs = require('fs');
const path = require('path');

const usersHtmlPath = path.join(__dirname, 'public', 'admin-tool', 'users.html');
const usersJsPath = path.join(__dirname, 'public', 'admin-tool', 'users_admin.js');

let hasError = false;

console.log('Verifying file integrity...');

// 1. Check if files exist
if (!fs.existsSync(usersHtmlPath)) {
    console.error(`❌ Missing file: ${usersHtmlPath}`);
    hasError = true;
} else {
    console.log(`✅ Found users.html`);
}

if (!fs.existsSync(usersJsPath)) {
    console.error(`❌ Missing file: ${usersJsPath}`);
    hasError = true;
} else {
    console.log(`✅ Found users_admin.js`);
}

// 2. Check users.html content
if (fs.existsSync(usersHtmlPath)) {
    const htmlContent = fs.readFileSync(usersHtmlPath, 'utf8');

    // Check for correct script reference
    if (!htmlContent.includes('users_admin.js')) {
        console.error(`❌ users.html does not reference users_admin.js`);
        hasError = true;
    } else {
        console.log(`✅ users.html references users_admin.js`);
    }

    // Check for truncation
    if (!htmlContent.includes('</html>')) {
        console.error(`❌ users.html appears to be truncated (missing </html>)`);
        hasError = true;
    } else {
        console.log(`✅ users.html is not truncated`);
    }

    // Check for bad patterns
    if (htmlContent.includes('/* ... */')) {
        console.error(`❌ users.html contains placeholder /* ... */`);
        hasError = true;
    }
    if (htmlContent.includes('<<<<') || htmlContent.includes('>>>>')) {
        console.error(`❌ users.html contains merge conflict markers`);
        hasError = true;
    }
}

// 3. Check users_admin.js content
if (fs.existsSync(usersJsPath)) {
    const jsContent = fs.readFileSync(usersJsPath, 'utf8');

    // Check for critical function
    if (!jsContent.includes('openPushModal')) {
        console.error(`❌ users_admin.js missing openPushModal function`);
        hasError = true;
    } else {
        console.log(`✅ users_admin.js contains openPushModal`);
    }
}

if (hasError) {
    console.error('\n🚨 Verification FAILED! Please fix errors before deploying.');
    process.exit(1);
} else {
    console.log('\n✨ Verification PASSED! Files look good.');
    process.exit(0);
}
