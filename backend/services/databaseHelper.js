const Database = require('../database/db');

class DatabaseHelper {
    constructor() {
        this.db = new Database().getConnection();
    }

    // ==================
    // CLIENT OPERATIONS
    // ==================

    async createClientProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            const {
                client_type = 'individual',
                company_name,
                business_registration,
                preferred_payment_method,
                whatsapp_number,
                emergency_contact_name,
                emergency_contact_phone,
                billing_address,
                notes
            } = profileData;

            const query = `
                INSERT INTO client_profiles (
                    user_id, client_type, company_name, business_registration,
                    preferred_payment_method, whatsapp_number, emergency_contact_name,
                    emergency_contact_phone, billing_address, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                userId, client_type, company_name, business_registration,
                preferred_payment_method, whatsapp_number, emergency_contact_name,
                emergency_contact_phone, billing_address, notes
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getClientWithProfile(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.*,
                    cp.client_type,
                    cp.company_name,
                    cp.business_registration,
                    cp.preferred_payment_method,
                    cp.credit_limit,
                    cp.payment_terms,
                    cp.whatsapp_number,
                    cp.conversation_state,
                    cp.total_bookings,
                    cp.total_spent,
                    cp.loyalty_points,
                    cp.preferred_corridors,
                    cp.emergency_contact_name,
                    cp.emergency_contact_phone,
                    cp.billing_address,
                    cp.notes as profile_notes
                FROM users u
                LEFT JOIN client_profiles cp ON u.id = cp.user_id
                WHERE u.id = ? AND u.role = 'client'
            `;

            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // ==================
    // DRIVER OPERATIONS
    // ==================

    async createDriverProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            const {
                nida_number,
                license_number,
                license_type,
                license_expiry,
                experience_years,
                preferred_corridors,
                specialized_services,
                vehicle_types,
                emergency_contact_name,
                emergency_contact_phone,
                bank_account_name,
                bank_account_number,
                bank_name,
                mobile_money_number
            } = profileData;

            const query = `
                INSERT INTO driver_profiles (
                    user_id, nida_number, license_number, license_type, license_expiry,
                    experience_years, preferred_corridors, specialized_services, vehicle_types,
                    emergency_contact_name, emergency_contact_phone, bank_account_name,
                    bank_account_number, bank_name, mobile_money_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                userId, nida_number, license_number, license_type, license_expiry,
                experience_years, JSON.stringify(preferred_corridors || []), 
                JSON.stringify(specialized_services || []), JSON.stringify(vehicle_types || []),
                emergency_contact_name, emergency_contact_phone, bank_account_name,
                bank_account_number, bank_name, mobile_money_number
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getDriverWithProfile(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.*,
                    dp.nida_number,
                    dp.license_number,
                    dp.license_type,
                    dp.license_expiry,
                    dp.experience_years,
                    dp.driver_status,
                    dp.approval_date,
                    dp.approved_by,
                    dp.rating,
                    dp.total_trips,
                    dp.total_earnings,
                    dp.commission_rate,
                    dp.preferred_corridors,
                    dp.specialized_services,
                    dp.vehicle_types,
                    dp.emergency_contact_name,
                    dp.emergency_contact_phone,
                    dp.bank_account_name,
                    dp.bank_account_number,
                    dp.bank_name,
                    dp.mobile_money_number,
                    dp.is_available,
                    dp.availability_schedule,
                    dp.location_latitude,
                    dp.location_longitude,
                    dp.location_updated_at,
                    dp.background_check_status,
                    dp.background_check_date,
                    dp.medical_certificate_expiry,
                    dp.insurance_expiry,
                    dp.notes as profile_notes
                FROM users u
                LEFT JOIN driver_profiles dp ON u.id = dp.user_id
                WHERE u.id = ? AND u.role = 'driver'
            `;

            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else {
                    if (row) {
                        // Parse JSON fields
                        try {
                            row.preferred_corridors = row.preferred_corridors ? JSON.parse(row.preferred_corridors) : [];
                            row.specialized_services = row.specialized_services ? JSON.parse(row.specialized_services) : [];
                            row.vehicle_types = row.vehicle_types ? JSON.parse(row.vehicle_types) : [];
                            row.availability_schedule = row.availability_schedule ? JSON.parse(row.availability_schedule) : {};
                        } catch (parseError) {
                            console.error('JSON parse error:', parseError);
                        }
                    }
                    resolve(row);
                }
            });
        });
    }

    async updateDriverStatus(driverId, status, approvedBy = null, reason = null) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE driver_profiles 
                SET driver_status = ?, 
                    approval_date = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approval_date END,
                    approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
                    suspension_reason = CASE WHEN ? IN ('suspended', 'rejected') THEN ? ELSE NULL END,
                    suspension_date = CASE WHEN ? = 'suspended' THEN datetime('now') ELSE NULL END,
                    updated_at = datetime('now')
                WHERE user_id = ?
            `;

            this.db.run(query, [status, status, status, approvedBy, status, reason, status, driverId], function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    }

    // ==================
    // ADMIN OPERATIONS
    // ==================

    async createAdminProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            const {
                admin_level = 'basic',
                department,
                permissions = [],
                can_approve_drivers = false,
                can_modify_pricing = false,
                can_handle_payments = false,
                can_access_reports = false,
                can_manage_users = false,
                can_system_config = false,
                ip_whitelist = [],
                session_timeout = 480,
                force_2fa = false,
                created_by
            } = profileData;

            const query = `
                INSERT INTO admin_profiles (
                    user_id, admin_level, department, permissions,
                    can_approve_drivers, can_modify_pricing, can_handle_payments,
                    can_access_reports, can_manage_users, can_system_config,
                    ip_whitelist, session_timeout, force_2fa, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                userId, admin_level, department, JSON.stringify(permissions),
                can_approve_drivers, can_modify_pricing, can_handle_payments,
                can_access_reports, can_manage_users, can_system_config,
                JSON.stringify(ip_whitelist), session_timeout, force_2fa, created_by
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getAdminWithProfile(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.*,
                    ap.admin_level,
                    ap.department,
                    ap.permissions,
                    ap.can_approve_drivers,
                    ap.can_modify_pricing,
                    ap.can_handle_payments,
                    ap.can_access_reports,
                    ap.can_manage_users,
                    ap.can_system_config,
                    ap.last_admin_action,
                    ap.ip_whitelist,
                    ap.session_timeout,
                    ap.force_2fa,
                    ap.created_by
                FROM users u
                LEFT JOIN admin_profiles ap ON u.id = ap.user_id
                WHERE u.id = ? AND u.role = 'super_admin'
            `;

            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else {
                    if (row) {
                        // Parse JSON fields
                        try {
                            row.permissions = row.permissions ? JSON.parse(row.permissions) : [];
                            row.ip_whitelist = row.ip_whitelist ? JSON.parse(row.ip_whitelist) : [];
                        } catch (parseError) {
                            console.error('JSON parse error:', parseError);
                        }
                    }
                    resolve(row);
                }
            });
        });
    }

    // ==================
    // VEHICLE OPERATIONS
    // ==================

    async addDriverVehicle(driverId, vehicleData) {
        return new Promise((resolve, reject) => {
            const {
                vehicle_type,
                make,
                model,
                year,
                license_plate,
                color,
                capacity_kg,
                capacity_passengers,
                fuel_type,
                insurance_company,
                insurance_policy_number,
                insurance_expiry,
                inspection_expiry,
                is_primary = false,
                special_features = []
            } = vehicleData;

            // If this is set as primary, remove primary status from other vehicles
            if (is_primary) {
                this.db.run(
                    'UPDATE driver_vehicles SET is_primary = 0 WHERE driver_id = ?',
                    [driverId]
                );
            }

            const query = `
                INSERT INTO driver_vehicles (
                    driver_id, vehicle_type, make, model, year, license_plate,
                    color, capacity_kg, capacity_passengers, fuel_type,
                    insurance_company, insurance_policy_number, insurance_expiry,
                    inspection_expiry, is_primary, special_features
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                driverId, vehicle_type, make, model, year, license_plate,
                color, capacity_kg, capacity_passengers, fuel_type,
                insurance_company, insurance_policy_number, insurance_expiry,
                inspection_expiry, is_primary, JSON.stringify(special_features)
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getDriverVehicles(driverId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM driver_vehicles 
                WHERE driver_id = ? AND is_active = 1
                ORDER BY is_primary DESC, created_at ASC
            `;

            this.db.all(query, [driverId], (err, rows) => {
                if (err) reject(err);
                else {
                    const vehicles = rows.map(vehicle => ({
                        ...vehicle,
                        special_features: vehicle.special_features ? JSON.parse(vehicle.special_features) : []
                    }));
                    resolve(vehicles);
                }
            });
        });
    }

    // ==================
    // PRICING OPERATIONS
    // ==================

    async getPricingConfig(corridorName) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM pricing_configs 
                WHERE corridor_name = ? AND is_active = 1 
                AND (effective_until IS NULL OR effective_until >= date('now'))
                ORDER BY effective_from DESC LIMIT 1
            `;

            this.db.get(query, [corridorName], (err, row) => {
                if (err) reject(err);
                else {
                    if (row) {
                        try {
                            row.vehicle_type_multipliers = row.vehicle_type_multipliers ? JSON.parse(row.vehicle_type_multipliers) : {};
                            row.special_service_rates = row.special_service_rates ? JSON.parse(row.special_service_rates) : {};
                        } catch (parseError) {
                            console.error('JSON parse error:', parseError);
                        }
                    }
                    resolve(row);
                }
            });
        });
    }

    async getAllActivePricingConfigs() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM pricing_configs 
                WHERE is_active = 1 
                AND (effective_until IS NULL OR effective_until >= date('now'))
                ORDER BY corridor_name ASC
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else {
                    const configs = rows.map(config => {
                        try {
                            config.vehicle_type_multipliers = config.vehicle_type_multipliers ? JSON.parse(config.vehicle_type_multipliers) : {};
                            config.special_service_rates = config.special_service_rates ? JSON.parse(config.special_service_rates) : {};
                        } catch (parseError) {
                            console.error('JSON parse error:', parseError);
                        }
                        return config;
                    });
                    resolve(configs);
                }
            });
        });
    }

    // ==================
    // BOOKING OPERATIONS
    // ==================

    async addBookingTimelineEntry(bookingId, statusFrom, statusTo, changedBy, reason, notes, location) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO booking_timeline (
                    booking_id, status_from, status_to, changed_by, change_reason,
                    notes, location_latitude, location_longitude
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                bookingId, statusFrom, statusTo, changedBy, reason, notes,
                location?.latitude || null, location?.longitude || null
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getBookingTimeline(bookingId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    bt.*,
                    u.full_name as changed_by_name,
                    u.role as changed_by_role
                FROM booking_timeline bt
                LEFT JOIN users u ON bt.changed_by = u.id
                WHERE bt.booking_id = ?
                ORDER BY bt.created_at ASC
            `;

            this.db.all(query, [bookingId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // ==================
    // FINANCIAL OPERATIONS
    // ==================

    async recordFinancialTransaction(transactionData) {
        return new Promise((resolve, reject) => {
            const {
                booking_id,
                transaction_type,
                amount,
                currency = 'TZS',
                payment_method,
                transaction_reference,
                external_reference,
                from_account,
                to_account,
                fees = 0,
                notes,
                metadata = {}
            } = transactionData;

            const query = `
                INSERT INTO financial_transactions (
                    booking_id, transaction_type, amount, currency, payment_method,
                    transaction_reference, external_reference, from_account, to_account,
                    fees, notes, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                booking_id, transaction_type, amount, currency, payment_method,
                transaction_reference, external_reference, from_account, to_account,
                fees, notes, JSON.stringify(metadata)
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getBookingFinancialTransactions(bookingId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ft.*,
                    u.full_name as processed_by_name
                FROM financial_transactions ft
                LEFT JOIN users u ON ft.processed_by = u.id
                WHERE ft.booking_id = ?
                ORDER BY ft.created_at ASC
            `;

            this.db.all(query, [bookingId], (err, rows) => {
                if (err) reject(err);
                else {
                    const transactions = rows.map(transaction => ({
                        ...transaction,
                        metadata: transaction.metadata ? JSON.parse(transaction.metadata) : {}
                    }));
                    resolve(transactions);
                }
            });
        });
    }

    // ==================
    // ANALYTICS OPERATIONS
    // ==================

    async getDashboardStats() {
        return new Promise((resolve, reject) => {
            const queries = {
                totalUsers: "SELECT COUNT(*) as count FROM users WHERE is_active = 1",
                totalClients: "SELECT COUNT(*) as count FROM users WHERE role = 'client' AND is_active = 1",
                totalDrivers: "SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active = 1",
                pendingDrivers: "SELECT COUNT(*) as count FROM driver_profiles WHERE driver_status = 'pending'",
                activeBookings: "SELECT COUNT(*) as count FROM bookings WHERE status IN ('confirmed', 'assigned', 'in_transit')",
                totalBookings: "SELECT COUNT(*) as count FROM bookings",
                totalRevenue: "SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE status = 'completed'"
            };

            const stats = {};
            let completed = 0;
            const total = Object.keys(queries).length;

            Object.entries(queries).forEach(([key, query]) => {
                this.db.get(query, [], (err, row) => {
                    if (err) {
                        stats[key] = { error: err.message };
                    } else {
                        stats[key] = row.count !== undefined ? row.count : row.total || 0;
                    }
                    
                    completed++;
                    if (completed === total) {
                        resolve(stats);
                    }
                });
            });
        });
    }
}

module.exports = DatabaseHelper;