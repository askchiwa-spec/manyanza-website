require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('./config/passport');
const path = require('path');
const cors = require('cors');
const Database = require('./database/db');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize database
const database = new Database();
database.initialize().then(() => {
    console.log('✅ Database initialized successfully');
}).catch(error => {
    console.error('❌ Database initialization failed:', error);
});

// CORS configuration
app.use(cors({
    origin: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data'
    }),
    secret: process.env.SESSION_SECRET || 'manyanza-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Enhanced logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // Log authentication status
    if (req.user) {
        console.log(`  👤 Authenticated: ${req.user.name} (${req.user.email})`);
    } else {
        console.log(`  🔓 Anonymous`);
    }
    
    next();
});

// Serve static files from the parent directory (website files)
app.use(express.static(path.join(__dirname, '..')));

// Authentication routes
const { router: authRouter } = require('./routes/auth');
app.use('/auth', authRouter);

// Admin routes (includes pricing)
app.use('/api/admin', require('./routes/pricing'));

// Main routes
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));

// Protected routes middleware
const { ensureAuthenticated } = require('./middleware/auth');

// Serve dashboard only to authenticated users
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dashboard.html'));
});

// Serve login page only to guests
const { ensureGuest } = require('./middleware/auth');
app.get('/login', ensureGuest, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// API health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        authentication: 'enabled',
        database: 'connected',
        services: {
            oauth: 'configured',
            sessions: 'active',
            database: 'ready'
        }
    });
});

// Root endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Manyanza Authentication Server',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        message: 'Welcome to Manyanza Company Limited API',
        authentication: {
            enabled: true,
            provider: 'Google OAuth 2.0',
            status: req.isAuthenticated() ? 'authenticated' : 'guest'
        },
        endpoints: {
            '/': 'Website homepage',
            '/login': 'Login page',
            '/dashboard': 'User dashboard (protected)',
            '/auth/google': 'Google OAuth login',
            '/auth/logout': 'Logout',
            '/api/health': 'Health check',
            '/api/admin/pricing': 'Pricing configuration'
        }
    });
});

// Handle requests to the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve other HTML pages
const pages = ['about', 'services', 'pricing-calculator', 'become-driver', 'contact', 'admin'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, '..', `${page}.html`));
    });
});

// 404 handler for missing pages


// Global error handler
app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    
    if (req.path.startsWith('/api/')) {
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ================================');
    console.log('🚀 MANYANZA AUTHENTICATION SERVER');
    console.log('🚀 ================================');
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`🌐 Website URL: http://localhost:${PORT}`);
    console.log(`🔐 Login URL: http://localhost:${PORT}/login`);
    console.log(`📊 Dashboard URL: http://localhost:${PORT}/dashboard`);
    console.log(`⚕️ Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log('');
    console.log('🔐 Authentication:');
    console.log(`   Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Session Secret: ${process.env.SESSION_SECRET ? '✅ Set' : '❌ Using default (INSECURE)'}`);
    console.log(`   Domain Restriction: ${process.env.ALLOWED_DOMAIN || 'None (open to all)'}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Configure Google OAuth credentials in .env file');
    console.log('2. Visit the website and test authentication');
    console.log('3. Check GOOGLE_OAUTH_SETUP.md for detailed setup instructions');
    console.log('🚀 ================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        database.close().then(() => {
            console.log('✅ Database connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        database.close().then(() => {
            console.log('✅ Database connection closed');
            process.exit(0);
        });
    });
});

// 404 handler for missing pages
app.get('*', (req, res, next) => {
    // If it's an API request, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'API endpoint not found',
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }
    
    // For other requests, serve 404 page or redirect to home
    res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

module.exports = app;