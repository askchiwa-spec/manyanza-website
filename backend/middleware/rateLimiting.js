const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const Database = require('../database/db');

class RateLimitingService {
    constructor() {
        this.db = new Database().getConnection();
        this.maxLoginAttempts = 5;
        this.lockoutTime = 15 * 60 * 1000; // 15 minutes
        this.bruteForceWindow = 15 * 60 * 1000; // 15 minutes
    }

    // General API rate limiting (100 requests per 15 minutes)
    getGeneralRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests from this IP',
                message: 'Please try again later',
                retryAfter: 15 * 60, // seconds
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
            legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            handler: (req, res) => {
                this.logRateLimitExceeded(req.ip, 'general', req.originalUrl);
                res.status(429).json({
                    error: 'Too many requests from this IP',
                    message: 'Please try again later',
                    retryAfter: 15 * 60,
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }

    // Strict authentication rate limiting (5 attempts per 15 minutes)
    getAuthRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // limit each IP to 5 authentication attempts per windowMs
            message: {
                error: 'Too many authentication attempts',
                message: 'Please try again in 15 minutes',
                retryAfter: 15 * 60,
                code: 'AUTH_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true, // Don't count successful requests
            handler: (req, res) => {
                this.logRateLimitExceeded(req.ip, 'authentication', req.originalUrl);
                res.status(429).json({
                    error: 'Too many authentication attempts',
                    message: 'Please try again in 15 minutes',
                    retryAfter: 15 * 60,
                    code: 'AUTH_RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }

    // Admin action rate limiting (more lenient for authenticated admins)
    getAdminRateLimit() {
        return rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 50, // limit each IP to 50 admin actions per 5 minutes
            message: {
                error: 'Too many admin actions',
                message: 'Please slow down your admin operations',
                retryAfter: 5 * 60,
                code: 'ADMIN_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logRateLimitExceeded(req.ip, 'admin', req.originalUrl);
                res.status(429).json({
                    error: 'Too many admin actions',
                    message: 'Please slow down your admin operations',
                    retryAfter: 5 * 60,
                    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }

    // Progressive slow down for authentication endpoints
    getAuthSlowDown() {
        return slowDown({
            windowMs: 15 * 60 * 1000, // 15 minutes
            delayAfter: 2, // allow 2 requests per windowMs without delay
            delayMs: 500, // add 500ms of delay per request after delayAfter
            maxDelayMs: 20000 // maximum delay of 20 seconds
        });
    }

    // WhatsApp webhook rate limiting (higher for business communication)
    getWhatsAppRateLimit() {
        return rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 50, // allow 50 WhatsApp messages per minute
            message: {
                error: 'WhatsApp rate limit exceeded',
                message: 'Too many messages, please slow down',
                code: 'WHATSAPP_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logRateLimitExceeded(req.ip, 'whatsapp', req.originalUrl);
                res.status(429).json({
                    error: 'WhatsApp rate limit exceeded',
                    message: 'Too many messages, please slow down',
                    code: 'WHATSAPP_RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }

    // Advanced brute force protection with user-specific tracking
    async checkBruteForce(identifier, ip) {
        try {
            const now = new Date();
            const windowStart = new Date(now.getTime() - this.bruteForceWindow);

            // Get recent failed attempts for this identifier
            const attempts = await this.getRecentLoginAttempts(identifier, ip, windowStart);
            
            const failedAttempts = attempts.filter(attempt => attempt.status === 'failed');
            
            if (failedAttempts.length >= this.maxLoginAttempts) {
                const lastAttempt = failedAttempts[failedAttempts.length - 1];
                const timeSinceLastAttempt = now.getTime() - new Date(lastAttempt.created_at).getTime();
                
                if (timeSinceLastAttempt < this.lockoutTime) {
                    const remainingLockout = Math.ceil((this.lockoutTime - timeSinceLastAttempt) / 1000 / 60);
                    return {
                        isBlocked: true,
                        remainingMinutes: remainingLockout,
                        attempts: failedAttempts.length
                    };
                }
            }

            return {
                isBlocked: false,
                attempts: failedAttempts.length,
                remainingAttempts: this.maxLoginAttempts - failedAttempts.length
            };
        } catch (error) {
            console.error('Brute force check error:', error);
            return { isBlocked: false, attempts: 0 };
        }
    }

    // Log login attempt for brute force tracking
    async logLoginAttempt(identifier, ip, status, userAgent = '') {
        try {
            await new Promise((resolve, reject) => {
                const query = `
                    INSERT INTO login_attempts (identifier, ip_address, attempt_type, status, user_agent, created_at)
                    VALUES (?, ?, 'password', ?, ?, datetime('now'))
                `;
                
                this.db.run(query, [identifier, ip, status, userAgent], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to log login attempt:', error);
        }
    }

    // Get recent login attempts for brute force analysis
    async getRecentLoginAttempts(identifier, ip, since) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM login_attempts 
                WHERE (identifier = ? OR ip_address = ?) AND created_at >= ?
                ORDER BY created_at DESC
                LIMIT 20
            `;
            
            this.db.all(query, [identifier, ip, since.toISOString()], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Log rate limit exceeded events for monitoring
    async logRateLimitExceeded(ip, type, endpoint) {
        try {
            await new Promise((resolve, reject) => {
                const query = `
                    INSERT INTO system_logs (log_level, category, message, details, created_at)
                    VALUES ('warning', 'rate_limit', 'Rate limit exceeded', ?, datetime('now'))
                `;
                
                const details = JSON.stringify({
                    ip_address: ip,
                    limit_type: type,
                    endpoint: endpoint,
                    timestamp: new Date().toISOString()
                });
                
                this.db.run(query, [details], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to log rate limit exceeded:', error);
        }
    }

    // Middleware for brute force protection on authentication endpoints
    getBruteForceProtection() {
        return async (req, res, next) => {
            try {
                const identifier = req.body.identifier || req.body.email || req.body.phone_number;
                const ip = req.ip || req.connection.remoteAddress;

                if (!identifier) {
                    return next(); // Skip if no identifier
                }

                const bruteForceCheck = await this.checkBruteForce(identifier, ip);
                
                if (bruteForceCheck.isBlocked) {
                    await this.logRateLimitExceeded(ip, 'brute_force', req.originalUrl);
                    
                    return res.status(429).json({
                        error: 'Account temporarily locked',
                        message: `Too many failed login attempts. Please try again in ${bruteForceCheck.remainingMinutes} minutes.`,
                        retryAfter: bruteForceCheck.remainingMinutes * 60,
                        attempts: bruteForceCheck.attempts,
                        code: 'ACCOUNT_LOCKED'
                    });
                }

                // Add brute force info to request for use in auth handlers
                req.bruteForceInfo = bruteForceCheck;
                next();
            } catch (error) {
                console.error('Brute force protection error:', error);
                next(); // Continue on error to avoid blocking legitimate requests
            }
        };
    }

    // Clean up old login attempts (should be run periodically)
    async cleanupOldAttempts() {
        try {
            const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            
            await new Promise((resolve, reject) => {
                const query = `DELETE FROM login_attempts WHERE created_at < ?`;
                
                this.db.run(query, [cutoffDate.toISOString()], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`🧹 Cleaned ${this.changes} old login attempts`);
                        resolve(this.changes);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to cleanup old login attempts:', error);
        }
    }

    // Get rate limiting statistics for admin dashboard
    async getRateLimitStats() {
        try {
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const stats = await new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        JSON_EXTRACT(details, '$.limit_type') as limit_type,
                        COUNT(*) as count,
                        COUNT(DISTINCT JSON_EXTRACT(details, '$.ip_address')) as unique_ips
                    FROM system_logs 
                    WHERE category = 'rate_limit' AND created_at >= ?
                    GROUP BY JSON_EXTRACT(details, '$.limit_type')
                `;
                
                this.db.all(query, [last24Hours.toISOString()], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            });

            return stats;
        } catch (error) {
            console.error('Failed to get rate limit stats:', error);
            return [];
        }
    }
}

module.exports = RateLimitingService;