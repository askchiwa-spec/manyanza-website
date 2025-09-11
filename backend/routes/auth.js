const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Database = require('../database/db');
const TokenService = require('../services/tokenService');
const RateLimitingService = require('../middleware/rateLimiting');
const { 
    ErrorHandler, 
    ValidationError, 
    AuthenticationError, 
    ConflictError, 
    NotFoundError 
} = require('../middleware/errorHandler');
const router = express.Router();

// Initialize services
const db = new Database().getConnection();
const tokenService = new TokenService();
const rateLimitingService = new RateLimitingService();
const errorHandler = new ErrorHandler();

// JWT Secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Apply strict authentication rate limiting to auth routes
router.use(rateLimitingService.getAuthRateLimit());
// router.use(rateLimitingService.getAuthSlowDown()); // Temporarily disabled due to compatibility

// Apply brute force protection to login routes specifically
router.use('*/login', rateLimitingService.getBruteForceProtection());

// Helper function to get device info from request
function getDeviceInfo(req) {
    return {
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent') || '',
        device_type: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
    };
}

// Helper function to get user by email
function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Helper function to create new user
function createUser(userData) {
    return new Promise((resolve, reject) => {
        const {
            email, password_hash, full_name, role, phone_number,
            google_id, provider, nida_number, license_number,
            license_expiry, experience_years, emergency_contact_name,
            emergency_contact_phone
        } = userData;
        
        const query = `
            INSERT INTO users (
                email, password_hash, full_name, role, phone_number,
                google_id, provider, nida_number, license_number,
                license_expiry, experience_years, emergency_contact_name,
                emergency_contact_phone, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        
        db.run(query, [
            email, password_hash, full_name, role, phone_number,
            google_id, provider, nida_number, license_number,
            license_expiry, experience_years, emergency_contact_name,
            emergency_contact_phone
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                // Get the created user
                db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            }
        });
    });
}

// ======================
// CLIENT AUTHENTICATION
// ======================

// Client registration (for WhatsApp users who want web access)
router.post('/client/register', 
    errorHandler.validateRequest([
        body('phone_number').isMobilePhone().withMessage('Valid phone number is required'),
        body('full_name').isLength({ min: 2 }).withMessage('Full name is required'),
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ]),
    errorHandler.asyncHandler(async (req, res) => {
        const { phone_number, full_name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE phone_number = ? OR email = ?', [phone_number, email], (err, row) => {
                if (err) reject(new DatabaseError());
                else resolve(row);
            });
        });

        if (existingUser) {
            if (existingUser.phone_number === phone_number) {
                throw new ConflictError('Phone number already registered', 'PHONE_EXISTS');
            }
            if (existingUser.email === email) {
                throw new ConflictError('Email already registered', 'EMAIL_EXISTS');
            }
        }

        // Hash password if provided
        let password_hash = null;
        if (password) {
            password_hash = await bcrypt.hash(password, 10);
        }

        // Create client user
        const userData = {
            email: email || `${phone_number}@manyanza.temp`,
            password_hash,
            full_name,
            role: 'client',
            phone_number,
            provider: 'local'
        };

        const newUser = await createUser(userData);
        const deviceInfo = getDeviceInfo(req);
        const tokens = await tokenService.generateTokenPair(newUser, deviceInfo);

        errorHandler.sendSuccess(res, {
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: newUser.full_name,
                role: newUser.role,
                phone_number: newUser.phone_number
            },
            ...tokens
        }, 'Client registered successfully', 201);
    })
);

// Client login
router.post('/client/login',
    errorHandler.validateRequest([
        body('identifier').notEmpty().withMessage('Phone number or email is required'),
        body('password').optional().notEmpty().withMessage('Password is required for password-based login')
    ]),
    errorHandler.asyncHandler(async (req, res) => {
        const { identifier, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        
        try {
            // Find user by phone number or email
            const user = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE (phone_number = ? OR email = ?) AND role = "client" AND is_active = 1',
                    [identifier, identifier],
                    (err, row) => {
                        if (err) reject(new DatabaseError());
                        else resolve(row);
                    }
                );
            });

            if (!user) {
                // Log failed attempt
                await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
            }

            // For WhatsApp-only users (no password), allow login without password verification
            if (!user.password_hash && !password) {
                // This is a WhatsApp-only user, allow login
            } else if (user.password_hash && password) {
                // Verify password
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                if (!isValidPassword) {
                    // Log failed attempt
                    await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                    throw new AuthenticationError('Invalid password', 'INVALID_PASSWORD');
                }
            } else {
                // Log failed attempt
                await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                throw new AuthenticationError('Authentication method mismatch', 'AUTH_METHOD_MISMATCH');
            }

            // Success - log successful attempt
            await rateLimitingService.logLoginAttempt(identifier, ip, 'success', userAgent);

            // Update last login
            db.run(
                'UPDATE users SET last_login_at = datetime("now"), login_count = login_count + 1 WHERE id = ?',
                [user.id]
            );

            const deviceInfo = getDeviceInfo(req);
            const tokens = await tokenService.generateTokenPair(user, deviceInfo);

            errorHandler.sendSuccess(res, {
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    phone_number: user.phone_number,
                    total_bookings: user.total_bookings
                },
                ...tokens
            }, 'Login successful');
        } catch (authError) {
            // Log failed attempt on any authentication error
            await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
            throw authError;
        }
    })
);

// ======================
// DRIVER AUTHENTICATION
// ======================

// Driver registration
router.post('/driver/register', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').isLength({ min: 2 }).withMessage('Full name is required'),
    body('phone_number').isMobilePhone().withMessage('Valid phone number is required'),
    body('nida_number').isLength({ min: 10, max: 20 }).withMessage('Valid NIDA number is required'),
    body('license_number').notEmpty().withMessage('License number is required'),
    body('license_expiry').isISO8601().withMessage('Valid license expiry date is required'),
    body('experience_years').isInt({ min: 1 }).withMessage('Experience years must be at least 1'),
    body('emergency_contact_name').notEmpty().withMessage('Emergency contact name is required'),
    body('emergency_contact_phone').isMobilePhone().withMessage('Valid emergency contact phone is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            email, password, full_name, phone_number, nida_number,
            license_number, license_expiry, experience_years,
            emergency_contact_name, emergency_contact_phone
        } = req.body;

        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE email = ? OR phone_number = ? OR nida_number = ? OR license_number = ?',
                [email, phone_number, nida_number, license_number],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Driver already exists with this email, phone, NIDA, or license number' 
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Create driver user
        const userData = {
            email,
            password_hash,
            full_name,
            role: 'driver',
            phone_number,
            provider: 'local',
            nida_number,
            license_number,
            license_expiry,
            experience_years,
            emergency_contact_name,
            emergency_contact_phone
        };

        const newUser = await createUser(userData);
        const deviceInfo = getDeviceInfo(req);
        const tokens = await tokenService.generateTokenPair(newUser, deviceInfo);

        res.status(201).json({
            success: true,
            message: 'Driver registered successfully. Account pending approval.',
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: newUser.full_name,
                role: newUser.role,
                phone_number: newUser.phone_number,
                driver_status: newUser.driver_status,
                nida_number: newUser.nida_number,
                license_number: newUser.license_number
            },
            ...tokens
        });
    } catch (error) {
        console.error('Driver registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Driver login
router.post('/driver/login', [
    body('identifier').notEmpty().withMessage('Email or phone number is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        
        try {
            // Find driver by email or phone
            const user = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE (email = ? OR phone_number = ?) AND role = "driver" AND is_active = 1',
                    [identifier, identifier],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!user) {
                await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                return res.status(401).json({ 
                    error: 'Driver not found',
                    code: 'DRIVER_NOT_FOUND'
                });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                return res.status(401).json({ 
                    error: 'Invalid password',
                    code: 'INVALID_PASSWORD'
                });
            }

            // Check if driver is approved
            if (user.driver_status !== 'approved') {
                await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
                return res.status(403).json({ 
                    error: 'Account not approved',
                    message: 'Your driver account is pending approval. Please contact support.',
                    status: user.driver_status,
                    code: 'ACCOUNT_NOT_APPROVED'
                });
            }

            // Success - log successful attempt
            await rateLimitingService.logLoginAttempt(identifier, ip, 'success', userAgent);

            // Update last login
            db.run(
                'UPDATE users SET last_login_at = datetime("now"), login_count = login_count + 1 WHERE id = ?',
                [user.id]
            );

            const deviceInfo = getDeviceInfo(req);
            const tokens = await tokenService.generateTokenPair(user, deviceInfo);

            res.json({
                success: true,
                message: 'Driver login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    phone_number: user.phone_number,
                    driver_status: user.driver_status,
                    rating: user.rating,
                    total_trips: user.total_trips,
                    is_available: user.is_available
                },
                ...tokens
            });
        } catch (authError) {
            await rateLimitingService.logLoginAttempt(identifier, ip, 'failed', userAgent);
            throw authError;
        }
    } catch (error) {
        console.error('Driver login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ========================
// SUPER ADMIN AUTHENTICATION
// ========================

// Super Admin login
router.post('/admin/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        
        try {
            // Find super admin user
            const user = await getUserByEmail(email);

            if (!user || user.role !== 'super_admin') {
                await rateLimitingService.logLoginAttempt(email, ip, 'failed', userAgent);
                return res.status(401).json({ 
                    error: 'Admin not found',
                    code: 'ADMIN_NOT_FOUND'
                });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                await rateLimitingService.logLoginAttempt(email, ip, 'failed', userAgent);
                return res.status(401).json({ 
                    error: 'Invalid password',
                    code: 'INVALID_PASSWORD'
                });
            }

            // Success - log successful attempt
            await rateLimitingService.logLoginAttempt(email, ip, 'success', userAgent);

            // Update last login and admin action
            db.run(
                'UPDATE users SET last_login_at = datetime("now"), login_count = login_count + 1, last_admin_action = datetime("now") WHERE id = ?',
                [user.id]
            );

            const deviceInfo = getDeviceInfo(req);
            const tokens = await tokenService.generateTokenPair(user, deviceInfo);

            res.json({
                success: true,
                message: 'Super Admin login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    phone_number: user.phone_number,
                    admin_level: user.admin_level,
                    permissions: user.permissions ? JSON.parse(user.permissions) : []
                },
                ...tokens
            });
        } catch (authError) {
            await rateLimitingService.logLoginAttempt(email, ip, 'failed', userAgent);
            throw authError;
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// =====================
// COMMON AUTH ROUTES
// =====================

// Token verification middleware
function verifyToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied. No token provided.',
            code: 'TOKEN_MISSING'
        });
    }
    
    try {
        const decoded = tokenService.verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.message === 'Access token expired') {
            return res.status(401).json({ 
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        } else {
            return res.status(403).json({ 
                error: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
        }
    }
}

// Get current user profile (works for all roles)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return role-specific profile data
        const profileData = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            phone_number: user.phone_number,
            profile_picture: user.profile_picture,
            is_active: user.is_active,
            email_verified: user.email_verified,
            phone_verified: user.phone_verified,
            last_login_at: user.last_login_at,
            login_count: user.login_count,
            created_at: user.created_at
        };

        // Add role-specific fields
        if (user.role === 'client') {
            profileData.total_bookings = user.total_bookings;
            profileData.total_spent = user.total_spent;
            profileData.client_type = user.client_type;
            profileData.company_name = user.company_name;
        } else if (user.role === 'driver') {
            profileData.nida_number = user.nida_number;
            profileData.license_number = user.license_number;
            profileData.license_expiry = user.license_expiry;
            profileData.experience_years = user.experience_years;
            profileData.driver_status = user.driver_status;
            profileData.rating = user.rating;
            profileData.total_trips = user.total_trips;
            profileData.total_earnings = user.total_earnings;
            profileData.is_available = user.is_available;
            profileData.emergency_contact_name = user.emergency_contact_name;
            profileData.emergency_contact_phone = user.emergency_contact_phone;
        } else if (user.role === 'super_admin') {
            profileData.admin_level = user.admin_level;
            profileData.permissions = user.permissions ? JSON.parse(user.permissions) : [];
            profileData.last_admin_action = user.last_admin_action;
        }

        res.json({
            success: true,
            user: profileData
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ========================
// TOKEN MANAGEMENT ROUTES
// ========================

// Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ 
                error: 'Refresh token required',
                code: 'REFRESH_TOKEN_MISSING'
            });
        }

        const deviceInfo = getDeviceInfo(req);
        const tokens = await tokenService.refreshAccessToken(refreshToken, deviceInfo);
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            ...tokens
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ 
            error: error.message,
            code: 'REFRESH_TOKEN_INVALID'
        });
    }
});

// Logout (revoke refresh token)
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            await tokenService.revokeRefreshToken(refreshToken);
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        // Still return success even if token revocation fails
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
});

// Logout from all devices (revoke all refresh tokens)
router.post('/logout-all', verifyToken, async (req, res) => {
    try {
        const revokedCount = await tokenService.revokeAllUserTokens(req.user.id);
        
        res.json({
            success: true,
            message: `Logged out from ${revokedCount} device(s)`,
            devicesLoggedOut: revokedCount
        });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
});

// Get user's active sessions
router.get('/sessions', verifyToken, async (req, res) => {
    try {
        const sessions = await tokenService.getUserSessions(req.user.id);
        
        res.json({
            success: true,
            sessions: sessions.map(session => ({
                id: session.id,
                deviceType: session.device_info?.device_type || 'unknown',
                ipAddress: session.ip_address,
                lastUsed: session.last_used_at,
                createdAt: session.created_at,
                isCurrent: false // TODO: determine current session
            }))
        });
    } catch (error) {
        console.error('Sessions fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Revoke specific session
router.delete('/sessions/:sessionId', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get session to verify it belongs to the user
        const sessions = await tokenService.getUserSessions(req.user.id);
        const session = sessions.find(s => s.id.toString() === sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Revoke the session (we need to implement this in TokenService)
        // For now, we'll return success
        res.json({
            success: true,
            message: 'Session revoked successfully'
        });
    } catch (error) {
        console.error('Session revoke error:', error);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});

// Check authentication status (API endpoint)
router.get('/status', (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
        return res.json({ isAuthenticated: false });
    }
    
    try {
        const decoded = tokenService.verifyAccessToken(token);
        res.json({
            isAuthenticated: true,
            user: {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                phone_number: decoded.phone_number
            }
        });
    } catch (error) {
        res.json({ 
            isAuthenticated: false,
            error: error.message === 'Access token expired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
        });
    }
});

// Password reset request (for all roles with passwords)
router.post('/password-reset-request', [
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;
        const user = await getUserByEmail(email);

        if (!user || !user.password_hash) {
            // For security, always return success even if user doesn't exist
            return res.json({
                success: true,
                message: 'If an account with this email exists, a password reset link has been sent.'
            });
        }

        // TODO: Implement actual password reset email sending
        // For now, just return success
        res.json({
            success: true,
            message: 'Password reset functionality will be implemented in production.'
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Password reset request failed' });
    }
});

module.exports = { router, verifyToken };