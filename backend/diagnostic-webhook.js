const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const cors = require('cors');

const app = express();

// CORS configuration for frontend admin portal
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key'],
    credentials: true
}));

// Enhanced logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
    next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Add pricing admin routes
app.use('/api/admin', require('./routes/pricing'));

const PORT = process.env.PORT || 5000;

// Health check endpoint with detailed system info
app.get('/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'Manyanza WhatsApp Webhook',
        port: PORT,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
    };
    
    console.log('✅ Health check requested:', healthData);
    res.json(healthData);
});

// Test endpoint for basic connectivity
app.get('/test', (req, res) => {
    console.log('🧪 Test endpoint hit');
    res.json({ 
        message: 'Test successful!', 
        timestamp: new Date().toISOString(),
        your_ip: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent')
    });
});

// Main WhatsApp webhook with enhanced logging
app.post('/whatsapp', (req, res) => {
    console.log('📱 ==> INCOMING WHATSAPP MESSAGE <==');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const from = req.body.From || 'Unknown';
    const to = req.body.To || 'Unknown';
    const body = req.body.Body || '';
    const messageSid = req.body.MessageSid || 'No-SID';
    
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Message: "${body}"`);
    console.log(`SID: ${messageSid}`);
    
    try {
        const twiml = new MessagingResponse();
        twiml.message('✅ WhatsApp bot is working! Your message was received.');
        
        console.log('📤 Sending response:', twiml.toString());
        
        res.type('text/xml');
        res.send(twiml.toString());
        
        console.log('✅ Response sent successfully');
    } catch (error) {
        console.error('❌ Error processing WhatsApp message:', error);
        res.status(500).send('Internal Server Error');
    }
});

// SMS backup endpoint
app.post('/sms', (req, res) => {
    console.log('📧 SMS received:', req.body);
    
    const twiml = new MessagingResponse();
    twiml.message('SMS received by Manyanza. WhatsApp preferred: +255765111131');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Catch-all for debugging
app.all('*', (req, res) => {
    console.log(`🔍 Unhandled ${req.method} request to: ${req.url}`);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    
    res.status(404).json({
        error: 'Endpoint not found',
        method: req.method,
        url: req.url,
        available_endpoints: [
            'GET /health - Health check',
            'GET /test - Connectivity test',
            'POST /whatsapp - WhatsApp webhook',
            'POST /sms - SMS webhook'
        ]
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Enhanced server startup
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ================================');
    console.log('🚀 MANYANZA WEBHOOK SERVER STARTED');
    console.log('🚀 ================================');
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
    console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/whatsapp`);
    console.log(`📧 SMS webhook: http://localhost:${PORT}/sms`);
    console.log('');
    console.log('🔧 Next steps:');
    console.log(`1. Run: ngrok http ${PORT}`);
    console.log('2. Copy HTTPS URL to Twilio webhook configuration');
    console.log('3. Test with WhatsApp messages!');
    console.log('');
    console.log('📱 Your Business WhatsApp: +255765111131');
    console.log('🚀 ================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log('📋 Server configuration loaded');
console.log(`📋 Node.js version: ${process.version}`);
console.log(`📋 Platform: ${process.platform}`);
console.log(`📋 Working directory: ${process.cwd()}`);