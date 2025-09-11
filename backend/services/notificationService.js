const twilio = require('twilio');
const Database = require('../database/db');

class NotificationService {
    constructor() {
        // Check if Twilio credentials are properly configured
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        if (!accountSid || !authToken || accountSid === 'your_twilio_account_sid_here' || !accountSid.startsWith('AC')) {
            console.log('⚠️  Twilio credentials not configured. Notification service running in mock mode.');
            this.client = null;
            this.mockMode = true;
        } else {
            try {
                this.client = twilio(accountSid, authToken);
                this.mockMode = false;
                console.log('✅ Twilio client initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize Twilio client:', error.message);
                this.client = null;
                this.mockMode = true;
            }
        }
        
        this.db = new Database().getConnection();
        this.fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+255765111131';
        this.fromSMS = process.env.TWILIO_PHONE_NUMBER || '+255765111131';
    }

    /**
     * Send WhatsApp message
     */
    async sendWhatsAppMessage(to, message, bookingId = null) {
        try {
            if (this.mockMode || !this.client) {
                console.log(`🧘 [MOCK] WhatsApp to ${to}: ${message.substring(0, 100)}...`);
                // Log notification in mock mode
                await this.logNotification(to, 'client', 'whatsapp', message, bookingId, 'sent', 'MOCK_SID');
                return { sid: 'MOCK_SID', status: 'sent' };
            }

            const result = await this.client.messages.create({
                from: this.fromWhatsApp,
                to: `whatsapp:${to}`,
                body: message
            });

            // Log notification
            await this.logNotification(to, 'client', 'whatsapp', message, bookingId, 'sent', result.sid);
            
            console.log(`✅ WhatsApp sent to ${to}: ${result.sid}`);
            return result;

        } catch (error) {
            console.error(`❌ WhatsApp failed to ${to}:`, error);
            await this.logNotification(to, 'client', 'whatsapp', message, bookingId, 'failed', null, error.message);
            throw error;
        }
    }

    /**
     * Send SMS message
     */
    async sendSMS(to, message, bookingId = null, recipientType = 'driver') {
        try {
            if (this.mockMode || !this.client) {
                console.log(`🧘 [MOCK] SMS to ${to}: ${message.substring(0, 100)}...`);
                // Log notification in mock mode
                await this.logNotification(to, recipientType, 'sms', message, bookingId, 'sent', 'MOCK_SMS_SID');
                return { sid: 'MOCK_SMS_SID', status: 'sent' };
            }

            const result = await this.client.messages.create({
                from: this.fromSMS,
                to: to,
                body: message
            });

            // Log notification
            await this.logNotification(to, recipientType, 'sms', message, bookingId, 'sent', result.sid);
            
            console.log(`✅ SMS sent to ${to}: ${result.sid}`);
            return result;

        } catch (error) {
            console.error(`❌ SMS failed to ${to}:`, error);
            await this.logNotification(to, recipientType, 'sms', message, bookingId, 'failed', null, error.message);
            throw error;
        }
    }

    /**
     * Send booking confirmation to client
     */
    async sendBookingConfirmation(booking, client) {
        const message = `🎉 *BOOKING CONFIRMED!*\n\n📋 Booking: #${booking.booking_code}\n📍 ${booking.pickup_location} → ${booking.destination}\n🚗 Vehicle: ${booking.vehicle_type.toUpperCase()}\n💰 Total: TSh ${booking.estimated_cost.toLocaleString()}\n📅 Date: ${booking.pickup_date}\n\n⏳ We're finding the perfect driver for you. You'll receive driver details within 2 hours.\n\n📞 Questions? Reply to this message!\n\n🙏 Thank you for choosing Manyanza!`;

        return this.sendWhatsAppMessage(client.phone_number, message, booking.id);
    }

    /**
     * Send driver assignment notification to client
     */
    async sendClientDriverAssignedNotification(booking, driver) {
        const message = `👨‍💼 *DRIVER ASSIGNED!*\n\n📋 Booking: #${booking.booking_code}\n👤 Driver: ${driver.full_name}\n📱 Phone: ${driver.phone_number}\n⭐ Rating: ${driver.rating}/5.0\n🚗 Experience: ${driver.experience_years} years\n\n📍 Route: ${booking.pickup_location} → ${booking.destination}\n📅 Pickup: ${booking.pickup_date}\n\n✅ Your driver will contact you to confirm pickup details.\n\n📞 You can reach your driver directly at ${driver.phone_number}\n\n🛡️ *Safety Reminder:*\nYour assigned driver is fully vetted with:\n• Valid license & insurance\n• Police clearance verified\n• Professional driving record\n\n🚫 *Important:* Driver cannot take passengers during vehicle transit for liability reasons.\n\n📱 Track your booking status by replying 'STATUS' to this message.`;

        return this.sendWhatsAppMessage(booking.client_phone, message, booking.id);
    }

    /**
     * Send driver assignment notification to driver
     */
    async sendDriverAssignmentNotification(driver, booking) {
        const message = `🚗 *NEW BOOKING ASSIGNMENT*\n\nHi ${driver.full_name},\n\nYou have been assigned a new transit job:\n\n📋 Booking: #${booking.booking_code}\n📍 Pickup: ${booking.pickup_location}\n🎯 Destination: ${booking.destination}\n🚙 Vehicle: ${booking.vehicle_type.toUpperCase()}\n📅 Date: ${booking.pickup_date}\n💰 Your Payout: TSh ${booking.driver_payout?.toLocaleString() || 'TBD'}\n\n📱 Client Contact: ${booking.client_phone}\n\n⚡ *URGENT: Reply within 30 minutes*\n• Reply 'ACCEPT' to confirm\n• Reply 'REJECT' if unavailable\n\n📞 For questions, call admin: +255765111131\n\n⚠️ *IMPORTANT REMINDERS:*\n• NO passengers allowed during transit\n• Verify vehicle condition before departure\n• Take photos of vehicle at pickup/delivery\n• Follow all traffic regulations\n• Contact admin for any issues\n\n✅ Once you reply 'ACCEPT', client will receive your contact details.\n\nDrive safe! 🙏`;

        // Send both SMS and WhatsApp for critical driver notifications
        try {
            await this.sendSMS(driver.phone_number, message, booking.id, 'driver');
            return await this.sendWhatsAppMessage(driver.phone_number, message, booking.id);
        } catch (error) {
            console.error('Driver notification failed:', error);
            // Try just SMS if WhatsApp fails
            return this.sendSMS(driver.phone_number, message, booking.id, 'driver');
        }
    }

    /**
     * Send booking status update
     */
    async sendBookingStatusUpdate(booking, newStatus) {
        let message = '';

        switch (newStatus) {
            case 'in_transit':
                message = `🚛 *VEHICLE IN TRANSIT*\n\n📋 Booking: #${booking.booking_code}\n👤 Driver: ${booking.driver_name}\n📱 Driver Phone: ${booking.driver_phone}\n\n🛣️ Your vehicle is now in transit from ${booking.pickup_location} to ${booking.destination}.\n\n⏱️ Estimated arrival based on route and conditions.\n\n📱 You can contact your driver directly for updates.\n\n📍 Track status: Reply 'STATUS' anytime.`;
                break;

            case 'delivered':
                message = `🎯 *DELIVERY COMPLETED!*\n\n📋 Booking: #${booking.booking_code}\n✅ Your vehicle has been successfully delivered to ${booking.destination}!\n\n👤 Driver: ${booking.driver_name}\n📅 Completed: ${new Date().toLocaleDateString()}\n\n💰 *Payment Reminder:*\nRemaining balance: TSh ${booking.remaining_payment?.toLocaleString() || '0'}\n\n⭐ *Rate Your Experience:*\nHow was your service? Reply with:\n• EXCELLENT\n• GOOD  \n• FAIR\n• POOR\n\n📞 Any issues? Contact us immediately.\n\n🙏 Thank you for choosing Manyanza!`;
                break;

            case 'completed':
                message = `✅ *BOOKING COMPLETED*\n\n📋 Booking: #${booking.booking_code} is now complete!\n\n🎉 Thank you for using Manyanza Vehicle Transit.\n\n📊 *Trip Summary:*\n• Route: ${booking.pickup_location} → ${booking.destination}\n• Vehicle: ${booking.vehicle_type.toUpperCase()}\n• Driver: ${booking.driver_name}\n• Total Cost: TSh ${booking.final_cost?.toLocaleString() || booking.estimated_cost.toLocaleString()}\n\n⭐ We hope you had an excellent experience!\n\n🔄 Need another vehicle transit? Just reply 'BOOK'\n\n📧 Receipt will be sent to your email if provided.\n\n🙏 Thank you for trusting Manyanza!`;
                break;

            default:
                message = `📊 *BOOKING UPDATE*\n\n📋 Booking: #${booking.booking_code}\n🔄 Status: ${newStatus.toUpperCase()}\n📅 Updated: ${new Date().toLocaleString()}\n\nFor details, reply 'STATUS' or call +255765111131`;
        }

        return this.sendWhatsAppMessage(booking.client_phone, message, booking.id);
    }

    /**
     * Send payment verification result
     */
    async sendPaymentVerificationResult(booking, isVerified, rejectionReason = null) {
        let message = '';

        if (isVerified) {
            message = `💳 *PAYMENT VERIFIED!*\n\n📋 Booking: #${booking.booking_code}\n✅ Your payment has been confirmed.\n\n🔄 *Next Steps:*\n• We're assigning a driver\n• You'll receive driver details within 2 hours\n• Driver will contact you directly\n\n📱 Track your booking: Reply 'STATUS'\n\n🙏 Thank you for your payment!`;
        } else {
            message = `❌ *PAYMENT VERIFICATION ISSUE*\n\n📋 Booking: #${booking.booking_code}\n⚠️ We couldn't verify your payment.\n\n${rejectionReason ? `Reason: ${rejectionReason}\n\n` : ''}🔄 *Please:*\n• Check payment details\n• Resend clear payment proof\n• Or contact us at +255765111131\n\n💡 *Tips for clear payment proof:*\n• Full screenshot showing amount\n• Include transaction reference\n• Ensure image is clear and readable\n\n📞 Need help? Call us immediately.`;
        }

        return this.sendWhatsAppMessage(booking.client_phone, message, booking.id);
    }

    /**
     * Send emergency alert to admin
     */
    async sendAdminEmergencyAlert(booking, issue, reportedBy) {
        const message = `🚨 *EMERGENCY ALERT*\n\nBooking: #${booking.booking_code}\nIssue: ${issue}\nReported by: ${reportedBy}\nDriver: ${booking.driver_name} (${booking.driver_phone})\nClient: ${booking.client_phone}\nRoute: ${booking.pickup_location} → ${booking.destination}\n\nImmediate action required!`;

        // Send to admin phone (using your WhatsApp number)
        return this.sendWhatsAppMessage('+255765111131', message, booking.id);
    }

    /**
     * Send booking reminder
     */
    async sendBookingReminder(booking, reminderType = 'pickup') {
        let message = '';

        if (reminderType === 'pickup') {
            message = `⏰ *PICKUP REMINDER*\n\n📋 Booking: #${booking.booking_code}\n📅 Pickup scheduled for tomorrow!\n\n📍 Location: ${booking.pickup_location}\n👤 Driver: ${booking.driver_name}\n📱 Driver Phone: ${booking.driver_phone}\n\n✅ *Please ensure:*\n• Vehicle is ready for pickup\n• All documents are available\n• Contact details are correct\n\n📞 Any changes? Contact driver directly or call +255765111131\n\n🙏 Thank you for choosing Manyanza!`;
        }

        return this.sendWhatsAppMessage(booking.client_phone, message, booking.id);
    }

    /**
     * Log notification to database
     */
    async logNotification(recipientPhone, recipientType, notificationType, messageBody, bookingId, status, twilioSid = null, errorMessage = null) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO notifications 
                (recipient_phone, recipient_type, notification_type, message_body, booking_id, status, twilio_sid, error_message, sent_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            this.db.run(query, [
                recipientPhone,
                recipientType,
                notificationType,
                messageBody,
                bookingId,
                status,
                twilioSid,
                errorMessage
            ], function(err) {
                if (err) {
                    console.error('Failed to log notification:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Get notification history for booking
     */
    async getNotificationHistory(bookingId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM notifications 
                WHERE booking_id = ?
                ORDER BY created_at DESC
            `, [bookingId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = NotificationService;