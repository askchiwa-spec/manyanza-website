const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const RateLimitingService = require('./middleware/rateLimiting');
const { ErrorHandler, addRequestId, handleNotFound } = require('./middleware/errorHandler');
const EnvironmentValidator = require('./services/envValidator');
require('dotenv').config();

// Validate environment before starting server
const envValidator = new EnvironmentValidator();
const envValidation = envValidator.validateEnvironment();

if (!envValidation.valid) {
    console.error('❌ Environment validation failed!');
    envValidator.generateReport();
    process.exit(1);
} else {
    console.log('✅ Environment validation passed');
    if (envValidation.warnings.length > 0) {
        console.log('⚠️  Environment warnings detected:');
        envValidation.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
}

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize services
const rateLimitingService = new RateLimitingService();
const errorHandler = new ErrorHandler();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://askchiwa-spec.github.io', 'https://manyanza.co.tz']
        : ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true
}));

// Trust proxy for accurate IP detection (important for rate limiting)
app.set('trust proxy', 1);

// Add request ID for error tracking
app.use(addRequestId);

// Apply general rate limiting to all API routes
app.use('/api/', rateLimitingService.getGeneralRateLimit());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database initialization
const Database = require('./database/db');
const TokenCleanupService = require('./utils/tokenCleanup');
const db = new Database();
const tokenCleanup = new TokenCleanupService();

// Initialize database tables
db.initialize().then(() => {
    console.log('✅ Database initialized successfully');
    
    // Start token cleanup service
    tokenCleanup.start();
    console.log('🧹 Token cleanup service started');
}).catch(err => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
});

// API Routes
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/webhooks', rateLimitingService.getWhatsAppRateLimit(), require('./routes/webhooks'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/admin', rateLimitingService.getAdminRateLimit(), require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/payment-settings', require('./routes/payment-settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/system', require('./routes/system'));

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Manyanza Backend API',
        version: '1.0.0',
        description: 'Backend API for Manyanza Company Limited - WhatsApp automation and booking management',
        endpoints: {
            'POST /api/webhooks/twilio': 'Twilio WhatsApp webhook handler',
            'GET /api/bookings': 'List all bookings (admin)',
            'POST /api/bookings': 'Create new booking',
            'GET /api/drivers': 'List verified drivers (admin)',
            'POST /api/drivers': 'Add new driver',
            'GET /api/admin/dashboard': 'Admin dashboard data',
            'POST /api/payments/verify': 'Verify payment proof',
            'POST /api/notifications/send': 'Send notifications'
        },
        documentation: '/api/docs'
    });
});

// Serve static files from the parent directory (website files)
app.use(express.static(path.join(__dirname, '..')));

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Serve other HTML pages
const pages = ['about', 'services', 'pricing-calculator', 'become-driver', 'contact', 'admin', 'client-dashboard', 'driver-dashboard', 'admin-dashboard', 'client-register', 'driver-register', 'settings', 'my-bookings', 'driver-bookings', 'driver-earnings', 'driver-profile', 'driver-reports', 'driver-vehicles'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, '..', `${page}.html`));
    });
});

// Error handling middleware
app.use(handleNotFound);
app.use(errorHandler.handleError);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    tokenCleanup.stop();
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    tokenCleanup.stop();
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Manyanza Backend API running on port ${PORT}`);
    console.log(`📱 WhatsApp Business Number: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
    console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth/`);
    console.log(`🧹 Token cleanup: ${tokenCleanup.getStatus().isRunning ? 'Active' : 'Inactive'}`);
});

module.exports = app;
