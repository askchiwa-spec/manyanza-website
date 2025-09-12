// Role-based authentication middleware for protecting routes
const jwt = require('jsonwebtoken');
const Database = require('../database/db');
const TokenService = require('../services/tokenService');

// Initialize database and token service
const db = new Database().getConnection();
const tokenService = new TokenService();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Base authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please login to access this resource',
                code: 'TOKEN_MISSING'
            });
        }
        return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    try {
        const user = tokenService.verifyAccessToken(token);
        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            if (error.message === 'Access token expired') {
                return res.status(401).json({ 
                    error: 'Token expired',
                    message: 'Please refresh your token',
                    code: 'TOKEN_EXPIRED'
                });
            } else {
                return res.status(403).json({ 
                    error: 'Invalid token',
                    message: 'Please login again',
                    code: 'TOKEN_INVALID'
                });
            }
        }
        return res.redirect('/login.html?error=token_expired');
    }
}

// Role-based authorization middleware
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return authenticateToken(req, res, next);
        }
        
        const userRole = req.user.role;
        
        // Convert single role to array for consistency
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        
        if (!roles.includes(userRole)) {
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(403).json({ 
                    error: 'Insufficient permissions',
                    message: `Access denied. Required role: ${roles.join(' or ')}`,
                    userRole: userRole
                });
            }
            return res.redirect('/unauthorized?required=' + roles.join(','));
        }
        
        next();
    };
}

// Specific role middleware functions
function ensureClient(req, res, next) {
    return requireRole('client')(req, res, next);
}

function ensureDriver(req, res, next) {
    return requireRole('driver')(req, res, next);
}

function ensureSuperAdmin(req, res, next) {
    return requireRole('super_admin')(req, res, next);
}

// Admin or Super Admin (for shared admin functions)
function ensureAdmin(req, res, next) {
    return requireRole(['super_admin'])(req, res, next);
}

// Driver or Admin (for driver management functions)
function ensureDriverOrAdmin(req, res, next) {
    return requireRole(['driver', 'super_admin'])(req, res, next);
}

// Any authenticated user
function ensureAuthenticated(req, res, next) {
    return authenticateToken(req, res, next);
}

// Check if driver is approved (additional check for drivers)
function ensureApprovedDriver(req, res, next) {
    ensureDriver(req, res, async (err) => {
        if (err) return next(err);
        
        try {
            // Get full user details from database
            const user = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ? AND role = "driver"', [req.user.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!user || user.driver_status !== 'approved') {
                if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                    return res.status(403).json({ 
                        error: 'Driver not approved',
                        message: 'Your driver account is not approved yet',
                        status: user?.driver_status || 'unknown'
                    });
                }
                return res.redirect('/driver-pending');
            }
            
            req.driverDetails = user;
            next();
        } catch (error) {
            console.error('Driver approval check error:', error);
            res.status(500).json({ error: 'Authentication verification failed' });
        }
    });
}

// Optional authentication (for pages that work for both authenticated and unauthenticated users)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
}

// Check if user owns resource (for user-specific data access)
function ensureOwnership(req, res, next) {
    const resourceUserId = req.params.userId || req.body.userId || req.query.userId;
    
    if (!resourceUserId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    // Super admins can access any resource
    if (req.user.role === 'super_admin') {
        return next();
    }
    
    // Users can only access their own resources
    if (req.user.id !== parseInt(resourceUserId)) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only access your own resources'
            });
        }
        return res.redirect('/unauthorized');
    }
    
    next();
}

// Ensure user is NOT authenticated (for login/register pages)
function ensureGuest(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return next();
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err && user) {
            // User is authenticated, redirect based on role
            let redirectPath = '/dashboard';
            if (user.role === 'driver') redirectPath = '/driver-dashboard';
            else if (user.role === 'super_admin') redirectPath = '/admin-dashboard';
            
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(400).json({ 
                    error: 'Already authenticated',
                    redirect: redirectPath
                });
            }
            return res.redirect(redirectPath);
        }
        
        // Token is invalid or expired, allow access to login/register
        next();
    });
}

module.exports = {
    authenticateToken,
    requireRole,
    ensureAuthenticated,
    ensureClient,
    ensureDriver,
    ensureSuperAdmin,
    ensureAdmin,
    ensureDriverOrAdmin,
    ensureApprovedDriver,
    ensureOwnership,
    ensureGuest,
    optionalAuth
};