const DatabaseHelper = require('./databaseHelper');

class PermissionsService {
    constructor() {
        this.dbHelper = new DatabaseHelper();
        
        // Define all available permissions in the system
        this.PERMISSIONS = {
            // User Management
            'users.view': 'View user accounts',
            'users.create': 'Create new user accounts',
            'users.edit': 'Edit user accounts',
            'users.delete': 'Delete user accounts',
            'users.suspend': 'Suspend/unsuspend user accounts',
            
            // Driver Management
            'drivers.view': 'View driver profiles',
            'drivers.approve': 'Approve/reject driver applications',
            'drivers.edit': 'Edit driver profiles',
            'drivers.suspend': 'Suspend driver accounts',
            'drivers.vehicles.manage': 'Manage driver vehicles',
            'drivers.documents.verify': 'Verify driver documents',
            'drivers.ratings.view': 'View driver ratings',
            'drivers.payments.manage': 'Manage driver payments',
            
            // Client Management
            'clients.view': 'View client profiles',
            'clients.edit': 'Edit client profiles',
            'clients.credit.manage': 'Manage client credit limits',
            'clients.bookings.view': 'View client bookings',
            
            // Booking Management
            'bookings.view': 'View all bookings',
            'bookings.create': 'Create bookings on behalf of clients',
            'bookings.edit': 'Edit booking details',
            'bookings.assign': 'Assign drivers to bookings',
            'bookings.cancel': 'Cancel bookings',
            'bookings.timeline.edit': 'Edit booking timeline',
            'bookings.priority.change': 'Change booking priority',
            
            // Financial Management
            'finance.view': 'View financial reports',
            'finance.transactions.view': 'View transaction details',
            'finance.transactions.process': 'Process financial transactions',
            'finance.payments.verify': 'Verify payment proofs',
            'finance.refunds.process': 'Process refunds',
            'finance.commissions.adjust': 'Adjust platform commissions',
            'finance.reports.export': 'Export financial reports',
            
            // Pricing Management
            'pricing.view': 'View pricing configurations',
            'pricing.edit': 'Edit pricing configurations',
            'pricing.corridors.manage': 'Manage corridor pricing',
            'pricing.special.rates': 'Set special service rates',
            'pricing.commission.adjust': 'Adjust commission rates',
            
            // Communication & Notifications
            'communications.whatsapp.send': 'Send WhatsApp messages',
            'communications.notifications.send': 'Send system notifications',
            'communications.bulk.send': 'Send bulk communications',
            'communications.templates.manage': 'Manage message templates',
            
            // Reports & Analytics
            'reports.dashboard.view': 'View admin dashboard',
            'reports.analytics.view': 'View system analytics',
            'reports.bookings.export': 'Export booking reports',
            'reports.drivers.export': 'Export driver reports',
            'reports.financial.export': 'Export financial reports',
            'reports.performance.view': 'View performance metrics',
            
            // System Management
            'system.logs.view': 'View system logs',
            'system.audit.view': 'View audit logs',
            'system.config.edit': 'Edit system configuration',
            'system.maintenance.perform': 'Perform system maintenance',
            'system.backup.manage': 'Manage system backups',
            'system.security.manage': 'Manage security settings',
            
            // Admin Management
            'admin.users.create': 'Create admin users',
            'admin.users.edit': 'Edit admin users',
            'admin.users.delete': 'Delete admin users',
            'admin.permissions.manage': 'Manage admin permissions',
            'admin.roles.manage': 'Manage admin roles',
            'admin.sessions.manage': 'Manage admin sessions',
            
            // Emergency & Override
            'emergency.override': 'Emergency system override',
            'emergency.cancel_all': 'Emergency cancel all bookings',
            'emergency.driver_reassign': 'Emergency driver reassignment',
            'emergency.refund_all': 'Emergency refund processing'
        };

        // Define role templates with default permissions
        this.ROLE_TEMPLATES = {
            'super_admin': {
                name: 'Super Administrator',
                description: 'Full system access with all permissions',
                permissions: Object.keys(this.PERMISSIONS),
                cannot_be_modified: true
            },
            'operations_manager': {
                name: 'Operations Manager',
                description: 'Manages day-to-day operations, drivers, and bookings',
                permissions: [
                    'drivers.view', 'drivers.approve', 'drivers.edit', 'drivers.vehicles.manage',
                    'drivers.documents.verify', 'drivers.ratings.view',
                    'bookings.view', 'bookings.edit', 'bookings.assign', 'bookings.cancel',
                    'bookings.timeline.edit', 'bookings.priority.change',
                    'clients.view', 'clients.bookings.view',
                    'communications.whatsapp.send', 'communications.notifications.send',
                    'reports.dashboard.view', 'reports.analytics.view', 'reports.bookings.export',
                    'system.logs.view'
                ]
            },
            'finance_manager': {
                name: 'Finance Manager',
                description: 'Manages financial operations, payments, and pricing',
                permissions: [
                    'finance.view', 'finance.transactions.view', 'finance.transactions.process',
                    'finance.payments.verify', 'finance.refunds.process', 'finance.commissions.adjust',
                    'finance.reports.export',
                    'pricing.view', 'pricing.edit', 'pricing.corridors.manage', 'pricing.commission.adjust',
                    'drivers.payments.manage',
                    'clients.credit.manage',
                    'bookings.view',
                    'reports.dashboard.view', 'reports.financial.export'
                ]
            },
            'customer_service': {
                name: 'Customer Service Representative',
                description: 'Handles customer support and basic booking management',
                permissions: [
                    'clients.view', 'clients.bookings.view',
                    'drivers.view', 'drivers.ratings.view',
                    'bookings.view', 'bookings.create', 'bookings.edit',
                    'communications.whatsapp.send', 'communications.notifications.send',
                    'communications.templates.manage',
                    'reports.dashboard.view'
                ]
            },
            'technical_admin': {
                name: 'Technical Administrator',
                description: 'Manages system configuration and technical aspects',
                permissions: [
                    'system.logs.view', 'system.audit.view', 'system.config.edit',
                    'system.maintenance.perform', 'system.backup.manage', 'system.security.manage',
                    'users.view',
                    'reports.dashboard.view', 'reports.analytics.view',
                    'admin.sessions.manage'
                ]
            },
            'read_only_analyst': {
                name: 'Read-Only Analyst',
                description: 'View-only access for reporting and analysis',
                permissions: [
                    'users.view', 'drivers.view', 'drivers.ratings.view', 'clients.view',
                    'bookings.view', 'finance.view', 'pricing.view',
                    'reports.dashboard.view', 'reports.analytics.view', 'reports.bookings.export',
                    'reports.drivers.export', 'reports.financial.export', 'reports.performance.view'
                ]
            }
        };
    }

    // Check if user has specific permission
    async hasPermission(userId, permission) {
        try {
            const admin = await this.dbHelper.getAdminWithProfile(userId);
            if (!admin) return false;

            // Super admin has all permissions
            if (admin.admin_level === 'super') return true;

            // Check if permission is in user's permission array
            const permissions = admin.permissions || [];
            return permissions.includes(permission);
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    // Check if user has any of the specified permissions
    async hasAnyPermission(userId, permissionList) {
        try {
            const admin = await this.dbHelper.getAdminWithProfile(userId);
            if (!admin) return false;

            // Super admin has all permissions
            if (admin.admin_level === 'super') return true;

            const permissions = admin.permissions || [];
            return permissionList.some(permission => permissions.includes(permission));
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    // Check if user has all of the specified permissions
    async hasAllPermissions(userId, permissionList) {
        try {
            const admin = await this.dbHelper.getAdminWithProfile(userId);
            if (!admin) return false;

            // Super admin has all permissions
            if (admin.admin_level === 'super') return true;

            const permissions = admin.permissions || [];
            return permissionList.every(permission => permissions.includes(permission));
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    // Get all permissions for a user
    async getUserPermissions(userId) {
        try {
            const admin = await this.dbHelper.getAdminWithProfile(userId);
            if (!admin) return [];

            // Super admin has all permissions
            if (admin.admin_level === 'super') {
                return Object.keys(this.PERMISSIONS);
            }

            return admin.permissions || [];
        } catch (error) {
            console.error('Get user permissions error:', error);
            return [];
        }
    }

    // Update user permissions
    async updateUserPermissions(userId, permissions, updatedBy) {
        return new Promise((resolve, reject) => {
            // Validate permissions
            const invalidPermissions = permissions.filter(p => !this.PERMISSIONS[p]);
            if (invalidPermissions.length > 0) {
                return reject(new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`));
            }

            const query = `
                UPDATE admin_profiles 
                SET permissions = ?, updated_at = datetime('now')
                WHERE user_id = ?
            `;

            this.dbHelper.db.run(query, [JSON.stringify(permissions), userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Log the permission change
                    const auditQuery = `
                        INSERT INTO audit_logs (
                            user_id, action_type, resource_type, resource_id,
                            new_values, created_at
                        ) VALUES (?, 'permissions_update', 'admin_user', ?, ?, datetime('now'))
                    `;

                    this.dbHelper.db.run(auditQuery, [
                        updatedBy,
                        userId.toString(),
                        JSON.stringify({ permissions })
                    ]);

                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Apply role template to user
    async applyRoleTemplate(userId, roleTemplate, appliedBy) {
        const template = this.ROLE_TEMPLATES[roleTemplate];
        if (!template) {
            throw new Error(`Invalid role template: ${roleTemplate}`);
        }

        return this.updateUserPermissions(userId, template.permissions, appliedBy);
    }

    // Create permission middleware
    requirePermission(permission) {
        return async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            type: 'fail',
                            message: 'Authentication required',
                            code: 'AUTH_REQUIRED'
                        }
                    });
                }

                const hasPermission = await this.hasPermission(userId, permission);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        error: {
                            type: 'fail',
                            message: 'Insufficient permissions',
                            code: 'INSUFFICIENT_PERMISSIONS',
                            required_permission: permission
                        }
                    });
                }

                next();
            } catch (error) {
                console.error('Permission middleware error:', error);
                res.status(500).json({
                    success: false,
                    error: {
                        type: 'error',
                        message: 'Permission check failed',
                        code: 'PERMISSION_CHECK_ERROR'
                    }
                });
            }
        };
    }

    // Create middleware for multiple permissions (any)
    requireAnyPermission(permissions) {
        return async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            type: 'fail',
                            message: 'Authentication required',
                            code: 'AUTH_REQUIRED'
                        }
                    });
                }

                const hasPermission = await this.hasAnyPermission(userId, permissions);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        error: {
                            type: 'fail',
                            message: 'Insufficient permissions',
                            code: 'INSUFFICIENT_PERMISSIONS',
                            required_permissions_any: permissions
                        }
                    });
                }

                next();
            } catch (error) {
                console.error('Permission middleware error:', error);
                res.status(500).json({
                    success: false,
                    error: {
                        type: 'error',
                        message: 'Permission check failed',
                        code: 'PERMISSION_CHECK_ERROR'
                    }
                });
            }
        };
    }

    // Get all available permissions
    getAllPermissions() {
        return this.PERMISSIONS;
    }

    // Get all role templates
    getRoleTemplates() {
        return this.ROLE_TEMPLATES;
    }

    // Get permissions grouped by category
    getPermissionsByCategory() {
        const categories = {};
        
        Object.entries(this.PERMISSIONS).forEach(([key, description]) => {
            const category = key.split('.')[0];
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ key, description });
        });

        return categories;
    }

    // Validate permission list
    validatePermissions(permissions) {
        const invalid = permissions.filter(p => !this.PERMISSIONS[p]);
        return {
            valid: invalid.length === 0,
            invalidPermissions: invalid,
            validPermissions: permissions.filter(p => this.PERMISSIONS[p])
        };
    }

    // Generate permission summary for user
    async getPermissionSummary(userId) {
        try {
            const admin = await this.dbHelper.getAdminWithProfile(userId);
            if (!admin) {
                return { error: 'Admin profile not found' };
            }

            const userPermissions = admin.admin_level === 'super' 
                ? Object.keys(this.PERMISSIONS)
                : admin.permissions || [];

            const categorized = {};
            userPermissions.forEach(permission => {
                const category = permission.split('.')[0];
                if (!categorized[category]) {
                    categorized[category] = [];
                }
                categorized[category].push({
                    permission,
                    description: this.PERMISSIONS[permission]
                });
            });

            return {
                userId,
                adminLevel: admin.admin_level,
                totalPermissions: userPermissions.length,
                categorizedPermissions: categorized,
                isSuperAdmin: admin.admin_level === 'super'
            };
        } catch (error) {
            console.error('Permission summary error:', error);
            return { error: 'Failed to generate permission summary' };
        }
    }
}

module.exports = PermissionsService;