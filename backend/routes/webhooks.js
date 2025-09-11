const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const Database = require('../database/db');
const WhatsAppBot = require('../services/whatsappBot');
const NotificationService = require('../services/notificationService');

// Initialize services
const db = new Database().getConnection();
const whatsappBot = new WhatsAppBot();
const notificationService = new NotificationService();

// Twilio webhook validation middleware
const validateTwilioSignature = (req, res, next) => {
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Skip validation in development environment
    if (process.env.NODE_ENV === 'development') {
        return next();
    }
    
    const isValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        req.body
    );
    
    if (!isValid) {
        return res.status(403).json({ error: 'Invalid Twilio signature' });
    }
    
    next();
};

// WhatsApp webhook handler
router.post('/twilio', validateTwilioSignature, async (req, res) => {
    try {
        const {
            From: from,
            To: to,
            Body: body,
            MessageSid: messageSid,
            MediaUrl0: mediaUrl,
            NumMedia: numMedia
        } = req.body;

        console.log('📱 Incoming WhatsApp message:', {
            from,
            to,
            body: body?.substring(0, 100) + (body?.length > 100 ? '...' : ''),
            hasMedia: numMedia > 0
        });

        // Extract phone number (remove whatsapp: prefix)
        const clientPhone = from.replace('whatsapp:', '');
        
        // Log the conversation
        await logConversation(clientPhone, messageSid, 'inbound', body, mediaUrl);
        
        // Process the message with WhatsApp bot
        const response = await whatsappBot.processMessage({
            from: clientPhone,
            body: body || '',
            mediaUrl: mediaUrl,
            hasMedia: numMedia > 0,
            messageSid
        });

        // Send response if generated
        if (response && response.message) {
            await sendWhatsAppMessage(clientPhone, response.message);
            
            // Log outbound message
            await logConversation(clientPhone, null, 'outbound', response.message);
        }

        // Send TwiML response
        const twiml = new twilio.twiml.MessagingResponse();
        res.type('text/xml');
        res.send(twiml.toString());

    } catch (error) {
        console.error('❌ Webhook error:', error);
        
        // Log error to database
        await logSystemError('webhook', 'Twilio webhook processing failed', error);
        
        // Send error response
        const twiml = new twilio.twiml.MessagingResponse();
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// SMS webhook handler (for driver notifications)
router.post('/sms', validateTwilioSignature, async (req, res) => {
    try {
        const {
            From: from,
            To: to,
            Body: body,
            MessageSid: messageSid
        } = req.body;

        console.log('📧 Incoming SMS:', { from, to, body });

        // Process SMS response (e.g., driver confirmations)
        await processSMSResponse(from, body, messageSid);

        res.status(200).send('SMS received');

    } catch (error) {
        console.error('❌ SMS webhook error:', error);
        res.status(500).send('SMS processing failed');
    }
});

// Status callback handler
router.post('/status', validateTwilioSignature, async (req, res) => {
    try {
        const {
            MessageSid: messageSid,
            MessageStatus: status,
            To: to,
            From: from
        } = req.body;

        console.log('📊 Message status update:', { messageSid, status, to, from });

        // Update notification status in database
        await updateNotificationStatus(messageSid, status);

        res.status(200).send('Status updated');

    } catch (error) {
        console.error('❌ Status callback error:', error);
        res.status(500).send('Status update failed');
    }
});

// Helper functions
async function logConversation(clientPhone, messageSid, direction, body, mediaUrl = null) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO whatsapp_conversations 
            (client_phone, message_sid, direction, message_body, media_url, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        
        db.run(query, [clientPhone, messageSid, direction, body, mediaUrl], function(err) {
            if (err) {
                console.error('Database error logging conversation:', err);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function sendWhatsAppMessage(to, message) {
    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const result = await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${to}`,
            body: message
        });

        console.log('✅ WhatsApp message sent:', result.sid);
        return result;

    } catch (error) {
        console.error('❌ Failed to send WhatsApp message:', error);
        throw error;
    }
}

async function processSMSResponse(from, body, messageSid) {
    // Process driver SMS responses (e.g., "ACCEPT", "REJECT")
    const phoneNumber = from.replace('+', '');
    
    // Check if this is from a verified driver
    return new Promise((resolve, reject) => {
        const query = `
            SELECT id, full_name FROM users 
            WHERE phone_number = ? AND role = 'driver' AND driver_status = 'approved'
        `;
        
        db.get(query, [from], async (err, driver) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (driver) {
                // Process driver response
                if (body.toLowerCase().includes('accept')) {
                    await handleDriverAcceptance(driver.id, messageSid);
                } else if (body.toLowerCase().includes('reject')) {
                    await handleDriverRejection(driver.id, messageSid);
                }
            }
            
            resolve();
        });
    });
}

async function handleDriverAcceptance(driverId, messageSid) {
    // Find pending booking assignment for this driver
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE bookings 
            SET status = 'assigned', assigned_at = datetime('now')
            WHERE driver_id = ? AND status = 'confirmed'
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        db.run(query, [driverId], function(err) {
            if (err) {
                reject(err);
            } else {
                console.log(`✅ Driver ${driverId} accepted booking`);
                resolve();
            }
        });
    });
}

async function handleDriverRejection(driverId, messageSid) {
    // Handle driver rejection - reassign to another driver
    console.log(`❌ Driver ${driverId} rejected booking`);
    // Implementation for reassignment logic
}

async function updateNotificationStatus(messageSid, status) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE notifications 
            SET status = ?, delivered_at = datetime('now')
            WHERE twilio_sid = ?
        `;
        
        db.run(query, [status, messageSid], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function logSystemError(category, message, error) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO system_logs (log_level, category, message, details, created_at)
            VALUES ('error', ?, ?, ?, datetime('now'))
        `;
        
        const details = JSON.stringify({
            error: error.message,
            stack: error.stack
        });
        
        db.run(query, [category, message, details], function(err) {
            if (err) {
                console.error('Failed to log error:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

module.exports = router;