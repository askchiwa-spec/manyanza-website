const bcrypt = require('bcryptjs');

// Generate a new hash for the password
const password = 'manyanza2025';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('New hash:', hash);
    }
});