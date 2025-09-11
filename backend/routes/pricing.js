const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const PRICING_CONFIG_PATH = path.join(__dirname, '../config/pricing.json');

// Middleware for basic admin authentication (you can enhance this)
const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    
    // Simple admin key check (replace with proper JWT in production)
    if (adminKey !== 'manyanza-admin-2025') {
        return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
    }
    
    next();
};

// Get current pricing configuration
router.get('/pricing', async (req, res) => {
    try {
        const pricingData = await fs.readFile(PRICING_CONFIG_PATH, 'utf8');
        const pricing = JSON.parse(pricingData);
        
        res.json({
            status: 'success',
            data: pricing,
            message: 'Current pricing configuration retrieved'
        });
    } catch (error) {
        console.error('Error reading pricing config:', error);
        res.status(500).json({ error: 'Failed to read pricing configuration' });
    }
});

// Update pricing configuration
router.put('/pricing', authenticateAdmin, async (req, res) => {
    try {
        const {
            RATE_PER_KM,
            PER_DIEM_RATE,
            PLATFORM_COMMISSION_DEFAULT,
            WAITING_FEE_PER_HOUR,
            AFTER_HOURS_SURCHARGE,
            CORRIDOR_ALLOWANCES
        } = req.body;

        // Validate required fields
        if (!RATE_PER_KM || RATE_PER_KM <= 0) {
            return res.status(400).json({ error: 'RATE_PER_KM must be a positive number' });
        }

        // Read current config
        const currentData = await fs.readFile(PRICING_CONFIG_PATH, 'utf8');
        const currentPricing = JSON.parse(currentData);

        // Update pricing configuration
        const updatedPricing = {
            ...currentPricing,
            RATE_PER_KM: parseFloat(RATE_PER_KM),
            PER_DIEM_RATE: parseFloat(PER_DIEM_RATE) || currentPricing.PER_DIEM_RATE,
            PLATFORM_COMMISSION_DEFAULT: parseFloat(PLATFORM_COMMISSION_DEFAULT) || currentPricing.PLATFORM_COMMISSION_DEFAULT,
            WAITING_FEE_PER_HOUR: parseFloat(WAITING_FEE_PER_HOUR) || currentPricing.WAITING_FEE_PER_HOUR,
            AFTER_HOURS_SURCHARGE: parseFloat(AFTER_HOURS_SURCHARGE) || currentPricing.AFTER_HOURS_SURCHARGE,
            CORRIDOR_ALLOWANCES: CORRIDOR_ALLOWANCES || currentPricing.CORRIDOR_ALLOWANCES,
            LAST_UPDATED: new Date().toISOString(),
            UPDATED_BY: 'admin'
        };

        // Write updated config back to file
        await fs.writeFile(PRICING_CONFIG_PATH, JSON.stringify(updatedPricing, null, 2));

        res.json({
            status: 'success',
            data: updatedPricing,
            message: 'Pricing configuration updated successfully'
        });

        console.log('✅ Pricing updated:', {
            oldRate: currentPricing.RATE_PER_KM,
            newRate: updatedPricing.RATE_PER_KM,
            timestamp: updatedPricing.LAST_UPDATED
        });

    } catch (error) {
        console.error('Error updating pricing config:', error);
        res.status(500).json({ error: 'Failed to update pricing configuration' });
    }
});

// Update specific corridor allowance
router.put('/pricing/corridor/:corridor', authenticateAdmin, async (req, res) => {
    try {
        const { corridor } = req.params;
        const { allowance } = req.body;

        if (!allowance || allowance < 0) {
            return res.status(400).json({ error: 'Allowance must be a non-negative number' });
        }

        // Read current config
        const currentData = await fs.readFile(PRICING_CONFIG_PATH, 'utf8');
        const currentPricing = JSON.parse(currentData);

        // Update specific corridor allowance
        currentPricing.CORRIDOR_ALLOWANCES[corridor] = parseFloat(allowance);
        currentPricing.LAST_UPDATED = new Date().toISOString();
        currentPricing.UPDATED_BY = 'admin';

        // Write updated config back to file
        await fs.writeFile(PRICING_CONFIG_PATH, JSON.stringify(currentPricing, null, 2));

        res.json({
            status: 'success',
            data: currentPricing,
            message: `Corridor allowance for ${corridor} updated successfully`
        });

    } catch (error) {
        console.error('Error updating corridor allowance:', error);
        res.status(500).json({ error: 'Failed to update corridor allowance' });
    }
});

// Get pricing history/logs (for audit trail)
router.get('/pricing/history', authenticateAdmin, async (req, res) => {
    try {
        const pricingData = await fs.readFile(PRICING_CONFIG_PATH, 'utf8');
        const pricing = JSON.parse(pricingData);
        
        res.json({
            status: 'success',
            data: {
                current_rate: pricing.RATE_PER_KM,
                last_updated: pricing.LAST_UPDATED,
                updated_by: pricing.UPDATED_BY,
                full_config: pricing
            },
            message: 'Pricing history retrieved'
        });
    } catch (error) {
        console.error('Error reading pricing history:', error);
        res.status(500).json({ error: 'Failed to read pricing history' });
    }
});

module.exports = router;