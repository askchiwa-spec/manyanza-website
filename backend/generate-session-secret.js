// Generate a secure session secret
const crypto = require('crypto');

const sessionSecret = crypto.randomBytes(64).toString('hex');

console.log('Generated session secret:');
console.log(sessionSecret);
console.log('');
console.log('Copy this into your .env file as SESSION_SECRET');