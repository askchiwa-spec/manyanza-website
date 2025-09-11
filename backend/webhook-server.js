require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const app = express();

// Middleware for Twilio webhook (urlencoded)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Manyanza WhatsApp Webhook Server',
        timestamp: new Date().toISOString()
    });
});

// Main WhatsApp webhook endpoint
app.post('/whatsapp', (req, res) => {
    const from = req.body.From;        // e.g. 'whatsapp:+255765111131'
    const to = req.body.To;            // e.g. 'whatsapp:+14155238886'
    const body = req.body.Body || '';  // incoming text
    const mediaUrl = req.body.MediaUrl0; // first media attachment
    const mediaType = req.body.MediaContentType0; // media type
    const messageSid = req.body.MessageSid; // unique message ID
    
    console.log('📱 Incoming WhatsApp Message:');
    console.log('From:', from);
    console.log('To:', to);
    console.log('Body:', body);
    console.log('Media URL:', mediaUrl || 'None');
    console.log('Media Type:', mediaType || 'None');
    console.log('Message SID:', messageSid);
    console.log('---');

    // Parse the message text
    const text = body.trim().toLowerCase();
    const twiml = new twilio.twiml.MessagingResponse();

    // Handle different keywords and commands
    if (text.startsWith('book') || text === 'booking' || text === 'start') {
        twiml.message(`🚗 *Welcome to Manyanza Vehicle Transit!*

To book a vehicle, please provide:
📍 *Pickup location*
📍 *Destination* 
🚛 *Vehicle type* (pickup/van/truck)
📅 *Date needed*

Example: "BOOK Dar es Salaam to Tunduma pickup tomorrow"

Or just tell me your pickup location to start! 😊`);

    } else if (text.includes('price') || text.includes('cost') || text.includes('how much')) {
        twiml.message(`💰 *Manyanza Pricing*

Our transparent pricing:
• TSh 1,500 per kilometer
• Return corridor allowance included
• Professional driver included
• Full insurance coverage

Send your route for exact quote! 📊`);

    } else if (text.includes('driver') || text === 'driver') {
        twiml.message(`👨‍💼 *Become a Manyanza Driver*

Requirements:
✅ Valid driving license
✅ Clean police clearance
✅ NIDA verification
✅ Professional experience

Benefits:
💰 Competitive rates
🛡️ Insurance coverage
📱 24/7 support

Ready to join? Send "DRIVER APPLICATION" 🚛`);

    } else if (text.includes('help') || text === '?') {
        twiml.message(`🆘 *Manyanza Help Center*

*Commands:*
• BOOK - Start booking process
• PRICE - Get pricing info
• DRIVER - Driver registration
• STATUS - Check booking status
• CONTACT - Speak to human

*Contact:*
📞 +255765111131
📧 info@manyanza.co.tz

We're here 24/7! 🕒`);

    } else if (text.includes('contact') || text.includes('human') || text.includes('agent')) {
        twiml.message(`👨‍💼 *Connecting you to our team...*

A Manyanza representative will contact you within 15 minutes.

*Urgent?* Call directly:
📞 +255765111131

*Business Hours:*
Mon-Fri: 8AM-6PM
Sat: 9AM-4PM
Sun: Emergency only 🚨`);

    } else if (text.includes('thanks') || text.includes('thank you') || text.includes('asante')) {
        twiml.message(`🙏 *You're welcome!*

Thank you for choosing Manyanza Company Limited. We're committed to safe, reliable vehicle transit across Tanzania.

Need anything else? Just ask! 😊`);

    } else if (mediaUrl) {
        // Handle media uploads (documents, photos)
        console.log('📎 Media received:', mediaUrl, mediaType);
        
        if (mediaType && mediaType.startsWith('image/')) {
            twiml.message(`📸 *Image received!*

Thank you for sending the document. Our team will review it shortly.

*What's this for?*
• Payment proof
• Driver documents
• Vehicle photos
• Other documentation

A team member will verify and respond within 2 hours. ✅`);
        } else {
            twiml.message(`📄 *Document received!*

Your file has been uploaded successfully. Our verification team will review and respond within 2 hours.

*Need to send more documents?* Just attach and send! 📎`);
        }

    } else if (text.length > 0) {
        // Parse potential booking information
        if (text.includes('to ') && (text.includes('dar') || text.includes('mwanza') || text.includes('tunduma') || text.includes('arusha'))) {
            // Looks like a route request
            twiml.message(`🗺️ *Route detected!*

"${body}"

Let me get you a quote! Please specify:
🚛 Vehicle type needed?
📅 When do you need pickup?
📦 Any special requirements?

Our team will calculate exact pricing and respond shortly! 💰`);
        } else {
            // General response with gentle guidance
            twiml.message(`👋 *Hello from Manyanza!*

I received: "${body}"

*How can I help you today?*
🚗 BOOK - Vehicle booking
💰 PRICE - Get pricing
👨‍💼 DRIVER - Join our team
🆘 HELP - Full menu

*Quick booking?* Just tell me your pickup and destination! 📍`);
        }
    } else {
        // Empty message or just emoji
        twiml.message(`👋 *Hello from Manyanza Vehicle Transit!*

*Tanzania's trusted vehicle transport service*

*Quick commands:*
🚗 BOOK - Start booking
💰 PRICE - Get pricing 
🆘 HELP - Full menu

Ready to transport your vehicle safely? Let's get started! 🚛✨`);
    }

    // Return TwiML response
    res.type('text/xml').send(twiml.toString());
});

// SMS webhook (for driver notifications)
app.post('/sms', (req, res) => {
    const from = req.body.From;
    const body = req.body.Body || '';
    
    console.log('📧 SMS received from:', from, 'Body:', body);
    
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('SMS received by Manyanza. WhatsApp preferred: +255765111131');
    
    res.type('text/xml').send(twiml.toString());
});

// Status callback endpoint
app.post('/status', (req, res) => {
    console.log('📊 Message Status Update:', {
        MessageSid: req.body.MessageSid,
        MessageStatus: req.body.MessageStatus,
        To: req.body.To,
        From: req.body.From
    });
    
    res.status(200).send('OK');
});

// Test endpoint to send outbound messages
app.post('/send-test', async (req, res) => {
    const { to, message } = req.body;
    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return res.status(400).json({ error: 'Twilio credentials not configured' });
    }
    
    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const result = await client.messages.create({
            from: 'whatsapp:+14155238886', // Twilio sandbox number
            to: `whatsapp:${to}`,
            body: message || 'Test message from Manyanza! 🚗'
        });
        
        res.json({ success: true, messageSid: result.sid });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to inspect last request
let lastRequest = null;
app.use((req, res, next) => {
    if (req.path === '/whatsapp' && req.method === 'POST') {
        lastRequest = {
            timestamp: new Date().toISOString(),
            headers: req.headers,
            body: req.body
        };
    }
    next();
});

app.get('/debug/last-request', (req, res) => {
    res.json(lastRequest || { message: 'No requests received yet' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Manyanza WhatsApp Webhook Server Started');
    console.log('🌐 Server running on port:', PORT);
    console.log('🔗 Health check: http://localhost:' + PORT + '/health');
    console.log('📱 WhatsApp webhook: http://localhost:' + PORT + '/whatsapp');
    console.log('📧 SMS webhook: http://localhost:' + PORT + '/sms');
    console.log('📊 Status webhook: http://localhost:' + PORT + '/status');
    console.log('🧪 Debug endpoint: http://localhost:' + PORT + '/debug/last-request');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Install ngrok: brew install ngrok (or download from ngrok.com)');
    console.log('2. Run: ngrok http ' + PORT);
    console.log('3. Copy HTTPS URL to Twilio webhook configuration');
    console.log('4. Test by sending WhatsApp messages!');
});