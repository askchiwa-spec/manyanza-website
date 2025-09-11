const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const NotificationService = require('../services/notificationService');

const db = new Database().getConnection();
const notificationService = new NotificationService();

// Send manual notification (admin only)
router.post('/send', async (req, res) => {
    try {
        const {
            recipientPhone,
            recipientType, // 'client', 'driver', 'admin'
            notificationType, // 'sms', 'whatsapp'
            message,
            bookingId
        } = req.body;

        // Validate required fields
        if (!recipientPhone || !recipientType || !notificationType || !message) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['recipientPhone', 'recipientType', 'notificationType', 'message']
            });
        }

        let result;
        if (notificationType === 'whatsapp') {
            result = await notificationService.sendWhatsAppMessage(recipientPhone, message, bookingId);
        } else if (notificationType === 'sms') {
            result = await notificationService.sendSMS(recipientPhone, message, bookingId, recipientType);
        } else {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        res.json({
            success: true,
            message: 'Notification sent successfully',
            twilioSid: result.sid
        });

    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Send booking reminder
router.post('/reminder', async (req, res) => {
    try {
        const { bookingId, reminderType } = req.body;

        if (!bookingId || !reminderType) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['bookingId', 'reminderType']
            });
        }

        // Get booking details
        const booking = await getBookingWithClient(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Send reminder
        await notificationService.sendBookingReminder(booking, reminderType);

        res.json({
            success: true,
            message: `${reminderType} reminder sent successfully`
        });

    } catch (error) {
        console.error('Send reminder error:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
    }
});

// Get notification history
router.get('/history/:bookingId', async (req, res) => {
    try {
        const bookingId = req.params.bookingId;

        const notifications = await notificationService.getNotificationHistory(bookingId);

        res.json({
            success: true,
            notifications
        });

    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({ error: 'Failed to fetch notification history' });
    }
});

// Get notification statistics (admin only)
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = `
            SELECT 
                notification_type,
                status,
                COUNT(*) as count,
                DATE(created_at) as date
            FROM notifications
            WHERE 1=1
        `;

        const params = [];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate + ' 23:59:59');
        }

        query += ' GROUP BY notification_type, status, DATE(created_at) ORDER BY date DESC';

        db.all(query, params, (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, stats });
        });

    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({ error: 'Failed to fetch notification statistics' });
    }
});

// Get failed notifications (admin only)
router.get('/failed', async (req, res) => {
    try {
        db.all(`
            SELECT 
                n.*,
                b.booking_code,
                b.pickup_location,
                b.destination
            FROM notifications n
            LEFT JOIN bookings b ON n.booking_id = b.id
            WHERE n.status = 'failed'
            ORDER BY n.created_at DESC
            LIMIT 50
        `, (err, failedNotifications) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, failedNotifications });
        });

    } catch (error) {
        console.error('Get failed notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch failed notifications' });
    }
});

// Retry failed notification
router.post('/retry/:notificationId', async (req, res) => {
    try {
        const notificationId = req.params.notificationId;

        // Get notification details
        const notification = await getNotificationById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.status !== 'failed') {
            return res.status(400).json({ error: 'Only failed notifications can be retried' });
        }

        // Retry sending
        let result;
        if (notification.notification_type === 'whatsapp') {
            result = await notificationService.sendWhatsAppMessage(
                notification.recipient_phone, 
                notification.message_body, 
                notification.booking_id
            );
        } else if (notification.notification_type === 'sms') {
            result = await notificationService.sendSMS(
                notification.recipient_phone, 
                notification.message_body, 
                notification.booking_id, 
                notification.recipient_type
            );
        } else {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        res.json({
            success: true,
            message: 'Notification retried successfully',
            twilioSid: result.sid
        });

    } catch (error) {
        console.error('Retry notification error:', error);
        res.status(500).json({ error: 'Failed to retry notification' });
    }
});

// Send emergency alert
router.post('/emergency', async (req, res) => {
    try {
        const { bookingId, issue, reportedBy } = req.body;

        if (!bookingId || !issue || !reportedBy) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['bookingId', 'issue', 'reportedBy']
            });
        }

        // Get booking details
        const booking = await getBookingWithDetails(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Send emergency alert to admin
        await notificationService.sendAdminEmergencyAlert(booking, issue, reportedBy);

        // Log emergency in database
        await logEmergency(bookingId, issue, reportedBy);

        res.json({
            success: true,
            message: 'Emergency alert sent successfully'
        });

    } catch (error) {
        console.error('Send emergency alert error:', error);
        res.status(500).json({ error: 'Failed to send emergency alert' });
    }
});

// Helper functions
async function getBookingWithClient(bookingId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                b.*,
                uc.phone_number as client_phone,
                ud.full_name as driver_name,
                ud.phone_number as driver_phone
            FROM bookings b
            LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
            WHERE b.id = ?
        `, [bookingId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function getBookingWithDetails(bookingId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                b.*,
                uc.phone_number as client_phone,
                uc.full_name as client_name,
                ud.full_name as driver_name,
                ud.phone_number as driver_phone
            FROM bookings b
            LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
            WHERE b.id = ?
        `, [bookingId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function getNotificationById(notificationId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM notifications WHERE id = ?', [notificationId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function logEmergency(bookingId, issue, reportedBy) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO system_logs (log_level, category, message, details, booking_id, created_at)
            VALUES ('critical', 'emergency', 'Emergency reported', ?, ?, datetime('now'))
        `, [JSON.stringify({ issue, reportedBy }), bookingId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

module.exports = router;