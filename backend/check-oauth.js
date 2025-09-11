require('dotenv').config();

console.log('🚗 Manyanza OAuth Configuration Status');
console.log('=====================================');
console.log('');

// Check Client ID
const clientId = process.env.GOOGLE_CLIENT_ID;
if (clientId === '783785527823-a3tu4v73ah1hbqe3g21hec8evs3jvivu.apps.googleusercontent.com') {
    console.log('✅ Client ID: Configured correctly');
} else {
    console.log('❌ Client ID: Not configured or incorrect');
}

// Check Client Secret
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientSecret || clientSecret.includes('REPLACE_WITH') || clientSecret.includes('paste_')) {
    console.log('❌ Client Secret: NOT CONFIGURED - Please get from Google Cloud Console');
    console.log('   📝 Go to: APIs & Services → Credentials → Edit your OAuth client');
} else if (clientSecret.startsWith('GOCSPX-') || clientSecret.length > 20) {
    console.log('✅ Client Secret: Configured');
} else {
    console.log('⚠️  Client Secret: May be incorrect format');
}

// Check other settings
console.log('✅ Callback URL: ' + process.env.CALLBACK_URL);
console.log('✅ Session Secret: Configured');
console.log('');

if (!clientSecret || clientSecret.includes('REPLACE_WITH')) {
    console.log('📋 Next Steps:');
    console.log('1. Go to Google Cloud Console');
    console.log('2. APIs & Services → Credentials');
    console.log('3. Edit "Manyanza Web Client"');
    console.log('4. Copy the Client Secret');
    console.log('5. Update .env file with the real Client Secret');
    console.log('');
} else {
    console.log('🎉 Configuration looks ready!');
    console.log('');
    console.log('📋 Ready to test:');
    console.log('1. Start server: node auth-server.js');
    console.log('2. Visit: http://localhost:8080');
    console.log('3. Click "Sign In" and test with your Gmail account');
    console.log('');
    console.log('💡 Remember: Only test users added in Google Console can sign in');
}