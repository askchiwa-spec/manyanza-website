const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = new Database().getConnection();

// Get all clients (admin only)
router.get('/', async (req, res) => {
    try {
        const { status, minBookings, registeredAfter } = req.query;

        let query = `
            SELECT 
                id, email, phone_number, full_name, is_active,
                total_bookings, total_spent, client_type, company_name,
                email_verified, phone_verified, created_at, last_login_at
            FROM users 
            WHERE role = 'client'
        `;

        const params = [];

        if (status) {
            query += ' AND is_active = ?';
            params.push(status === 'active' ? 1 : 0);
        }

        if (minBookings) {
            query += ' AND total_bookings >= ?';
            params.push(parseInt(minBookings));
        }

        if (registeredAfter) {
            query += ' AND created_at >= ?';
            params.push(registeredAfter);
        }

        query += ' ORDER BY created_at DESC';

        db.all(query, params, (err, clients) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, clients });
        });

    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get client profile
router.get('/:id', async (req, res) => {
    try {
        const clientId = req.params.id;

        db.get(`
            SELECT 
                id, email, phone_number, full_name, is_active,
                total_bookings, total_spent, client_type, company_name,
                email_verified, phone_verified, created_at, last_login_at,
                conversation_state, current_booking_id
            FROM users 
            WHERE id = ? AND role = 'client'
        `, [clientId], (err, client) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({ success: true, client });
        });

    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Update client status (activate/deactivate)
router.patch('/:id/status', async (req, res) => {
    try {
        const clientId = req.params.id;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be a boolean value' });
        }

        db.run(`
            UPDATE users 
            SET is_active = ?, updated_at = datetime('now')
            WHERE id = ? AND role = 'client'
        `, [isActive ? 1 : 0, clientId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update status' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({ 
                success: true, 
                message: `Client ${isActive ? 'activated' : 'deactivated'} successfully`,
                isActive
            });
        });

    } catch (error) {
        console.error('Update client status error:', error);
        res.status(500).json({ error: 'Failed to update client status' });
    }
});

// Get client bookings
router.get('/:id/bookings', async (req, res) => {
    try {
        const clientId = req.params.id;

        db.all(`
            SELECT 
                b.id, b.booking_id, b.pickup_location, b.destination, 
                b.vehicle_type, b.status, b.estimated_cost, b.created_at
            FROM bookings b
            WHERE b.client_id = ?
            ORDER BY b.created_at DESC
        `, [clientId], (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, bookings });
        });

    } catch (error) {
        console.error('Get client bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch client bookings' });
    }
});

// Update client profile (admin only)
router.patch('/:id/profile', async (req, res) => {
    try {
        const clientId = req.params.id;
        const {
            fullName,
            email,
            phoneNumber,
            companyName,
            clientType
        } = req.body;

        // Build dynamic update query
        const fields = [];
        const params = [];

        if (fullName !== undefined) {
            fields.push('full_name = ?');
            params.push(fullName);
        }

        if (email !== undefined) {
            fields.push('email = ?');
            params.push(email);
        }

        if (phoneNumber !== undefined) {
            fields.push('phone_number = ?');
            params.push(phoneNumber);
        }

        if (companyName !== undefined) {
            fields.push('company_name = ?');
            params.push(companyName);
        }

        if (clientType !== undefined) {
            const allowedTypes = ['individual', 'business'];
            if (!allowedTypes.includes(clientType)) {
                return res.status(400).json({ error: 'Invalid client type' });
            }
            fields.push('client_type = ?');
            params.push(clientType);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add client ID to params
        params.push(clientId);

        const query = `
            UPDATE users 
            SET ${fields.join(', ')}, updated_at = datetime('now')
            WHERE id = ? AND role = 'client'
        `;

        db.run(query, params, function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update profile' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({ 
                success: true, 
                message: 'Client profile updated successfully'
            });
        });

    } catch (error) {
        console.error('Update client profile error:', error);
        res.status(500).json({ error: 'Failed to update client profile' });
    }
});

// Get client statistics (admin only)
router.get('/stats/overview', async (req, res) => {
    try {
        // Get total clients
        const totalClients = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count FROM users WHERE role = 'client'
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // Get active clients
        const activeClients = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count FROM users WHERE role = 'client' AND is_active = 1
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // Get recent registrations
        const recentRegistrations = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE role = 'client' AND created_at >= date('now', '-7 days')
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // Get top clients by bookings
        const topClients = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id, full_name, phone_number, total_bookings, total_spent
                FROM users 
                WHERE role = 'client' AND total_bookings > 0
                ORDER BY total_bookings DESC
                LIMIT 10
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            stats: {
                totalClients,
                activeClients,
                recentRegistrations,
                topClients
            }
        });

    } catch (error) {
        console.error('Get client stats error:', error);
        res.status(500).json({ error: 'Failed to fetch client statistics' });
    }
});

module.exports = router;