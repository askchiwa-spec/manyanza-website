const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('../database/db');

class TokenService {
    constructor() {
        this.db = new Database().getConnection();
        this.ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
        this.REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh token
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        this.REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-key';
    }

    // Generate token pair (access + refresh)
    async generateTokenPair(user, deviceInfo = {}) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            phone_number: user.phone_number
        };

        // Generate short-lived access token
        const accessToken = jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
            issuer: 'manyanza-api',
            audience: 'manyanza-client'
        });

        // Generate long-lived refresh token
        const refreshTokenData = {
            ...payload,
            type: 'refresh',
            jti: crypto.randomUUID() // Unique token ID
        };

        const refreshToken = jwt.sign(refreshTokenData, this.REFRESH_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRY,
            issuer: 'manyanza-api',
            audience: 'manyanza-client'
        });

        // Store refresh token in database
        await this.storeRefreshToken(refreshToken, user.id, deviceInfo);

        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
            tokenType: 'Bearer'
        };
    }

    // Store refresh token in database
    async storeRefreshToken(token, userId, deviceInfo = {}) {
        return new Promise((resolve, reject) => {
            const tokenHash = this.hashToken(token);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const query = `
                INSERT INTO refresh_tokens (
                    token_hash, user_id, expires_at, device_info, 
                    ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `;

            this.db.run(query, [
                tokenHash,
                userId,
                expiresAt.toISOString(),
                JSON.stringify(deviceInfo),
                deviceInfo.ip_address || null,
                deviceInfo.user_agent || null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Verify and refresh tokens
    async refreshAccessToken(refreshToken, deviceInfo = {}) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET);
            
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Check if refresh token exists in database and is valid
            const tokenHash = this.hashToken(refreshToken);
            const storedToken = await this.getRefreshToken(tokenHash);

            if (!storedToken || storedToken.is_revoked || new Date(storedToken.expires_at) < new Date()) {
                throw new Error('Refresh token is invalid or expired');
            }

            // Get user details
            const user = await this.getUserById(decoded.id);
            if (!user || !user.is_active) {
                throw new Error('User not found or inactive');
            }

            // Update last used timestamp
            await this.updateRefreshTokenUsage(tokenHash);

            // Generate new token pair
            const tokens = await this.generateTokenPair(user, deviceInfo);

            // Optionally revoke old refresh token for token rotation
            if (process.env.ROTATE_REFRESH_TOKENS === 'true') {
                await this.revokeRefreshToken(tokenHash);
            }

            return tokens;

        } catch (error) {
            throw new Error('Invalid refresh token: ' + error.message);
        }
    }

    // Verify access token
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET);
            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Access token expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            } else {
                throw new Error('Token verification failed');
            }
        }
    }

    // Revoke refresh token
    async revokeRefreshToken(tokenOrHash) {
        return new Promise((resolve, reject) => {
            const tokenHash = tokenOrHash.length > 64 ? this.hashToken(tokenOrHash) : tokenOrHash;
            
            const query = `
                UPDATE refresh_tokens 
                SET is_revoked = 1, last_used_at = datetime('now')
                WHERE token_hash = ?
            `;

            this.db.run(query, [tokenHash], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Revoke all refresh tokens for a user (logout all devices)
    async revokeAllUserTokens(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE refresh_tokens 
                SET is_revoked = 1, last_used_at = datetime('now')
                WHERE user_id = ? AND is_revoked = 0
            `;

            this.db.run(query, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Get refresh token from database
    async getRefreshToken(tokenHash) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM refresh_tokens 
                WHERE token_hash = ? AND is_revoked = 0
            `;

            this.db.get(query, [tokenHash], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Update refresh token usage
    async updateRefreshTokenUsage(tokenHash) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE refresh_tokens 
                SET last_used_at = datetime('now')
                WHERE token_hash = ?
            `;

            this.db.run(query, [tokenHash], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Get user by ID
    async getUserById(userId) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM users WHERE id = ? AND is_active = 1`;
            
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Hash token for storage
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    // Clean expired tokens (should be run periodically)
    async cleanExpiredTokens() {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM refresh_tokens 
                WHERE expires_at < datetime('now') OR is_revoked = 1
            `;

            this.db.run(query, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🧹 Cleaned ${this.changes} expired/revoked refresh tokens`);
                    resolve(this.changes);
                }
            });
        });
    }

    // Get user's active sessions
    async getUserSessions(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, device_info, ip_address, created_at, last_used_at
                FROM refresh_tokens 
                WHERE user_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
                ORDER BY last_used_at DESC
            `;

            this.db.all(query, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        device_info: row.device_info ? JSON.parse(row.device_info) : {}
                    })));
                }
            });
        });
    }
}

module.exports = TokenService;