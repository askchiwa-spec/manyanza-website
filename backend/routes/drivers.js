const express = require('express');
const router = express.Router();
const Database = require('../database/db');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const db = new Database().getConnection();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = './uploads/drivers/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
        }
    }
});

// Register new driver
router.post('/register', upload.fields([
    { name: 'nida', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'policeClearance', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            nidaNumber,
            fullName,
            phoneNumber,
            email,
            dateOfBirth,
            address,
            licenseNumber,
            licenseExpiry,
            experienceYears,
            preferredCorridors,
            emergencyContactName,
            emergencyContactPhone
        } = req.body;

        // Validate required fields
        const requiredFields = {
            nidaNumber, fullName, phoneNumber, licenseNumber, licenseExpiry, experienceYears
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value) {
                return res.status(400).json({
                    error: `Missing required field: ${field}`
                });
            }
        }

        // Check if driver already exists
        const existingDriver = await checkDriverExists(nidaNumber, phoneNumber, licenseNumber);
        if (existingDriver) {
            return res.status(409).json({
                error: 'Driver already registered',
                field: existingDriver.field
            });
        }

        // Create driver record
        const driverId = await createDriver({
            nidaNumber,
            fullName,
            phoneNumber,
            email,
            dateOfBirth,
            address,
            licenseNumber,
            licenseExpiry,
            experienceYears,
            preferredCorridors: JSON.stringify(preferredCorridors || []),
            emergencyContactName,
            emergencyContactPhone
        });

        // Process uploaded documents
        if (req.files) {
            await processDriverDocuments(driverId, req.files);
        }

        res.status(201).json({
            success: true,
            message: 'Driver registration submitted successfully',
            driverId,
            status: 'pending',
            nextSteps: [
                'Documents will be verified within 48 hours',
                'You will receive SMS/WhatsApp updates',
                'Background check will be conducted',
                'Approval notification will be sent'
            ]
        });

    } catch (error) {
        console.error('Driver registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get driver profile
router.get('/:id', async (req, res) => {
    try {
        const driverId = req.params.id;

        db.get(`
            SELECT 
                u.*,
                GROUP_CONCAT(dd.document_type) as uploaded_documents
            FROM users u
            LEFT JOIN user_documents dd ON u.id = dd.user_id
            WHERE u.id = ? AND u.role = 'driver'
            GROUP BY u.id
        `, [driverId], (err, driver) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!driver) {
                return res.status(404).json({ error: 'Driver not found' });
            }

            // Parse preferred corridors
            try {
                driver.preferred_corridors = JSON.parse(driver.preferred_corridors || '[]');
            } catch (e) {
                driver.preferred_corridors = [];
            }

            // Parse uploaded documents
            driver.uploaded_documents = driver.uploaded_documents ? driver.uploaded_documents.split(',') : [];

            res.json({ success: true, driver });
        });

    } catch (error) {
        console.error('Get driver error:', error);
        res.status(500).json({ error: 'Failed to fetch driver' });
    }
});

// Get all drivers (admin only)
router.get('/', async (req, res) => {
    try {
        const { status, experience, corridor } = req.query;

        let query = `
            SELECT 
                u.*,
                COUNT(dd.id) as document_count,
                GROUP_CONCAT(dd.document_type) as uploaded_documents
            FROM users u
            LEFT JOIN user_documents dd ON u.id = dd.user_id
            WHERE u.role = 'driver'
        `;

        const params = [];

        if (status) {
            query += ' AND u.driver_status = ?';
            params.push(status);
        }

        if (experience) {
            query += ' AND u.experience_years >= ?';
            params.push(parseInt(experience));
        }

        if (corridor) {
            query += ' AND u.preferred_corridors LIKE ?';
            params.push(`%${corridor}%`);
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC';

        db.all(query, params, (err, drivers) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Process drivers data
            const processedDrivers = drivers.map(driver => ({
                ...driver,
                preferred_corridors: JSON.parse(driver.preferred_corridors || '[]'),
                uploaded_documents: driver.uploaded_documents ? driver.uploaded_documents.split(',') : []
            }));

            res.json({ success: true, drivers: processedDrivers });
        });

    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

// Update driver status (admin only)
router.patch('/:id/status', async (req, res) => {
    try {
        const driverId = req.params.id;
        const { status, notes } = req.body;

        const allowedStatuses = ['pending', 'approved', 'suspended', 'rejected'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.run(`
            UPDATE users 
            SET driver_status = ?, updated_at = datetime('now'), approved_at = ?, approved_by = ?
            WHERE id = ? AND role = 'driver'
        `, [
            status, 
            status === 'approved' ? new Date().toISOString() : null,
            status === 'approved' ? 'admin' : null,
            driverId
        ], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update status' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Driver not found' });
            }

            // TODO: Send notification to driver about status change

            res.json({ 
                success: true, 
                message: `Driver status updated to ${status}`,
                newStatus: status
            });
        });

    } catch (error) {
        console.error('Update driver status error:', error);
        res.status(500).json({ error: 'Failed to update driver status' });
    }
});

// Get driver documents
router.get('/:id/documents', async (req, res) => {
    try {
        const driverId = req.params.id;

        db.all(`
            SELECT * FROM user_documents 
            WHERE user_id = ?
            ORDER BY document_type, created_at DESC
        `, [driverId], (err, documents) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ success: true, documents });
        });

    } catch (error) {
        console.error('Get driver documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Helper functions
async function checkDriverExists(nidaNumber, phoneNumber, licenseNumber) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                CASE 
                    WHEN nida_number = ? THEN 'nida'
                    WHEN phone_number = ? THEN 'phone'
                    WHEN license_number = ? THEN 'license'
                END as field
            FROM users 
            WHERE (nida_number = ? OR phone_number = ? OR license_number = ?) AND role = 'driver'
            LIMIT 1
        `, [nidaNumber, phoneNumber, licenseNumber, nidaNumber, phoneNumber, licenseNumber], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function createDriver(driverData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO users (
                nida_number, full_name, phone_number, email, role,
                license_number, license_expiry, experience_years, preferred_corridors,
                emergency_contact_name, emergency_contact_phone, driver_status, created_at
            ) VALUES (?, ?, ?, ?, 'driver', ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
        `;

        db.run(query, [
            driverData.nidaNumber,
            driverData.fullName,
            driverData.phoneNumber,
            driverData.email,
            driverData.licenseNumber,
            driverData.licenseExpiry,
            driverData.experienceYears,
            driverData.preferredCorridors,
            driverData.emergencyContactName,
            driverData.emergencyContactPhone
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function processDriverDocuments(driverId, files) {
    const documentTypes = {
        'nida': 'nida',
        'license': 'license',
        'policeClearance': 'police_clearance',
        'profilePhoto': 'profile_photo'
    };

    for (const [fieldName, file] of Object.entries(files)) {
        if (file && file[0]) {
            const uploadedFile = file[0];
            const documentType = documentTypes[fieldName];

            if (documentType) {
                // Optimize image if it's an image file
                if (uploadedFile.mimetype.startsWith('image/')) {
                    await optimizeImage(uploadedFile.path);
                }

                // Save document record
                await saveDocumentRecord(driverId, documentType, uploadedFile);
            }
        }
    }
}

async function optimizeImage(filePath) {
    try {
        await sharp(filePath)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(filePath + '_optimized');

        // Replace original with optimized
        fs.renameSync(filePath + '_optimized', filePath);
    } catch (error) {
        console.error('Image optimization error:', error);
        // Continue without optimization if it fails
    }
}

async function saveDocumentRecord(driverId, documentType, file) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO user_documents (
                user_id, document_type, file_path, file_name, file_size, mime_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        db.run(query, [
            driverId,
            documentType,
            file.path,
            file.originalname,
            file.size,
            file.mimetype
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

module.exports = router;