const Database = require('./database/db');
const bcrypt = require('bcryptjs');

const db = new Database().getConnection();

// Test the database query and bcrypt comparison
db.get(
    'SELECT * FROM users WHERE email = ? AND role = "super_admin" AND is_active = 1',
    ['admin@manyanza.co.tz'],
    async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return;
        }
        
        if (!user) {
            console.log('User not found');
            return;
        }
        
        console.log('User found:', user);
        
        const password = 'manyanza2025';
        const isMatch = bcrypt.compareSync(password, user.password_hash);
        console.log('Password match:', isMatch);
    }
);