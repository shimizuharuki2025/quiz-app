const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Starting Safe Deployment Process...');

try {
    // 1. Run Integrity Check
    console.log('\n🔍 Phase 1: Verifying File Integrity...');
    execSync('node verify_integrity.js', { stdio: 'inherit' });

    // 2. Git Status Check
    console.log('\n📦 Phase 2: Checking Git Status...');
    const status = execSync('git status --porcelain').toString();
    if (!status) {
        console.log('✨ No changes to deploy.');
        process.exit(0);
    }
    console.log('Changes detected. Proceeding...');

    // 3. Git Add
    console.log('\n➕ Phase 3: Staging Changes...');
    execSync('git add .', { stdio: 'inherit' });

    // 4. Git Commit
    console.log('\n📝 Phase 4: Committing...');
    const commitMsg = process.argv[2] || `Auto-deploy: ${new Date().toISOString()}`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

    // 5. Git Push
    console.log('\nfw Phase 5: Pushing to Server...');
    execSync('git push origin main', { stdio: 'inherit' });

    console.log('\n✅ Deployment Command Sent Successfully!');
    console.log('⏳ Please wait ~3 minutes for Render to build and deploy.');

} catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED!');
    console.error('An error occurred during the process.');
    console.error(error.message);
    process.exit(1);
}
