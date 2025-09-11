const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.dbPath = process.env.DATABASE_URL || './data/manyanza.db';
        this.ensureDataDirectory();
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Database connection error:', err);
            } else {
                console.log('Connected to SQLite database');
            }
        });
    }

    ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Enable foreign keys
                this.db.run("PRAGMA foreign_keys = ON");

                // User documents table (mainly for driver documents)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS user_documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        document_type TEXT NOT NULL CHECK(document_type IN ('nida', 'license', 'police_clearance', 'profile_photo', 'certificate')),
                        file_path TEXT NOT NULL,
                        file_name TEXT NOT NULL,
                        file_size INTEGER,
                        mime_type TEXT,
                        is_verified BOOLEAN DEFAULT 0,
                        verified_at DATETIME,
                        verified_by INTEGER,
                        expiry_date DATE,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (verified_by) REFERENCES users (id)
                    )
                `);

                // Bookings table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS bookings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        booking_id TEXT UNIQUE NOT NULL,
                        client_id INTEGER NOT NULL,
                        driver_id INTEGER,
                        pickup_location TEXT NOT NULL,
                        destination TEXT NOT NULL,
                        vehicle_type TEXT NOT NULL,
                        pickup_date DATE,
                        distance_km DECIMAL(8,2),
                        total_amount DECIMAL(10,2) NOT NULL,
                        estimated_cost DECIMAL(10,2),
                        final_cost DECIMAL(10,2),
                        upfront_payment DECIMAL(10,2),
                        remaining_payment DECIMAL(10,2),
                        platform_commission DECIMAL(10,2),
                        driver_payout DECIMAL(10,2),
                        payment_proof_url TEXT,
                        payment_notes TEXT,
                        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'pending_payment', 'payment_submitted', 'confirmed', 'assigned', 'in_transit', 'delivered', 'cancelled', 'completed')),
                        pickup_time TIME,
                        priority_level TEXT DEFAULT 'normal' CHECK(priority_level IN ('low', 'normal', 'high', 'urgent')),
                        special_instructions TEXT,
                        corridor_type TEXT, -- predefined or custom
                        per_diem_nights INTEGER DEFAULT 0,
                        return_allowance DECIMAL(10,2) DEFAULT 0.00,
                        waiting_hours DECIMAL(4,2) DEFAULT 0.00,
                        after_hours_service BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        confirmed_at DATETIME,
                        assigned_at DATETIME,
                        started_at DATETIME,
                        completed_at DATETIME,
                        cancelled_at DATETIME,
                        cancellation_reason TEXT,
                        FOREIGN KEY (client_id) REFERENCES users (id),
                        FOREIGN KEY (driver_id) REFERENCES users (id)
                    )
                `);

                // WhatsApp conversations table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        client_phone TEXT NOT NULL,
                        message_sid TEXT UNIQUE,
                        direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
                        message_body TEXT,
                        message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'document', 'location')),
                        media_url TEXT,
                        conversation_state TEXT DEFAULT 'idle' CHECK(conversation_state IN ('idle', 'collecting_pickup', 'collecting_destination', 'collecting_vehicle', 'collecting_documents', 'awaiting_payment', 'booking_confirmed')),
                        booking_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        processed_at DATETIME,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id)
                    )
                `);

                // Payment proofs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS payment_proofs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        booking_id INTEGER NOT NULL,
                        payment_method TEXT NOT NULL CHECK(payment_method IN ('mpesa', 'tigopesa', 'bank_transfer', 'cash')),
                        amount DECIMAL(10,2) NOT NULL,
                        transaction_reference TEXT,
                        proof_image_path TEXT,
                        verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected')),
                        verified_at DATETIME,
                        verified_by TEXT,
                        rejection_reason TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
                    )
                `);

                // Notifications table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        recipient_phone TEXT NOT NULL,
                        recipient_type TEXT NOT NULL CHECK(recipient_type IN ('client', 'driver', 'admin')),
                        notification_type TEXT NOT NULL CHECK(notification_type IN ('sms', 'whatsapp', 'email')),
                        message_body TEXT NOT NULL,
                        booking_id INTEGER,
                        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed')),
                        twilio_sid TEXT,
                        error_message TEXT,
                        sent_at DATETIME,
                        delivered_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id)
                    )
                `);

                // System logs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS system_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        log_level TEXT NOT NULL CHECK(log_level IN ('info', 'warning', 'error', 'critical')),
                        category TEXT NOT NULL,
                        message TEXT NOT NULL,
                        details TEXT, -- JSON for additional data
                        user_id INTEGER,
                        booking_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id),
                        FOREIGN KEY (booking_id) REFERENCES bookings (id)
                    )
                `);

                // Unified users table with role-based access
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE NOT NULL,
                        phone_number TEXT UNIQUE,
                        password_hash TEXT,
                        full_name TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client', 'driver', 'super_admin')),
                        
                        -- Common fields for all roles
                        profile_picture TEXT,
                        is_active BOOLEAN DEFAULT 1,
                        email_verified BOOLEAN DEFAULT 0,
                        phone_verified BOOLEAN DEFAULT 0,
                        
                        -- OAuth fields (for Google/social login)
                        google_id TEXT UNIQUE,
                        provider TEXT DEFAULT 'local', -- 'local', 'google', etc.
                        
                        -- Client-specific fields
                        whatsapp_number TEXT,
                        conversation_state TEXT DEFAULT 'idle',
                        booking_data TEXT, -- JSON for temporary booking data
                        current_booking_id TEXT,
                        total_bookings INTEGER DEFAULT 0,
                        total_spent DECIMAL(10,2) DEFAULT 0.00,
                        client_type TEXT DEFAULT 'individual' CHECK(client_type IN ('individual', 'business')),
                        company_name TEXT,
                        
                        -- Driver-specific fields
                        nida_number TEXT UNIQUE,
                        license_number TEXT UNIQUE,
                        license_expiry DATE,
                        experience_years INTEGER,
                        driver_status TEXT DEFAULT 'pending' CHECK(driver_status IN ('pending', 'approved', 'suspended', 'rejected')),
                        rating DECIMAL(3,2) DEFAULT 0.00,
                        total_trips INTEGER DEFAULT 0,
                        total_earnings DECIMAL(10,2) DEFAULT 0.00,
                        preferred_corridors TEXT, -- JSON array
                        emergency_contact_name TEXT,
                        emergency_contact_phone TEXT,
                        is_available BOOLEAN DEFAULT 1,
                        approved_at DATETIME,
                        approved_by INTEGER,
                        
                        -- Admin-specific fields
                        admin_level TEXT DEFAULT 'basic' CHECK(admin_level IN ('basic', 'advanced', 'super')),
                        permissions TEXT, -- JSON array of permissions
                        last_admin_action DATETIME,
                        
                        -- Timestamps and tracking
                        is_first_time BOOLEAN DEFAULT 1,
                        last_login_at DATETIME,
                        login_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        
                        FOREIGN KEY (approved_by) REFERENCES users (id)
                    )
                `);

                // Refresh tokens table for enhanced security
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        token_hash TEXT UNIQUE NOT NULL,
                        user_id INTEGER NOT NULL,
                        expires_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_used_at DATETIME,
                        is_revoked BOOLEAN DEFAULT 0,
                        device_info TEXT, -- JSON with device/browser info
                        ip_address TEXT,
                        user_agent TEXT,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `);

                // Audit logs table for tracking admin actions
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        action_type TEXT NOT NULL, -- 'login', 'price_update', 'user_approval', etc.
                        resource_type TEXT, -- 'user', 'pricing', 'booking', etc.
                        resource_id TEXT, -- ID of the affected resource
                        old_values TEXT, -- JSON of old values
                        new_values TEXT, -- JSON of new values
                        ip_address TEXT,
                        user_agent TEXT,
                        status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'pending')),
                        error_message TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `);

                // Login attempts table for brute force protection
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS login_attempts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        identifier TEXT NOT NULL, -- email or phone
                        ip_address TEXT NOT NULL,
                        attempt_type TEXT NOT NULL, -- 'password', 'otp', etc.
                        status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
                        user_agent TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // OTP codes table for 2FA/WhatsApp authentication
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS otp_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        phone_number TEXT NOT NULL,
                        otp_hash TEXT NOT NULL,
                        purpose TEXT NOT NULL DEFAULT 'authentication', -- 'authentication', 'registration', 'password_reset', etc.
                        user_id INTEGER,
                        expires_at DATETIME NOT NULL,
                        attempt_count INTEGER DEFAULT 0,
                        is_used BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        used_at DATETIME,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `);
                // Create indexes for better performance
                this.db.run("CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings (client_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON bookings (driver_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations (client_phone)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_state ON whatsapp_conversations (conversation_state)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_users_driver_status ON users (driver_status)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone_number)");
                
                // Security and audit indexes
                this.db.run("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts (ip_address)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts (created_at)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes (phone_number)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes (expires_at)");

                // Insert default super admin user (password: manyanza2025)
                this.db.run(`
                    INSERT OR IGNORE INTO users (email, password_hash, full_name, role, admin_level, is_active, phone_number)
                    VALUES ('admin@manyanza.co.tz', '$2a$10$rQ8K9yQ8x5P9zX2N5L1m1eR6S7tU8vW9a0B1c2D3e4F5g6H7i8J9k0', 'System Administrator', 'super_admin', 'super', 1, '+255765111131')
                `);

                console.log('✅ Database tables created successfully');
                resolve();
            });
        });
    }

    // Helper method to get database connection
    getConnection() {
        return this.db;
    }

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;