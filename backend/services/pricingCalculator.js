/**
 * Pricing Calculator Service
 * Matches the frontend pricing engine with exact same parameters
 * Based on Manyanza's per-kilometer transparent pricing model
 */
const fs = require('fs').promises;
const path = require('path');

class PricingCalculator {
    constructor() {
        this.PRICING_CONFIG_PATH = path.join(__dirname, '../config/pricing.json');
        
        // Default pricing parameters (fallbacks)
        this.RATE_PER_KM = 700;
        this.PER_DIEM_RATE = 50000;
        this.PLATFORM_COMMISSION_DEFAULT = 0.18;
        this.WAITING_FEE_PER_HOUR = 15000;
        this.AFTER_HOURS_SURCHARGE = 25000;

        // Default return allowances for predefined corridors
        this.RETURN_ALLOWANCES = {
            'dar-tunduma': 65000,
            'dar-rusumo': 90000,
            'dar-mutukula': 95000,
            'dar-kabanga': 85000,
            'dar-kasumulu': 70000
        };

        // Platform commission tiers
        this.COMMISSION_TIERS = {
            standard: 0.18,
            volume: 0.15,
            premium: 0.20
        };
        
        // Load pricing config on initialization
        this.loadPricingConfig();
    }

    async loadPricingConfig() {
        try {
            const pricingData = await fs.readFile(this.PRICING_CONFIG_PATH, 'utf8');
            const config = JSON.parse(pricingData);
            
            // Update pricing parameters from config file
            this.RATE_PER_KM = config.RATE_PER_KM || this.RATE_PER_KM;
            this.PER_DIEM_RATE = config.PER_DIEM_RATE || this.PER_DIEM_RATE;
            this.PLATFORM_COMMISSION_DEFAULT = config.PLATFORM_COMMISSION_DEFAULT || this.PLATFORM_COMMISSION_DEFAULT;
            this.WAITING_FEE_PER_HOUR = config.WAITING_FEE_PER_HOUR || this.WAITING_FEE_PER_HOUR;
            this.AFTER_HOURS_SURCHARGE = config.AFTER_HOURS_SURCHARGE || this.AFTER_HOURS_SURCHARGE;
            
            // Update return allowances
            if (config.CORRIDOR_ALLOWANCES) {
                this.RETURN_ALLOWANCES = {
                    'dar-tunduma': config.CORRIDOR_ALLOWANCES.Tunduma || this.RETURN_ALLOWANCES['dar-tunduma'],
                    'dar-rusumo': config.CORRIDOR_ALLOWANCES.Rusumo || this.RETURN_ALLOWANCES['dar-rusumo'],
                    'dar-mutukula': config.CORRIDOR_ALLOWANCES.Mutukula || this.RETURN_ALLOWANCES['dar-mutukula'],
                    'dar-kabanga': config.CORRIDOR_ALLOWANCES.Kabanga || this.RETURN_ALLOWANCES['dar-kabanga'],
                    'dar-kasumulu': config.CORRIDOR_ALLOWANCES.Kasumulu || this.RETURN_ALLOWANCES['dar-kasumulu']
                };
            }
            
            console.log('✅ Pricing config loaded:', {
                ratePerKm: this.RATE_PER_KM,
                lastUpdated: config.LAST_UPDATED
            });
        } catch (error) {
            console.warn('⚠️ Could not load pricing config, using defaults:', error.message);
        }
    }

    /**
     * Calculate comprehensive pricing for a booking
     * @param {Object} params - Booking parameters
     * @returns {Object} Detailed pricing breakdown
     */
    calculate(params) {
        const {
            distance,
            nights = 0,
            corridorType = null,
            waitingHours = 0,
            afterHours = false,
            platformCommission = this.PLATFORM_COMMISSION_DEFAULT,
            vehicleType = 'pickup'
        } = params;

        // Validate inputs
        if (!distance || distance <= 0) {
            throw new Error('Distance must be greater than 0');
        }

        // Calculate base components
        const baseKmFee = distance * this.RATE_PER_KM;
        const perDiemFee = nights * this.PER_DIEM_RATE;
        const returnTravelFee = this.getReturnAllowance(corridorType);
        const waitingFee = this.calculateWaitingFee(waitingHours);
        const afterHoursFee = afterHours ? this.AFTER_HOURS_SURCHARGE : 0;

        // Calculate subtotal (driver service cost)
        const subtotal = baseKmFee + perDiemFee + returnTravelFee + waitingFee + afterHoursFee;

        // Calculate platform commission
        const commissionAmount = subtotal * platformCommission;

        // Calculate totals
        const customerTotal = subtotal + commissionAmount;
        const driverPayout = subtotal;

        // Return detailed breakdown
        return {
            breakdown: {
                baseKmFee: {
                    amount: baseKmFee,
                    description: `${distance} km × TSh ${this.RATE_PER_KM.toLocaleString()}`
                },
                perDiemFee: {
                    amount: perDiemFee,
                    description: `${nights} nights × TSh ${this.PER_DIEM_RATE.toLocaleString()}`
                },
                returnTravelFee: {
                    amount: returnTravelFee,
                    description: corridorType ? `${corridorType.toUpperCase()} return allowance` : 'Custom route return'
                },
                waitingFee: {
                    amount: waitingFee,
                    description: waitingHours > 2 ? `${waitingHours - 2} hours × TSh ${this.WAITING_FEE_PER_HOUR.toLocaleString()}` : 'No waiting fee (≤2 hours free)'
                },
                afterHoursFee: {
                    amount: afterHoursFee,
                    description: afterHours ? 'After-hours surcharge' : 'No after-hours surcharge'
                }
            },
            totals: {
                subtotal,
                commissionAmount,
                customerTotal,
                driverPayout,
                commissionRate: platformCommission
            },
            metadata: {
                distance,
                nights,
                corridorType,
                vehicleType,
                waitingHours,
                afterHours,
                calculatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Get return allowance for corridor
     */
    getReturnAllowance(corridorType) {
        if (!corridorType || !this.RETURN_ALLOWANCES[corridorType]) {
            // Default return allowance for custom routes (50% of base rate for estimated return)
            return 0;
        }
        return this.RETURN_ALLOWANCES[corridorType];
    }

    /**
     * Calculate waiting fee (first 2 hours free)
     */
    calculateWaitingFee(waitingHours) {
        if (waitingHours <= 2) {
            return 0;
        }
        return (waitingHours - 2) * this.WAITING_FEE_PER_HOUR;
    }

    /**
     * Generate formatted pricing message for WhatsApp
     */
    generatePricingMessage(pricing) {
        const { breakdown, totals, metadata } = pricing;

        let message = `🚗 *Manyanza Transit Quote*\n\n`;
        
        // Route information
        message += `Route: ${metadata.corridorName || 'Custom Route'}\n`;
        message += `Distance: ${metadata.distance} km\n`;
        message += `Overnight Stays: ${metadata.nights} night(s)\n\n`;
        
        // Price breakdown
        message += `PRICE BREAKDOWN:\n`;
        message += `* Base Distance Fee: TSh ${breakdown.baseKmFee.amount.toLocaleString()}\n`;
        message += `* Per Diem: TSh ${breakdown.perDiemFee.amount.toLocaleString()}\n`;
        message += `* Return Travel: TSh ${breakdown.returnTravelFee.amount.toLocaleString()}\n`;
        
        if (breakdown.waitingFee.amount > 0) {
            message += `* Waiting Fee: TSh ${breakdown.waitingFee.amount.toLocaleString()}\n`;
        }
        
        if (breakdown.afterHoursFee.amount > 0) {
            message += `* After-Hours: TSh ${breakdown.afterHoursFee.amount.toLocaleString()}\n`;
        }
        
        message += `\nTOTAL: TSh ${totals.customerTotal.toLocaleString()}\n\n`;
        message += `I'd like to book this trip or get more information about your services.`;

        return message;
    }

    /**
     * Calculate quick estimate for corridor
     */
    getCorridorEstimate(corridorKey) {
        const corridors = {
            'dar-tunduma': { distance: 932, nights: 1, name: 'Dar es Salaam → Tunduma' },
            'dar-rusumo': { distance: 1300, nights: 2, name: 'Dar es Salaam → Rusumo' },
            'dar-mutukula': { distance: 1480, nights: 2, name: 'Dar es Salaam → Mutukula' },
            'dar-kabanga': { distance: 1200, nights: 2, name: 'Dar es Salaam → Kabanga/Kobero' },
            'dar-kasumulu': { distance: 1100, nights: 2, name: 'Dar es Salaam → Kasumulu' }
        };

        const corridor = corridors[corridorKey];
        if (!corridor) {
            return null;
        }

        const pricing = this.calculate({
            distance: corridor.distance,
            nights: corridor.nights,
            corridorType: corridorKey
        });

        return {
            ...pricing,
            corridorName: corridor.name
        };
    }

    /**
     * Validate pricing parameters
     */
    validateParams(params) {
        const errors = [];

        if (!params.distance || params.distance <= 0) {
            errors.push('Distance must be greater than 0');
        }

        if (params.distance > 3000) {
            errors.push('Distance exceeds maximum supported range (3000 km)');
        }

        if (params.nights < 0 || params.nights > 10) {
            errors.push('Nights must be between 0 and 10');
        }

        if (params.waitingHours < 0 || params.waitingHours > 24) {
            errors.push('Waiting hours must be between 0 and 24');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = PricingCalculator;