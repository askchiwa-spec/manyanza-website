const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Database = require('../database/db');

const db = new Database().getConnection();

// Serialize user for session storage
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
            return done(err, null);
        }
        done(null, user);
    });
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const googleId = profile.id;
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const profilePicture = profile.photos[0]?.value || '';
        const givenName = profile.name?.givenName || '';
        const familyName = profile.name?.familyName || '';
        
        // Extract domain from email for domain restrictions
        const domain = email.split('@')[1];
        
        // Check if domain restriction is enabled
        const allowedDomain = process.env.ALLOWED_DOMAIN;
        if (allowedDomain && domain !== allowedDomain) {
            return done(new Error(`Access restricted to ${allowedDomain} domain only`), null);
        }

        // Check if user already exists
        db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, existingUser) => {
            if (err) {
                return done(err, null);
            }

            if (existingUser) {
                // Update existing user's last login
                const updateQuery = `
                    UPDATE users 
                    SET last_login_at = CURRENT_TIMESTAMP, 
                        login_count = login_count + 1,
                        is_first_time = 0,
                        profile_picture = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                
                db.run(updateQuery, [profilePicture, existingUser.id], (err) => {
                    if (err) {
                        return done(err, null);
                    }
                    
                    // Return updated user data
                    const updatedUser = {
                        ...existingUser,
                        last_login_at: new Date().toISOString(),
                        login_count: existingUser.login_count + 1,
                        is_first_time: 0,
                        profile_picture: profilePicture
                    };
                    
                    return done(null, updatedUser);
                });
            } else {
                // Create new user
                const insertQuery = `
                    INSERT INTO users (
                        google_id, email, name, profile_picture, given_name, 
                        family_name, domain, last_login_at, login_count
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
                `;
                
                db.run(insertQuery, [
                    googleId, email, name, profilePicture, 
                    givenName, familyName, domain
                ], function(err) {
                    if (err) {
                        return done(err, null);
                    }
                    
                    // Get the newly created user
                    db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                        if (err) {
                            return done(err, null);
                        }
                        return done(null, newUser);
                    });
                });
            }
        });
        
    } catch (error) {
        return done(error, null);
    }
}));

module.exports = passport;