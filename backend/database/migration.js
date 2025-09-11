const Database = require('./db');
const fs = require('fs');
const path = require('path');

class DatabaseMigration {
    constructor() {
        this.db = new Database().getConnection();
        this.migrationsPath = path.join(__dirname, 'migrations');
        this.ensureMigrationsDirectory();
    }

    ensureMigrationsDirectory() {
        if (!fs.existsSync(this.migrationsPath)) {
            fs.mkdirSync(this.migrationsPath, { recursive: true });
        }
    }

    // Create role-specific tables for better data organization
    async createRoleSpecificTables() {
        console.log('🔄 Creating role-specific database architecture...');
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Client profiles table (separate from users for better normalization)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS client_profiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        client_type TEXT DEFAULT 'individual' CHECK(client_type IN ('individual', 'business')),
                        company_name TEXT,
                        business_registration TEXT,
                        preferred_payment_method TEXT CHECK(preferred_payment_method IN ('mpesa', 'tigopesa', 'bank_transfer', 'cash')),
                        credit_limit DECIMAL(10,2) DEFAULT 0.00,
                        payment_terms TEXT DEFAULT 'immediate', -- 'immediate', 'net_7', 'net_30'
                        whatsapp_number TEXT,
                        conversation_state TEXT DEFAULT 'idle',
                        booking_data TEXT, -- JSON for temporary booking data
                        current_booking_id TEXT,
                        total_bookings INTEGER DEFAULT 0,
                        total_spent DECIMAL(10,2) DEFAULT 0.00,
                        loyalty_points INTEGER DEFAULT 0,
                        preferred_corridors TEXT, -- JSON array
                        emergency_contact_name TEXT,
                        emergency_contact_phone TEXT,
                        billing_address TEXT,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `);

                // Driver profiles table (separate from users)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS driver_profiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        nida_number TEXT UNIQUE,
                        license_number TEXT UNIQUE,
                        license_type TEXT CHECK(license_type IN ('class_a', 'class_b', 'class_c', 'class_d')),
                        license_expiry DATE,
                        experience_years INTEGER,
                        driver_status TEXT DEFAULT 'pending' CHECK(driver_status IN ('pending', 'approved', 'suspended', 'rejected', 'inactive')),
                        approval_date DATETIME,
                        approved_by INTEGER,
                        suspension_reason TEXT,
                        suspension_date DATETIME,
                        suspension_expires DATETIME,
                        rating DECIMAL(3,2) DEFAULT 0.00,
                        total_trips INTEGER DEFAULT 0,
                        total_earnings DECIMAL(10,2) DEFAULT 0.00,
                        commission_rate DECIMAL(5,4) DEFAULT 0.18, -- Individual commission rate
                        preferred_corridors TEXT, -- JSON array
                        specialized_services TEXT, -- JSON array: ['refrigerated', 'fragile', 'hazardous', 'livestock']
                        vehicle_types TEXT, -- JSON array: ['pickup', 'truck', 'trailer', 'bus']
                        emergency_contact_name TEXT,
                        emergency_contact_phone TEXT,
                        bank_account_name TEXT,
                        bank_account_number TEXT,
                        bank_name TEXT,
                        mobile_money_number TEXT,
                        is_available BOOLEAN DEFAULT 1,
                        availability_schedule TEXT, -- JSON with weekly schedule
                        location_latitude DECIMAL(10,8),
                        location_longitude DECIMAL(11,8),
                        location_updated_at DATETIME,
                        background_check_status TEXT DEFAULT 'pending' CHECK(background_check_status IN ('pending', 'approved', 'rejected')),
                        background_check_date DATETIME,
                        medical_certificate_expiry DATE,
                        insurance_expiry DATE,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (approved_by) REFERENCES users (id)
                    )
                `);

                // Admin profiles table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS admin_profiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        admin_level TEXT DEFAULT 'basic' CHECK(admin_level IN ('basic', 'advanced', 'super')),
                        department TEXT CHECK(department IN ('operations', 'finance', 'customer_service', 'technical', 'management')),
                        permissions TEXT, -- JSON array of specific permissions
                        can_approve_drivers BOOLEAN DEFAULT 0,
                        can_modify_pricing BOOLEAN DEFAULT 0,
                        can_handle_payments BOOLEAN DEFAULT 0,
                        can_access_reports BOOLEAN DEFAULT 0,
                        can_manage_users BOOLEAN DEFAULT 0,
                        can_system_config BOOLEAN DEFAULT 0,
                        last_admin_action DATETIME,
                        ip_whitelist TEXT, -- JSON array of allowed IP addresses
                        session_timeout INTEGER DEFAULT 480, -- minutes (8 hours)
                        force_2fa BOOLEAN DEFAULT 0,
                        created_by INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (created_by) REFERENCES users (id)
                    )
                `);

                // Driver vehicles table (one driver can have multiple vehicles)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS driver_vehicles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        driver_id INTEGER NOT NULL,
                        vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('pickup', 'truck', 'trailer', 'bus', 'van', 'motorcycle')),
                        make TEXT NOT NULL,
                        model TEXT NOT NULL,
                        year INTEGER,
                        license_plate TEXT UNIQUE NOT NULL,
                        color TEXT,
                        capacity_kg DECIMAL(8,2),
                        capacity_passengers INTEGER,
                        fuel_type TEXT CHECK(fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric')),
                        insurance_company TEXT,
                        insurance_policy_number TEXT,
                        insurance_expiry DATE,
                        inspection_expiry DATE,
                        is_active BOOLEAN DEFAULT 1,
                        is_primary BOOLEAN DEFAULT 0, -- Primary vehicle for the driver
                        special_features TEXT, -- JSON array: ['gps', 'air_conditioning', 'refrigeration', 'crane']
                        documents_verified BOOLEAN DEFAULT 0,
                        verified_at DATETIME,
                        verified_by INTEGER,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (verified_by) REFERENCES users (id)
                    )
                `);

                // Driver ratings and reviews table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS driver_ratings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        booking_id INTEGER NOT NULL,
                        driver_id INTEGER NOT NULL,
                        client_id INTEGER NOT NULL,
                        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                        review_text TEXT,
                        categories TEXT, -- JSON: {'punctuality': 5, 'professionalism': 4, 'vehicle_condition': 5}
                        would_recommend BOOLEAN,
                        is_anonymous BOOLEAN DEFAULT 0,
                        admin_notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
                        FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `);

                // Pricing configurations table (for different corridors and services)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS pricing_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        corridor_name TEXT NOT NULL,
                        corridor_type TEXT CHECK(corridor_type IN ('predefined', 'custom')),
                        rate_per_km DECIMAL(8,2) NOT NULL,
                        per_diem_rate DECIMAL(8,2) NOT NULL,
                        return_allowance DECIMAL(8,2) DEFAULT 0.00,
                        waiting_fee_per_hour DECIMAL(8,2) DEFAULT 0.00,
                        free_waiting_hours INTEGER DEFAULT 2,
                        after_hours_surcharge DECIMAL(5,4) DEFAULT 0.25, -- 25% surcharge
                        weekend_surcharge DECIMAL(5,4) DEFAULT 0.15, -- 15% surcharge
                        platform_commission DECIMAL(5,4) DEFAULT 0.18, -- 18% commission
                        minimum_charge DECIMAL(8,2) DEFAULT 0.00,
                        vehicle_type_multipliers TEXT, -- JSON: {'truck': 1.2, 'trailer': 1.5}
                        special_service_rates TEXT, -- JSON: {'refrigerated': 0.25, 'fragile': 0.15}
                        is_active BOOLEAN DEFAULT 1,
                        effective_from DATE,
                        effective_until DATE,
                        created_by INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (created_by) REFERENCES users (id)
                    )
                `);

                // Booking timeline table (track booking status changes)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS booking_timeline (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        booking_id INTEGER NOT NULL,
                        status_from TEXT,
                        status_to TEXT NOT NULL,
                        changed_by INTEGER,
                        change_reason TEXT,
                        notes TEXT,
                        location_latitude DECIMAL(10,8),
                        location_longitude DECIMAL(11,8),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
                        FOREIGN KEY (changed_by) REFERENCES users (id)
                    )
                `);

                // Financial transactions table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS financial_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        booking_id INTEGER NOT NULL,
                        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('payment_in', 'commission', 'driver_payout', 'refund', 'penalty')),
                        amount DECIMAL(10,2) NOT NULL,
                        currency TEXT DEFAULT 'TZS',
                        payment_method TEXT CHECK(payment_method IN ('mpesa', 'tigopesa', 'bank_transfer', 'cash', 'credit')),
                        transaction_reference TEXT,
                        external_reference TEXT, -- Bank/Mobile money reference
                        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
                        processed_by INTEGER,
                        processed_at DATETIME,
                        from_account TEXT, -- Client account or system
                        to_account TEXT, -- Driver account or system
                        fees DECIMAL(10,2) DEFAULT 0.00,
                        notes TEXT,
                        metadata TEXT, -- JSON for additional transaction data
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
                        FOREIGN KEY (processed_by) REFERENCES users (id)
                    )
                `);

                // Create indexes for the new tables
                this.db.run("CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles (user_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_client_profiles_client_type ON client_profiles (client_type)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles (user_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles (driver_status)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_profiles_availability ON driver_profiles (is_available)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_profiles_location ON driver_profiles (location_latitude, location_longitude)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles (user_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_admin_profiles_level ON admin_profiles (admin_level)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON driver_vehicles (driver_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_vehicles_active ON driver_vehicles (is_active)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_vehicles_plate ON driver_vehicles (license_plate)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings (driver_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_driver_ratings_booking_id ON driver_ratings (booking_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_pricing_configs_corridor ON pricing_configs (corridor_name)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_pricing_configs_active ON pricing_configs (is_active)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_booking_timeline_booking_id ON booking_timeline (booking_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_booking_timeline_created_at ON booking_timeline (created_at)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_financial_transactions_booking_id ON financial_transactions (booking_id)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions (transaction_type)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions (status)");
                this.db.run("CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions (created_at)");

                console.log('✅ Role-specific tables created successfully');
                resolve();
            });
        });
    }

    // Insert default pricing configurations
    async insertDefaultPricingConfigs() {
        return new Promise((resolve, reject) => {
            const defaultConfigs = [
                {
                    corridor_name: 'Dar es Salaam - Tunduma',
                    rate_per_km: 1500,
                    per_diem_rate: 50000,
                    return_allowance: 65000,
                    corridor_type: 'predefined'
                },
                {
                    corridor_name: 'Dar es Salaam - Rusumo',
                    rate_per_km: 1500,
                    per_diem_rate: 50000,
                    return_allowance: 90000,
                    corridor_type: 'predefined'
                },
                {
                    corridor_name: 'Dar es Salaam - Mutukula',
                    rate_per_km: 1500,
                    per_diem_rate: 50000,
                    return_allowance: 95000,
                    corridor_type: 'predefined'
                },
                {
                    corridor_name: 'Dar es Salaam - Kabanga/Kobero',
                    rate_per_km: 1500,
                    per_diem_rate: 50000,
                    return_allowance: 85000,
                    corridor_type: 'predefined'
                },
                {
                    corridor_name: 'Dar es Salaam - Kasumulu',
                    rate_per_km: 1500,
                    per_diem_rate: 50000,
                    return_allowance: 70000,
                    corridor_type: 'predefined'
                }
            ];

            let completed = 0;
            const total = defaultConfigs.length;

            defaultConfigs.forEach(config => {
                this.db.run(`
                    INSERT OR IGNORE INTO pricing_configs 
                    (corridor_name, corridor_type, rate_per_km, per_diem_rate, return_allowance, 
                     waiting_fee_per_hour, platform_commission, is_active, effective_from)
                    VALUES (?, ?, ?, ?, ?, 15000, 0.18, 1, date('now'))
                `, [
                    config.corridor_name,
                    config.corridor_type,
                    config.rate_per_km,
                    config.per_diem_rate,
                    config.return_allowance
                ], (err) => {
                    if (err) {
                        console.error('Error inserting pricing config:', err);
                    }
                    completed++;
                    if (completed === total) {
                        console.log('✅ Default pricing configurations inserted');
                        resolve();
                    }
                });
            });
        });
    }

    // Run all database improvements
    async runMigration() {
        try {
            console.log('🚀 Starting database architecture improvements...');
            
            await this.createRoleSpecificTables();
            await this.insertDefaultPricingConfigs();
            
            console.log('🎉 Database architecture improvements completed successfully!');
            return {
                success: true,
                message: 'Database architecture improved with role-specific tables',
                features: [
                    'Separate profile tables for each role (client, driver, admin)',
                    'Driver vehicles and ratings management',
                    'Flexible pricing configuration system',
                    'Comprehensive booking timeline tracking',
                    'Financial transactions management',
                    'Enhanced indexing for better performance'
                ]
            };
        } catch (error) {
            console.error('❌ Database migration failed:', error);
            throw error;
        }
    }

    // Check migration status
    async getMigrationStatus() {
        return new Promise((resolve, reject) => {
            const tables = [
                'client_profiles',
                'driver_profiles', 
                'admin_profiles',
                'driver_vehicles',
                'driver_ratings',
                'pricing_configs',
                'booking_timeline',
                'financial_transactions'
            ];

            let checkedTables = 0;
            const tableStatus = {};

            tables.forEach(tableName => {
                this.db.get(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [tableName],
                    (err, row) => {
                        if (err) {
                            tableStatus[tableName] = { exists: false, error: err.message };
                        } else {
                            tableStatus[tableName] = { exists: !!row };
                        }
                        
                        checkedTables++;
                        if (checkedTables === tables.length) {
                            const allTablesExist = Object.values(tableStatus).every(status => status.exists);
                            resolve({
                                migrationComplete: allTablesExist,
                                tableStatus,
                                totalTables: tables.length,
                                existingTables: Object.values(tableStatus).filter(status => status.exists).length
                            });
                        }
                    }
                );
            });
        });
    }
}

module.exports = DatabaseMigration;