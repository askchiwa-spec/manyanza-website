const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const PricingCalculator = require('../services/pricingCalculator');
const NotificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

const db = new Database().getConnection();
const pricingCalculator = new PricingCalculator();
const notificationService = new NotificationService();

// Create new booking
router.post('/', async (req, res) => {
    try {
        const {
            clientPhone,
            pickupLocation,
            destination,
            vehicleType,
            pickupDate,
            distance,
            specialInstructions
        } = req.body;

        // Validate required fields
        if (!clientPhone || !pickupLocation || !destination || !vehicleType) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['clientPhone', 'pickupLocation', 'destination', 'vehicleType']
            });
        }

        // Get or create client
        const client = await getOrCreateClient(clientPhone);

        // Calculate pricing
        const pricing = pricingCalculator.calculate({
            distance: distance || 100,
            nights: 0,
            vehicleType
        });

        // Generate booking code
        const bookingCode = generateBookingCode();

        // Create booking
        const bookingId = await createBooking({
            bookingCode,
            clientId: client.id,
            pickupLocation,
            destination,
            vehicleType,
            pickupDate,
            distance,
            estimatedCost: pricing.totals.customerTotal,
            platformCommission: pricing.totals.commissionAmount,
            driverPayout: pricing.totals.driverPayout,
            specialInstructions
        });

        // Send confirmation
        const booking = { id: bookingId, booking_code: bookingCode, ...req.body, estimated_cost: pricing.totals.customerTotal };
        await notificationService.sendBookingConfirmation(booking, client);

        res.status(201).json({
            success: true,
            booking: {
                id: bookingId,
                bookingCode,
                estimatedCost: pricing.totals.customerTotal,
                pricing: pricing
            }
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Get booking by ID or code
router.get('/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        const isNumeric = /^\d+$/.test(identifier);
        
        const query = isNumeric 
            ? 'SELECT * FROM bookings WHERE id = ?'
            : 'SELECT * FROM bookings WHERE booking_code = ?';

        db.get(query, [identifier], (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            res.json({ success: true, booking });
        });

    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status } = req.body;

        const allowedStatuses = ['pending', 'confirmed', 'assigned', 'in_transit', 'delivered', 'completed', 'cancelled'];
        
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.run(`
            UPDATE bookings 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [status, bookingId], async function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update status' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Send status update notification
            try {
                const booking = await getBookingDetails(bookingId);
                if (booking) {
                    await notificationService.sendBookingStatusUpdate(booking, status);
                }
            } catch (notificationError) {
                console.error('Status notification error:', notificationError);
            }

            res.json({ success: true, newStatus: status });
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

// Helper functions
async function getOrCreateClient(phoneNumber) {
    return new Promise((resolve, reject) => {
        // Try to get existing client
        db.get('SELECT * FROM users WHERE phone_number = ? AND role = "client"', [phoneNumber], (err, client) => {
            if (err) {
                reject(err);
                return;
            }

            if (client) {
                resolve(client);
                return;
            }

            // Create new client
            db.run(`
                INSERT INTO users (phone_number, whatsapp_number, role, created_at)
                VALUES (?, ?, 'client', datetime('now'))
            `, [phoneNumber, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Return new client
                db.get('SELECT * FROM users WHERE id = ? AND role = "client"', [this.lastID], (err, newClient) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(newClient);
                    }
                });
            });
        });
    });
}

function generateBookingCode() {
    const prefix = 'MNZ';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

async function createBooking(bookingData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO bookings (
                booking_code, client_id, pickup_location, destination, vehicle_type,
                pickup_date, distance_km, estimated_cost, platform_commission, driver_payout,
                special_instructions, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
        `;

        db.run(query, [
            bookingData.bookingCode,
            bookingData.clientId,
            bookingData.pickupLocation,
            bookingData.destination,
            bookingData.vehicleType,
            bookingData.pickupDate,
            bookingData.distance,
            bookingData.estimatedCost,
            bookingData.platformCommission,
            bookingData.driverPayout,
            bookingData.specialInstructions
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function getBookingDetails(bookingId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                b.*,
                c.phone_number as client_phone,
                d.full_name as driver_name,
                d.phone_number as driver_phone
            FROM bookings b
            LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
            WHERE b.id = ?
        `;

        db.get(query, [bookingId], (err, booking) => {
            if (err) {
                reject(err);
            } else {
                resolve(booking);
            }
        });
    });
}

module.exports = router;