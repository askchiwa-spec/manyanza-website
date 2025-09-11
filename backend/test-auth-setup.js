// Quick test script to verify OAuth configuration
require('dotenv').config();

console.log('🔍 Manyanza OAuth Configuration Check');
console.log('=====================================');

// Check required environment variables
const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'SESSION_SECRET',
    'CALLBACK_URL'
];

let allConfigured = true;

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.includes('paste_') || value.includes('your_')) {
        console.log(`❌ ${varName}: NOT CONFIGURED`);
        allConfigured = false;
    } else {
        // Hide sensitive values
        const display = varName.includes('SECRET') ? 
            `${value.substring(0, 8)}...` : 
            value.length > 50 ? `${value.substring(0, 50)}...` : value;
        console.log(`✅ ${varName}: ${display}`);
    }
});

console.log('');

if (allConfigured) {
    console.log('🎉 OAuth configuration looks good!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Make sure you added test users in Google Cloud Console');
    console.log('2. Start the server: node auth-server.js');
    console.log('3. Visit: http://localhost:8080');
    console.log('4. Test authentication with your Gmail account');
} else {
    console.log('⚠️  Please complete the OAuth configuration in .env file');
    console.log('');
    console.log('📝 Missing configuration:');
    console.log('1. Get Client Secret from Google Cloud Console');
    console.log('2. Update GOOGLE_CLIENT_SECRET in .env file');
    console.log('3. Ensure other values are properly set');
}

console.log('');
console.log('🔗 Your OAuth Client ID: ' + process.env.GOOGLE_CLIENT_ID);
console.log('🔗 Your Callback URL: ' + process.env.CALLBACK_URL);