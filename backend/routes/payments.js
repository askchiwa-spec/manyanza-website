const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NotificationService = require('../services/notificationService');

const db = new Database().getConnection();
const notificationService = new NotificationService();

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = './uploads/payments/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'payment-proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'));
        }
    }
});

// Submit payment proof
router.post('/submit-proof', upload.single('paymentProof'), async (req, res) => {
    try {
        const {
            bookingId,
            paymentMethod,
            amount,
            transactionReference,
            clientPhone
        } = req.body;

        // Validate required fields
        if (!bookingId || !paymentMethod || !amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['bookingId', 'paymentMethod', 'amount']
            });
        }

        // Verify booking exists
        const booking = await getBookingById(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Save payment proof
        const paymentProofId = await savePaymentProof({
            bookingId,
            paymentMethod,
            amount: parseFloat(amount),
            transactionReference,
            proofImagePath: req.file ? req.file.path : null
        });

        // Update booking status to confirmed (pending admin verification)
        await updateBookingStatus(bookingId, 'confirmed');

        // Send confirmation to client
        const confirmationMessage = `📷 *Payment Proof Received!*\n\n📋 Booking: #${booking.booking_code}\n💰 Amount: TSh ${parseFloat(amount).toLocaleString()}\n💳 Method: ${paymentMethod.toUpperCase()}\n${transactionReference ? `📄 Reference: ${transactionReference}\n` : ''}\n⏳ We're verifying your payment and will confirm within 30 minutes.\n\nThank you for choosing Manyanza! 🙏`;

        if (clientPhone) {
            try {
                await notificationService.sendWhatsAppMessage(clientPhone, confirmationMessage, bookingId);
            } catch (notificationError) {
                console.error('Payment confirmation notification failed:', notificationError);
            }
        }

        // Notify admin about payment verification needed
        await notifyAdminPaymentReceived(booking, paymentMethod, amount, transactionReference);

        res.json({
            success: true,
            message: 'Payment proof submitted successfully',
            paymentProofId,
            status: 'pending_verification'
        });

    } catch (error) {
        console.error('Payment proof submission error:', error);
        res.status(500).json({ error: 'Failed to submit payment proof' });
    }
});

// Verify payment (admin only)
router.post('/verify/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const { isVerified, rejectionReason, verifiedBy } = req.body;

        const status = isVerified ? 'verified' : 'rejected';

        // Update payment proof status
        await updatePaymentProofStatus(paymentId, status, verifiedBy, rejectionReason);

        // Get payment and booking details
        const paymentDetails = await getPaymentDetails(paymentId);
        
        if (paymentDetails) {
            // Update booking status based on verification
            if (isVerified) {
                await updateBookingStatus(paymentDetails.booking_id, 'confirmed');
            } else {
                await updateBookingStatus(paymentDetails.booking_id, 'pending');
            }

            // Send notification to client
            try {
                await notificationService.sendPaymentVerificationResult(
                    paymentDetails, 
                    isVerified, 
                    rejectionReason
                );
            } catch (notificationError) {
                console.error('Payment verification notification failed:', notificationError);
            }
        }

        res.json({
            success: true,
            message: `Payment ${status} successfully`,
            verificationStatus: status
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// Get payment proofs for booking
router.get('/booking/:bookingId', async (req, res) => {
    try {
        const bookingId = req.params.bookingId;

        db.all(`
            SELECT * FROM payment_proofs 
            WHERE booking_id = ?
            ORDER BY created_at DESC
        `, [bookingId], (err, paymentProofs) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, paymentProofs });
        });

    } catch (error) {
        console.error('Get payment proofs error:', error);
        res.status(500).json({ error: 'Failed to fetch payment proofs' });
    }
});

// Get pending payment verifications (admin only)
router.get('/pending-verifications', async (req, res) => {
    try {
        db.all(`
            SELECT 
                pp.*,
                b.booking_id,
                b.pickup_location,
                b.destination,
                b.estimated_cost,
                uc.phone_number as client_phone,
                uc.full_name as client_name
            FROM payment_proofs pp
            JOIN bookings b ON pp.booking_id = b.id
            JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            WHERE pp.verification_status = 'pending'
            ORDER BY pp.created_at ASC
        `, (err, pendingPayments) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, pendingPayments });
        });

    } catch (error) {
        console.error('Get pending verifications error:', error);
        res.status(500).json({ error: 'Failed to fetch pending verifications' });
    }
});

// M-Pesa integration placeholder (for future implementation)
router.post('/mpesa/callback', async (req, res) => {
    try {
        // M-Pesa callback handling will be implemented here
        console.log('M-Pesa callback received:', req.body);
        
        // For now, just acknowledge receipt
        res.json({ 
            ResultCode: 0, 
            ResultDesc: "Accepted" 
        });

    } catch (error) {
        console.error('M-Pesa callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

// TigoPesa integration placeholder (for future implementation)
router.post('/tigopesa/callback', async (req, res) => {
    try {
        // TigoPesa callback handling will be implemented here
        console.log('TigoPesa callback received:', req.body);
        
        res.json({ success: true });

    } catch (error) {
        console.error('TigoPesa callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

// Helper functions
async function getBookingById(bookingId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function savePaymentProof(paymentData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO payment_proofs (
                booking_id, payment_method, amount, transaction_reference, 
                proof_image_path, verification_status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `;

        db.run(query, [
            paymentData.bookingId,
            paymentData.paymentMethod,
            paymentData.amount,
            paymentData.transactionReference,
            paymentData.proofImagePath
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function updateBookingStatus(bookingId, status) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE bookings 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [status, bookingId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

async function updatePaymentProofStatus(paymentId, status, verifiedBy, rejectionReason = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE payment_proofs 
            SET verification_status = ?, verified_at = datetime('now'), 
                verified_by = ?, rejection_reason = ?
            WHERE id = ?
        `, [status, verifiedBy, rejectionReason, paymentId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

async function getPaymentDetails(paymentId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                pp.*,
                b.booking_id,
                b.pickup_location,
                b.destination,
                uc.phone_number as client_phone
            FROM payment_proofs pp
            JOIN bookings b ON pp.booking_id = b.id
            JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            WHERE pp.id = ?
        `, [paymentId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function notifyAdminPaymentReceived(booking, paymentMethod, amount, transactionReference) {
    const adminMessage = `💰 *Payment Received - Verification Needed*\n\n📋 Booking: #${booking.booking_code}\n👤 Client: ${booking.client_phone}\n💳 Method: ${paymentMethod.toUpperCase()}\n💰 Amount: TSh ${parseFloat(amount).toLocaleString()}\n${transactionReference ? `📄 Reference: ${transactionReference}\n` : ''}\n📍 Route: ${booking.pickup_location} → ${booking.destination}\n\n⚡ Action Required: Verify payment in admin dashboard\n🔗 Admin: http://localhost:3000/api/admin/dashboard`;

    try {
        await notificationService.sendWhatsAppMessage('+255765111131', adminMessage, booking.id);
    } catch (error) {
        console.error('Admin payment notification failed:', error);
    }
}

module.exports = router;