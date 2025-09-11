// Simple test server without Twilio initialization
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Database = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Manyanza Backend Test Server Running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Database test endpoint
app.get('/test/database', async (req, res) => {
    try {
        const db = new Database();
        await db.initialize();
        
        res.json({ 
            status: 'OK',
            message: 'Database connection successful',
            tables: ['clients', 'drivers', 'bookings', 'whatsapp_conversations', 'payment_proofs', 'notifications', 'admin_users', 'system_logs']
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// API routes test
app.get('/test/routes', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API routes test',
        available_routes: [
            'GET /health',
            'GET /test/database',
            'GET /test/routes',
            'POST /api/webhooks/twilio (requires Twilio setup)',
            'GET /api/bookings (requires auth)',
            'POST /api/bookings',
            'GET /api/drivers',
            'POST /api/admin/login'
        ]
    });
});

// Basic booking simulation (without Twilio)
app.post('/test/booking', async (req, res) => {
    const { pickup, destination, vehicleType } = req.body;
    
    if (!pickup || !destination || !vehicleType) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['pickup', 'destination', 'vehicleType']
        });
    }

    // Simulate booking creation
    const bookingCode = `MNZ${Date.now().toString().slice(-6)}TST`;
    
    res.json({
        status: 'SUCCESS',
        message: 'Test booking created successfully',
        booking: {
            code: bookingCode,
            pickup,
            destination,
            vehicleType,
            estimatedCost: 150000, // TSh 150,000 simulation
            status: 'pending'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🧪 Test server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🗄️  Database test: http://localhost:${PORT}/test/database`);
    console.log(`📋 Routes test: http://localhost:${PORT}/test/routes`);
    console.log(`📱 Booking test: POST http://localhost:${PORT}/test/booking`);
});