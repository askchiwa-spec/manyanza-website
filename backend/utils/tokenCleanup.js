const TokenService = require('../services/tokenService');
const RateLimitingService = require('../middleware/rateLimiting');
const cron = require('node-cron');

class TokenCleanupService {
    constructor() {
        this.tokenService = new TokenService();
        this.rateLimitingService = new RateLimitingService();
        this.isRunning = false;
    }

    // Start automatic cleanup (runs every hour)
    start() {
        if (this.isRunning) {
            console.log('🧹 Token cleanup service already running');
            return;
        }

        console.log('🧹 Starting automatic token cleanup service');
        
        // Run cleanup every hour
        this.cronJob = cron.schedule('0 * * * *', async () => {
            try {
                await this.cleanupExpiredTokens();
            } catch (error) {
                console.error('❌ Token cleanup error:', error);
            }
        }, {
            scheduled: false
        });

        this.cronJob.start();
        this.isRunning = true;

        // Run initial cleanup
        this.cleanupExpiredTokens();
    }

    // Stop automatic cleanup
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('🛑 Token cleanup service stopped');
        }
        this.isRunning = false;
    }

    // Manual cleanup method
    async cleanupExpiredTokens() {
        try {
            console.log('🧹 Running token and security cleanup...');
            
            // Clean expired tokens
            const cleanedTokens = await this.tokenService.cleanExpiredTokens();
            
            // Clean old login attempts
            await this.rateLimitingService.cleanupOldAttempts();
            
            if (cleanedTokens > 0) {
                console.log(`✅ Token cleanup completed: ${cleanedTokens} tokens removed`);
            } else {
                console.log('✅ Token cleanup completed: no expired tokens found');
            }
            
            return cleanedTokens;
        } catch (error) {
            console.error('❌ Token cleanup failed:', error);
            throw error;
        }
    }

    // Get cleanup status
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRun: this.cronJob ? this.cronJob.nextDates().toString() : null
        };
    }
}

module.exports = TokenCleanupService;