const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Manyanza Simple WhatsApp Webhook',
        timestamp: new Date().toISOString()
    });
});

// Main WhatsApp webhook endpoint
app.post('/whatsapp', (req, res) => {
    console.log('📱 Incoming WhatsApp Message:');
    console.log('From:', req.body.From);
    console.log('To:', req.body.To);
    console.log('Body:', req.body.Body);
    console.log('---');

    const twiml = new MessagingResponse();
    const incomingMessage = req.body.Body || '';
    const from = req.body.From;

    // Smart response based on message content
    const message = incomingMessage.toLowerCase().trim();
    
    if (message.includes('book') || message.includes('booking')) {
        twiml.message(`🚗 *Welcome to Manyanza Vehicle Transit!*

To book a vehicle, please provide:
📍 Pickup location
📍 Destination
🚛 Vehicle type (pickup/van/truck)
📅 Date needed

Example: "Dar es Salaam to Mwanza pickup tomorrow"

Or call us: +255765111131 📞`);
    } 
    else if (message.includes('price') || message.includes('cost')) {
        twiml.message(`💰 *Manyanza Pricing*

Our transparent pricing:
• TSh 1,500 per kilometer
• Professional driver included
• Full insurance coverage
• Return corridor allowance

Send your route for exact quote! 
Call: +255765111131 📊`);
    }
    else if (message.includes('help') || message === '?') {
        twiml.message(`🆘 *Manyanza Help*

*Commands:*
• BOOK - Start booking
• PRICE - Get pricing
• CONTACT - Speak to human

*Contact:*
📞 +255765111131
📧 info@manyanza.co.tz

We're here 24/7! 🕒`);
    }
    else if (message.includes('contact') || message.includes('human')) {
        twiml.message(`👨‍💼 *Connecting you to our team...*

A Manyanza representative will contact you within 15 minutes.

*Call directly:*
📞 +255765111131

*Business Hours:*
Mon-Fri: 8AM-6PM
Sat: 9AM-4PM 🚨`);
    }
    else {
        // Echo message with helpful info
        twiml.message(`👋 *Hello from Manyanza!*

We received: "${req.body.Body}"

*How can we help?*
🚗 BOOK - Vehicle booking
💰 PRICE - Get pricing
🆘 HELP - Full menu

*Quick booking?* Call: +255765111131 📍`);
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// SMS webhook (backup)
app.post('/sms', (req, res) => {
    console.log('📧 SMS received:', req.body.From, req.body.Body);
    
    const twiml = new MessagingResponse();
    twiml.message('SMS received by Manyanza. WhatsApp preferred: +255765111131');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Manyanza Simple Webhook Server Started');
    console.log(`🌐 Server running on port: ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/whatsapp`);
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Run: ngrok http ' + PORT);
    console.log('2. Copy HTTPS URL to Twilio webhook configuration');
    console.log('3. Test by sending WhatsApp messages!');
    console.log('');
    console.log('📱 Your Business WhatsApp: +255765111131');
});