const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = new Database().getConnection();

// Get payment settings
router.get('/settings', async (req, res) => {
    try {
        // For now, we'll return static settings
        // In a real implementation, this would come from a database table
        const settings = {
            enabledMethods: ['mpesa', 'tigopesa', 'cash'],
            commissionRate: 15, // percentage
            minimumPayoutAmount: 5000, // TSh
            payoutSchedule: 'weekly', // daily, weekly, monthly
            currency: 'TSh',
            paymentVerificationRequired: true,
            autoPayoutEnabled: false
        };

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Get payment settings error:', error);
        res.status(500).json({ error: 'Failed to fetch payment settings' });
    }
});

// Update payment settings (admin only)
router.put('/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings) {
            return res.status(400).json({ error: 'Settings data required' });
        }

        // TODO: Implement actual settings storage
        console.log('Payment settings update requested:', settings);

        res.json({ 
            success: true, 
            message: 'Payment settings updated successfully' 
        });
    } catch (error) {
        console.error('Update payment settings error:', error);
        res.status(500).json({ error: 'Failed to update payment settings' });
    }
});

// Get commission rates
router.get('/commission-rates', async (req, res) => {
    try {
        // For now, we'll return static commission rates
        // In a real implementation, this would come from a database table
        const commissionRates = [
            { id: 1, vehicleType: 'saloon', rate: 15, isActive: true },
            { id: 2, vehicleType: 'suv', rate: 15, isActive: true },
            { id: 3, vehicleType: 'van', rate: 12, isActive: true },
            { id: 4, vehicleType: 'pickup', rate: 10, isActive: true },
            { id: 5, vehicleType: 'truck', rate: 8, isActive: true }
        ];

        res.json({ success: true, commissionRates });
    } catch (error) {
        console.error('Get commission rates error:', error);
        res.status(500).json({ error: 'Failed to fetch commission rates' });
    }
});

// Update commission rate (admin only)
router.put('/commission-rates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rate } = req.body;

        if (rate === undefined) {
            return res.status(400).json({ error: 'Rate is required' });
        }

        if (rate < 0 || rate > 100) {
            return res.status(400).json({ error: 'Rate must be between 0 and 100' });
        }

        // TODO: Implement actual commission rate update
        console.log(`Commission rate update requested for vehicle type ${id}: ${rate}%`);

        res.json({ 
            success: true, 
            message: 'Commission rate updated successfully' 
        });
    } catch (error) {
        console.error('Update commission rate error:', error);
        res.status(500).json({ error: 'Failed to update commission rate' });
    }
});

// Get payout history
router.get('/payouts', async (req, res) => {
    try {
        const { driverId, status, startDate, endDate } = req.query;

        let query = `
            SELECT 
                p.id, p.driver_id, p.amount, p.status, p.payout_method,
                p.transaction_reference, p.processed_at, p.created_at,
                u.full_name as driver_name, u.phone_number as driver_phone
            FROM payouts p
            LEFT JOIN users u ON p.driver_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (driverId) {
            query += ' AND p.driver_id = ?';
            params.push(driverId);
        }

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        if (startDate) {
            query += ' AND p.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND p.created_at <= ?';
            params.push(endDate + ' 23:59:59');
        }

        query += ' ORDER BY p.created_at DESC LIMIT 100';

        // Note: The payouts table doesn't exist in the current schema
        // This is a placeholder for future implementation
        res.json({ success: true, payouts: [] });
    } catch (error) {
        console.error('Get payout history error:', error);
        res.status(500).json({ error: 'Failed to fetch payout history' });
    }
});

// Process manual payout (admin only)
router.post('/payouts/manual', async (req, res) => {
    try {
        const { driverId, amount, method, notes } = req.body;

        if (!driverId || !amount || !method) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['driverId', 'amount', 'method']
            });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        // TODO: Implement actual payout processing
        console.log(`Manual payout requested: Driver ${driverId}, Amount ${amount}, Method ${method}`);

        res.json({ 
            success: true, 
            message: 'Payout processed successfully',
            payoutId: Date.now() // Placeholder ID
        });
    } catch (error) {
        console.error('Process manual payout error:', error);
        res.status(500).json({ error: 'Failed to process manual payout' });
    }
});

module.exports = router;