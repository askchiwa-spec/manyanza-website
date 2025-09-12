const bcrypt = require('bcryptjs');

// Test the password hash
const password = 'manyanza2025';
const hash = '$2a$10$rQ8K9yQ8x5P9zX2N5L1m1eR6S7tU8vW9a0B1c2D3e4F5g6H7i8J9k0';

bcrypt.compare(password, hash, (err, result) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Password match:', result);
    }
});