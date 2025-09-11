const Database = require('../database/db');

// Custom error classes for different types of errors
class AppError extends Error {
    constructor(message, statusCode, code = null, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed', code = 'AUTH_FAILED') {
        super(message, 401, code);
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied', code = 'ACCESS_DENIED') {
        super(message, 403, code);
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict', code = 'CONFLICT') {
        super(message, 409, code);
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests', retryAfter = null) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
        this.retryAfter = retryAfter;
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

class ExternalServiceError extends AppError {
    constructor(service = 'External service', message = 'Service unavailable') {
        super(`${service}: ${message}`, 503, 'EXTERNAL_SERVICE_ERROR');
    }
}

// Error handler middleware
class ErrorHandler {
    constructor() {
        this.db = new Database().getConnection();
    }

    // Main error handling middleware
    handleError = (err, req, res, next) => {
        let error = { ...err };
        error.message = err.message;

        // Log error for monitoring
        this.logError(err, req);

        // Handle specific error types
        if (err.name === 'CastError') {
            error = new ValidationError('Invalid ID format');
        }

        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(val => val.message).join(', ');
            error = new ValidationError(message);
        }

        if (err.code === 'SQLITE_CONSTRAINT') {
            error = this.handleSQLiteConstraintError(err);
        }

        if (err.name === 'JsonWebTokenError') {
            error = new AuthenticationError('Invalid token', 'INVALID_TOKEN');
        }

        if (err.name === 'TokenExpiredError') {
            error = new AuthenticationError('Token expired', 'TOKEN_EXPIRED');
        }

        if (err.name === 'MulterError') {
            error = this.handleMulterError(err);
        }

        // Send error response
        this.sendErrorResponse(error, res);
    };

    // Handle SQLite constraint errors
    handleSQLiteConstraintError(err) {
        const message = err.message;
        
        if (message.includes('UNIQUE constraint failed: users.email')) {
            return new ConflictError('Email already registered', 'EMAIL_EXISTS');
        }
        
        if (message.includes('UNIQUE constraint failed: users.phone_number')) {
            return new ConflictError('Phone number already registered', 'PHONE_EXISTS');
        }
        
        if (message.includes('UNIQUE constraint failed: users.nida_number')) {
            return new ConflictError('NIDA number already registered', 'NIDA_EXISTS');
        }
        
        if (message.includes('UNIQUE constraint failed: users.license_number')) {
            return new ConflictError('License number already registered', 'LICENSE_EXISTS');
        }
        
        if (message.includes('FOREIGN KEY constraint failed')) {
            return new ValidationError('Referenced resource does not exist', 'FOREIGN_KEY_ERROR');
        }
        
        return new DatabaseError('Database constraint violation');
    }

    // Handle file upload errors
    handleMulterError(err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return new ValidationError('File too large', 'FILE_TOO_LARGE');
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
            return new ValidationError('Too many files', 'TOO_MANY_FILES');
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return new ValidationError('Unexpected file field', 'UNEXPECTED_FILE');
        }
        
        return new ValidationError('File upload error', 'UPLOAD_ERROR');
    }

    // Send standardized error response
    sendErrorResponse(error, res) {
        const statusCode = error.statusCode || 500;
        const response = {
            success: false,
            error: {
                type: error.status || 'error',
                message: error.message || 'Internal server error',
                code: error.code || 'INTERNAL_ERROR'
            },
            timestamp: new Date().toISOString(),
            ...(error.details && { details: error.details }),
            ...(error.retryAfter && { retryAfter: error.retryAfter })
        };

        // Add stack trace in development
        if (process.env.NODE_ENV === 'development') {
            response.error.stack = error.stack;
        }

        // Add request ID for tracking
        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }

        res.status(statusCode).json(response);
    }

    // Log errors for monitoring and debugging
    async logError(error, req = null) {
        try {
            const errorLog = {
                level: 'error',
                message: error.message || 'Unknown error',
                stack: error.stack,
                statusCode: error.statusCode || 500,
                code: error.code || 'UNKNOWN_ERROR',
                timestamp: new Date().toISOString(),
                ...(req && {
                    method: req.method,
                    url: req.originalUrl,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    userId: req.user?.id,
                    body: this.sanitizeRequestBody(req.body)
                })
            };

            // Log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.error('🔥 Error occurred:', errorLog);
            }

            // Store in database for production monitoring
            await this.storeErrorLog(errorLog);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }

    // Store error in database
    async storeErrorLog(errorLog) {
        return new Promise((resolve) => {
            const query = `
                INSERT INTO system_logs (
                    log_level, category, message, details, user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `;
            
            this.db.run(query, [
                'error',
                'application_error',
                errorLog.message,
                JSON.stringify(errorLog),
                errorLog.userId || null
            ], (err) => {
                if (err) {
                    console.error('Failed to store error log in database:', err);
                }
                resolve();
            });
        });
    }

    // Sanitize request body for logging (remove sensitive data)
    sanitizeRequestBody(body) {
        if (!body) return null;
        
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'password_hash', 'token', 'refresh_token', 'otp', 'secret'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    // Handle async errors in routes
    asyncHandler = (fn) => {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    };

    // Validation middleware for request validation
    validateRequest = (validations) => {
        return async (req, res, next) => {
            try {
                await Promise.all(validations.map(validation => validation.run(req)));
                
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    const errorDetails = errors.array().map(error => ({
                        field: error.param,
                        message: error.msg,
                        value: error.value
                    }));
                    
                    throw new ValidationError('Validation failed', errorDetails);
                }
                
                next();
            } catch (error) {
                next(error);
            }
        };
    };

    // Success response helper
    sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== null) {
            response.data = data;
        }

        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }

        res.status(statusCode).json(response);
    };

    // Pagination helper
    sendPaginatedResponse = (res, data, pagination, message = 'Success') => {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 10,
                total: pagination.total || 0,
                pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10))
            },
            timestamp: new Date().toISOString()
        };

        if (res.locals.requestId) {
            response.requestId = res.locals.requestId;
        }

        res.json(response);
    };
}

// Middleware to add request ID for tracking
const addRequestId = (req, res, next) => {
    res.locals.requestId = require('crypto').randomUUID();
    next();
};

// 404 handler for unmatched routes
const handleNotFound = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl}`);
    next(error);
};

module.exports = {
    ErrorHandler,
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    addRequestId,
    handleNotFound
};