const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const NotificationService = require('../services/notificationService');
const RateLimitingService = require('../middleware/rateLimiting');
const PermissionsService = require('../services/permissionsService');
const DatabaseHelper = require('../services/databaseHelper');
const { 
    ErrorHandler, 
    ValidationError, 
    AuthenticationError, 
    AuthorizationError,
    NotFoundError 
} = require('../middleware/errorHandler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = new Database().getConnection();
const notificationService = new NotificationService();
const rateLimitingService = new RateLimitingService();
const permissionsService = new PermissionsService();
const dbHelper = new DatabaseHelper();
const errorHandler = new ErrorHandler();

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Get admin user
        db.get(
            'SELECT * FROM admin_users WHERE username = ? AND is_active = 1',
            [username],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
                
                // Update last login
                db.run(
                    'UPDATE admin_users SET last_login_at = datetime(\"now\") WHERE id = ?',
                    [user.id]
                );
                
                // Generate JWT token
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' }
                );
                
                res.json({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role
                    }
                });
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Dashboard overview
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const dashboardData = {};
        
        // Get booking statistics
        const bookingStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(estimated_cost) as total_value
                FROM bookings 
                WHERE created_at >= date('now', '-30 days')
                GROUP BY status
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get recent bookings
        const recentBookings = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    b.*,
                    uc.full_name as client_name,
                    uc.phone_number as client_phone,
                    ud.full_name as driver_name
                FROM bookings b
                LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
                LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
                ORDER BY b.created_at DESC
                LIMIT 10
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get driver statistics
        const driverStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    driver_status as status,
                    COUNT(*) as count
                FROM users
                WHERE role = 'driver'
                GROUP BY driver_status
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get pending actions
        const pendingActions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    'booking' as type,
                    id,
                    booking_id as reference,
                    'Payment verification needed' as action,
                    created_at
                FROM bookings 
                WHERE status = 'confirmed'
                
                UNION ALL
                
                SELECT 
                    'driver' as type,
                    id,
                    full_name as reference,
                    'Driver verification needed' as action,
                    created_at
                FROM users 
                WHERE role = 'driver' AND driver_status = 'pending'
                
                ORDER BY created_at DESC
                LIMIT 20
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json({
            success: true,
            data: {
                bookingStats,
                recentBookings,
                driverStats,
                pendingActions,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// Get all bookings with filters
router.get('/bookings', authenticateAdmin, async (req, res) => {
    try {
        const { status, startDate, endDate, clientPhone, driverId } = req.query;
        
        let query = `
            SELECT 
                b.*,
                uc.full_name as client_name,
                uc.phone_number as client_phone,
                uc.email as client_email,
                ud.full_name as driver_name,
                ud.phone_number as driver_phone
            FROM bookings b
            LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND b.status = ?';
            params.push(status);
        }
        
        if (startDate) {
            query += ' AND b.created_at >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND b.created_at <= ?';
            params.push(endDate + ' 23:59:59');
        }
        
        if (clientPhone) {
            query += ' AND uc.phone_number LIKE ?';
            params.push(`%${clientPhone}%`);
        }
        
        if (driverId) {
            query += ' AND b.driver_id = ?';
            params.push(driverId);
        }
        
        query += ' ORDER BY b.created_at DESC';
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Bookings query error:', err);
                return res.status(500).json({ error: 'Failed to fetch bookings' });
            }
            
            res.json({ success: true, bookings: rows });
        });
        
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Get single booking details
router.get('/bookings/:id', authenticateAdmin, async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        // Get booking with all related data
        db.get(`
            SELECT 
                b.*,
                uc.full_name as client_name,
                uc.phone_number as client_phone,
                uc.email as client_email,
                uc.company_name,
                ud.full_name as driver_name,
                ud.phone_number as driver_phone,
                ud.license_number,
                ud.rating as driver_rating
            FROM bookings b
            LEFT JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
            LEFT JOIN users ud ON b.driver_id = ud.id AND ud.role = 'driver'
            WHERE b.id = ?
        `, [bookingId], async (err, booking) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            
            // Get payment proofs
            const paymentProofs = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM payment_proofs 
                    WHERE booking_id = ?
                    ORDER BY created_at DESC
                `, [bookingId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            // Get conversation history
            const conversations = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM whatsapp_conversations 
                    WHERE booking_id = ?
                    ORDER BY created_at ASC
                `, [bookingId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            res.json({
                success: true,
                booking: {
                    ...booking,
                    paymentProofs,
                    conversations
                }
            });
        });
        
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Failed to fetch booking details' });
    }
});

// Assign driver to booking
router.post('/bookings/:id/assign-driver', authenticateAdmin, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { driverId } = req.body;
        
        if (!driverId) {
            return res.status(400).json({ error: 'Driver ID required' });
        }
        
        // Verify driver is available and approved
        db.get(`
            SELECT * FROM users 
            WHERE id = ? AND role = 'driver' AND driver_status = 'approved' AND is_available = 1
        `, [driverId], async (err, driver) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!driver) {
                return res.status(400).json({ error: 'Driver not available' });
            }
            
            // Update booking
            db.run(`
                UPDATE bookings 
                SET driver_id = ?, status = 'assigned', assigned_at = datetime('now')
                WHERE id = ? AND status = 'confirmed'
            `, [driverId, bookingId], async function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to assign driver' });
                }
                
                if (this.changes === 0) {
                    return res.status(400).json({ error: 'Booking not found or not in confirmed status' });
                }
                
                // Get booking details for notifications
                db.get(`
                    SELECT b.*, uc.phone_number as client_phone
                    FROM bookings b
                    JOIN users uc ON b.client_id = uc.id AND uc.role = 'client'
                    WHERE b.id = ?
                `, [bookingId], async (err, booking) => {
                    if (booking) {
                        // Send notifications
                        try {
                            // Notify driver
                            await notificationService.sendDriverAssignmentNotification(driver, booking);
                            
                            // Notify client
                            await notificationService.sendClientDriverAssignedNotification(booking, driver);
                            
                        } catch (notificationError) {
                            console.error('Notification error:', notificationError);
                        }
                    }
                });
                
                res.json({ 
                    success: true, 
                    message: 'Driver assigned successfully',
                    assignedAt: new Date().toISOString()
                });
            });
        });
        
    } catch (error) {
        console.error('Assign driver error:', error);
        res.status(500).json({ error: 'Failed to assign driver' });
    }
});

// Update booking status
router.patch('/bookings/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status, notes } = req.body;
        
        const allowedStatuses = ['confirmed', 'assigned', 'in_transit', 'delivered', 'completed', 'cancelled'];
        
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        // Update booking status
        db.run(`
            UPDATE bookings 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [status, bookingId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update status' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            
            // Log status change
            db.run(`
                INSERT INTO system_logs (log_level, category, message, details, user_id, booking_id)
                VALUES ('info', 'booking_status', 'Booking status updated', ?, ?, ?)
            `, [JSON.stringify({ oldStatus: 'unknown', newStatus: status, notes, updatedBy: req.user.username }), req.user.id, bookingId]);
            
            res.json({ 
                success: true, 
                message: 'Status updated successfully',
                newStatus: status
            });
        });
        
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

// Get available drivers
router.get('/drivers/available', authenticateAdmin, async (req, res) => {
    try {
        db.all(`
            SELECT 
                id,
                full_name,
                phone_number,
                experience_years,
                rating,
                total_trips,
                preferred_corridors
            FROM users 
            WHERE role = 'driver' AND driver_status = 'approved' AND is_available = 1
            ORDER BY rating DESC, total_trips DESC
        `, (err, drivers) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch drivers' });
            }
            
            res.json({ success: true, drivers });
        });
        
    } catch (error) {
        console.error('Get available drivers error:', error);
        res.status(500).json({ error: 'Failed to fetch available drivers' });
    }
});

// Verify payment proof
router.post('/payments/:id/verify', authenticateAdmin, async (req, res) => {
    try {
        const paymentId = req.params.id;
        const { isVerified, rejectionReason } = req.body;
        
        const status = isVerified ? 'verified' : 'rejected';
        
        db.run(`
            UPDATE payment_proofs 
            SET verification_status = ?, verified_at = datetime('now'), 
                verified_by = ?, rejection_reason = ?
            WHERE id = ?
        `, [status, req.user.username, rejectionReason || null, paymentId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update payment status' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Payment proof not found' });
            }
            
            res.json({ 
                success: true, 
                message: `Payment ${status} successfully`,
                verificationStatus: status
            });
        });
        
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// ===========================
// SECURITY MONITORING ROUTES
// ===========================

// Get security dashboard data
router.get('/security/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Get rate limiting statistics
        const rateLimitStats = await rateLimitingService.getRateLimitStats();
        
        // Get recent login attempts
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const loginAttempts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    status,
                    attempt_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT identifier) as unique_users,
                    COUNT(DISTINCT ip_address) as unique_ips
                FROM login_attempts 
                WHERE created_at >= ?
                GROUP BY status, attempt_type
                ORDER BY count DESC
            `, [last24Hours.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get top blocked IPs
        const blockedIPs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ip_address,
                    identifier,
                    COUNT(*) as failed_attempts,
                    MAX(created_at) as last_attempt
                FROM login_attempts 
                WHERE status = 'failed' AND created_at >= ?
                GROUP BY ip_address, identifier
                HAVING failed_attempts >= 3
                ORDER BY failed_attempts DESC, last_attempt DESC
                LIMIT 20
            `, [last24Hours.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get system logs summary
        const systemLogs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    log_level,
                    category,
                    COUNT(*) as count
                FROM system_logs 
                WHERE created_at >= ?
                GROUP BY log_level, category
                ORDER BY count DESC
            `, [last24Hours.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({
            success: true,
            data: {
                rateLimitStats,
                loginAttempts,
                blockedIPs,
                systemLogs,
                timeRange: '24h',
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Security dashboard error:', error);
        res.status(500).json({ error: 'Failed to load security dashboard' });
    }
});

// Get detailed login attempts log
router.get('/security/login-attempts', authenticateAdmin, async (req, res) => {
    try {
        const { limit = 50, status, ip, identifier } = req.query;
        
        let query = `
            SELECT 
                identifier,
                ip_address,
                attempt_type,
                status,
                user_agent,
                created_at
            FROM login_attempts
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        if (ip) {
            query += ' AND ip_address = ?';
            params.push(ip);
        }
        
        if (identifier) {
            query += ' AND identifier LIKE ?';
            params.push(`%${identifier}%`);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const attempts = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({
            success: true,
            attempts,
            total: attempts.length,
            filters: { status, ip, identifier, limit }
        });
    } catch (error) {
        console.error('Login attempts fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch login attempts' });
    }
});

// Manual rate limit reset for specific IP or user
router.post('/security/reset-limits', authenticateAdmin, async (req, res) => {
    try {
        const { type, value } = req.body; // type: 'ip' or 'user', value: IP address or user identifier
        
        if (!type || !value) {
            return res.status(400).json({ error: 'Type and value are required' });
        }
        
        if (type === 'user') {
            // Clear login attempts for specific user
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM login_attempts WHERE identifier = ?',
                    [value],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        } else if (type === 'ip') {
            // Clear login attempts for specific IP
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM login_attempts WHERE ip_address = ?',
                    [value],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        } else {
            return res.status(400).json({ error: 'Invalid type. Use "ip" or "user"' });
        }
        
        // Log admin action
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, new_values, ip_address, created_at)
                VALUES (?, 'security_reset', 'rate_limit', ?, ?, ?, datetime('now'))
            `, [
                req.user.id,
                value,
                JSON.stringify({ type, resetBy: req.user.username }),
                req.ip
            ], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({
            success: true,
            message: `Rate limits reset for ${type}: ${value}`,
            resetType: type,
            resetValue: value
        });
    } catch (error) {
        console.error('Rate limit reset error:', error);
        res.status(500).json({ error: 'Failed to reset rate limits' });
    }
});

// ===========================
// PERMISSION MANAGEMENT ROUTES
// ===========================

// Get all available permissions and role templates
router.get('/permissions/list', 
    authenticateAdmin,
    permissionsService.requirePermission('admin.permissions.manage'),
    errorHandler.asyncHandler(async (req, res) => {
        const permissions = permissionsService.getPermissionsByCategory();
        const roleTemplates = permissionsService.getRoleTemplates();
        
        errorHandler.sendSuccess(res, {
            permissions,
            roleTemplates,
            totalPermissions: Object.keys(permissionsService.getAllPermissions()).length
        }, 'Permissions retrieved successfully');
    })
);

// Get user's permission summary
router.get('/permissions/user/:userId',
    authenticateAdmin,
    permissionsService.requireAnyPermission(['admin.permissions.manage', 'admin.users.edit']),
    errorHandler.asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const summary = await permissionsService.getPermissionSummary(userId);
        
        if (summary.error) {
            throw new NotFoundError('Admin user');
        }
        
        errorHandler.sendSuccess(res, summary, 'Permission summary retrieved successfully');
    })
);

// Update user permissions
router.put('/permissions/user/:userId',
    authenticateAdmin,
    permissionsService.requirePermission('admin.permissions.manage'),
    errorHandler.asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { permissions } = req.body;
        
        if (!Array.isArray(permissions)) {
            throw new ValidationError('Permissions must be an array');
        }
        
        // Validate permissions
        const validation = permissionsService.validatePermissions(permissions);
        if (!validation.valid) {
            throw new ValidationError('Invalid permissions', {
                invalidPermissions: validation.invalidPermissions
            });
        }
        
        const updated = await permissionsService.updateUserPermissions(userId, permissions, req.user.id);
        
        if (!updated) {
            throw new NotFoundError('Admin user');
        }
        
        errorHandler.sendSuccess(res, {
            userId,
            updatedPermissions: permissions.length,
            updatedBy: req.user.id
        }, 'Permissions updated successfully');
    })
);

// Apply role template to user
router.post('/permissions/user/:userId/apply-role',
    authenticateAdmin,
    permissionsService.requirePermission('admin.permissions.manage'),
    errorHandler.asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { roleTemplate } = req.body;
        
        if (!roleTemplate) {
            throw new ValidationError('Role template is required');
        }
        
        try {
            const applied = await permissionsService.applyRoleTemplate(userId, roleTemplate, req.user.id);
            
            if (!applied) {
                throw new NotFoundError('Admin user');
            }
            
            const template = permissionsService.getRoleTemplates()[roleTemplate];
            
            errorHandler.sendSuccess(res, {
                userId,
                appliedRole: roleTemplate,
                roleName: template.name,
                permissionsCount: template.permissions.length,
                appliedBy: req.user.id
            }, `Role template '${template.name}' applied successfully`);
        } catch (error) {
            if (error.message.includes('Invalid role template')) {
                throw new ValidationError(error.message);
            }
            throw error;
        }
    })
);

// Get all admin users with their permissions
router.get('/users',
    authenticateAdmin,
    permissionsService.requireAnyPermission(['admin.users.view', 'users.view']),
    errorHandler.asyncHandler(async (req, res) => {
        const adminUsers = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.id, u.email, u.full_name, u.is_active, u.created_at, u.last_login_at,
                    ap.admin_level, ap.department, ap.permissions, ap.can_approve_drivers,
                    ap.can_modify_pricing, ap.can_handle_payments, ap.can_access_reports,
                    ap.can_manage_users, ap.can_system_config, ap.force_2fa
                FROM users u
                LEFT JOIN admin_profiles ap ON u.id = ap.user_id
                WHERE u.role = 'super_admin'
                ORDER BY u.created_at DESC
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else {
                    const users = rows.map(user => ({
                        ...user,
                        permissions: user.permissions ? JSON.parse(user.permissions) : [],
                        permissionCount: user.permissions ? JSON.parse(user.permissions).length : 0
                    }));
                    resolve(users);
                }
            });
        });
        
        errorHandler.sendSuccess(res, {
            adminUsers,
            totalUsers: adminUsers.length
        }, 'Admin users retrieved successfully');
    })
);

// Create new admin user
router.post('/users',
    authenticateAdmin,
    permissionsService.requirePermission('admin.users.create'),
    errorHandler.asyncHandler(async (req, res) => {
        const {
            email,
            password,
            full_name,
            admin_level = 'basic',
            department,
            roleTemplate,
            permissions = []
        } = req.body;
        
        if (!email || !password || !full_name) {
            throw new ValidationError('Email, password, and full name are required');
        }
        
        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existingUser) {
            throw new ConflictError('User with this email already exists', 'EMAIL_EXISTS');
        }
        
        // Create user
        const password_hash = await bcrypt.hash(password, 10);
        const userId = await new Promise((resolve, reject) => {
            const query = `
                INSERT INTO users (email, password_hash, full_name, role, is_active)
                VALUES (?, ?, ?, 'super_admin', 1)
            `;
            
            db.run(query, [email, password_hash, full_name], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        // Create admin profile
        const finalPermissions = roleTemplate 
            ? permissionsService.getRoleTemplates()[roleTemplate]?.permissions || []
            : permissions;
            
        await dbHelper.createAdminProfile(userId, {
            admin_level,
            department,
            permissions: finalPermissions,
            created_by: req.user.id
        });
        
        errorHandler.sendSuccess(res, {
            userId,
            email,
            full_name,
            admin_level,
            department,
            permissionsCount: finalPermissions.length,
            appliedRole: roleTemplate || null
        }, 'Admin user created successfully', 201);
    })
);

module.exports = router;