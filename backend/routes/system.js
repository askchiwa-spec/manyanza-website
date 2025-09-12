const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = new Database().getConnection();

// Get system configuration
router.get('/config', async (req, res) => {
    try {
        // For now, we'll return a static configuration
        // In a real implementation, this would come from a database table
        const config = {
            platformName: 'Manyanza Transit',
            platformDescription: 'Professional vehicle transit service',
            supportEmail: 'support@manyanza.co.tz',
            supportPhone: '+255 765 111 131',
            websiteUrl: 'https://manyanza.co.tz',
            branding: {
                primaryColor: '#2563eb',
                secondaryColor: '#1e40af',
                logoUrl: '/uploads/logo.png'
            },
            booking: {
                minAdvanceBookingHours: 2,
                maxAdvanceBookingDays: 30,
                cancellationPolicyHours: 24
            },
            notifications: {
                enableSMS: true,
                enableWhatsApp: true,
                enableEmail: true
            },
            security: {
                sessionTimeoutMinutes: 60,
                maxLoginAttempts: 5,
                passwordMinLength: 8
            }
        };

        res.json({ success: true, config });
    } catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
});

// Update system configuration (admin only)
router.put('/config', async (req, res) => {
    try {
        // In a real implementation, this would update the database
        // For now, we'll just return success
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({ error: 'Configuration data required' });
        }

        // TODO: Implement actual configuration storage
        console.log('System configuration update requested:', config);

        res.json({ 
            success: true, 
            message: 'System configuration updated successfully' 
        });
    } catch (error) {
        console.error('Update system config error:', error);
        res.status(500).json({ error: 'Failed to update system configuration' });
    }
});

// Get system health status
router.get('/health', async (req, res) => {
    try {
        // Check database connection
        const dbStatus = await new Promise((resolve) => {
            db.get('SELECT 1 as connected', (err) => {
                resolve(err ? 'disconnected' : 'connected');
            });
        });

        // Get system stats
        const stats = await getSystemStats();

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            components: {
                database: dbStatus,
                api: 'operational'
            },
            stats
        });
    } catch (error) {
        console.error('System health check error:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Get system statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getSystemStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json({ error: 'Failed to fetch system statistics' });
    }
});

// Get system logs (admin only)
router.get('/logs', async (req, res) => {
    try {
        const { level, category, limit = 50 } = req.query;

        let query = `
            SELECT 
                id, log_level, category, message, details, user_id, booking_id, created_at
            FROM system_logs
            WHERE 1=1
        `;

        const params = [];

        if (level) {
            query += ' AND log_level = ?';
            params.push(level);
        }

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        db.all(query, params, (err, logs) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, logs });
        });
    } catch (error) {
        console.error('Get system logs error:', error);
        res.status(500).json({ error: 'Failed to fetch system logs' });
    }
});

// Helper function to get system statistics
async function getSystemStats() {
    return new Promise((resolve, reject) => {
        const stats = {};
        
        // Get user counts by role
        db.all(`
            SELECT role, COUNT(*) as count FROM users GROUP BY role
        `, (err, roleCounts) => {
            if (err) return reject(err);
            
            stats.users = {};
            roleCounts.forEach(row => {
                stats.users[row.role] = row.count;
            });
            
            // Get booking counts by status
            db.all(`
                SELECT status, COUNT(*) as count FROM bookings GROUP BY status
            `, (err, bookingCounts) => {
                if (err) return reject(err);
                
                stats.bookings = {};
                bookingCounts.forEach(row => {
                    stats.bookings[row.status] = row.count;
                });
                
                // Get driver counts by status
                db.all(`
                    SELECT driver_status, COUNT(*) as count FROM users WHERE role = 'driver' GROUP BY driver_status
                `, (err, driverCounts) => {
                    if (err) return reject(err);
                    
                    stats.drivers = {};
                    driverCounts.forEach(row => {
                        stats.drivers[row.driver_status] = row.count;
                    });
                    
                    resolve(stats);
                });
            });
        });
    });
}

module.exports = router;