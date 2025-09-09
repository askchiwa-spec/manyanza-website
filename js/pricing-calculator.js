// Manyanza Pricing Calculator Engine
// Implements Model A: Per-Kilometer Pricing Architecture

class ManyanzaPricingEngine {
    constructor() {
        // Pricing Parameters (TSh)
        this.RATE_PER_KM = 1500;
        this.PER_DIEM_RATE = 50000;
        this.WAITING_FEE_PER_HOUR = 15000;
        this.FREE_WAITING_HOURS = 2;
        
        // Return Travel Allowances by Corridor
        this.RETURN_ALLOWANCES = {
            'dar-tunduma': 65000,
            'dar-rusumo': 90000,
            'dar-mutukula': 95000,
            'dar-kabanga': 85000,
            'dar-kasumulu': 70000
        };
        
        // Default return allowance for custom routes
        this.DEFAULT_RETURN_ALLOWANCE = 75000;
        
        this.initializeCalculator();
    }

    initializeCalculator() {
        // Get DOM elements
        this.routeTypeSelect = document.getElementById('routeType');
        this.predefinedRouteGroup = document.getElementById('predefinedRouteGroup');
        this.customRouteGroup = document.getElementById('customRouteGroup');
        this.predefinedRouteSelect = document.getElementById('predefinedRoute');
        this.customKmInput = document.getElementById('customKm');
        this.customNightsInput = document.getElementById('customNights');
        this.platformCommissionSelect = document.getElementById('platformCommission');
        this.waitingHoursInput = document.getElementById('waitingHours');
        this.afterHoursSelect = document.getElementById('afterHours');
        this.calculateBtn = document.getElementById('calculateBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.resultsSection = document.getElementById('calculatorResults');

        // Bind event listeners
        this.bindEvents();
    }

    bindEvents() {
        // Route type change handler
        this.routeTypeSelect.addEventListener('change', (e) => {
            this.handleRouteTypeChange(e.target.value);
        });

        // Predefined route change handler
        this.predefinedRouteSelect.addEventListener('change', (e) => {
            this.handlePredefinedRouteChange(e.target.value);
        });

        // Calculate button
        this.calculateBtn.addEventListener('click', () => {
            this.calculatePricing();
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.resetCalculator();
        });

        // WhatsApp quote button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'whatsappQuote') {
                this.sendWhatsAppQuote();
            }
        });
    }

    handleRouteTypeChange(routeType) {
        // Hide all route groups
        this.predefinedRouteGroup.style.display = 'none';
        this.customRouteGroup.style.display = 'none';

        // Show relevant group
        if (routeType === 'predefined') {
            this.predefinedRouteGroup.style.display = 'block';
            this.predefinedRouteSelect.required = true;
            this.customKmInput.required = false;
            this.customNightsInput.required = false;
        } else if (routeType === 'custom') {
            this.customRouteGroup.style.display = 'block';
            this.predefinedRouteSelect.required = false;
            this.customKmInput.required = true;
            this.customNightsInput.required = true;
        }

        // Hide results when route type changes
        this.resultsSection.style.display = 'none';
    }

    handlePredefinedRouteChange(routeValue) {
        // Auto-populate custom fields based on predefined route
        if (routeValue) {
            const option = this.predefinedRouteSelect.querySelector(`option[value="${routeValue}"]`);
            if (option) {
                const km = option.dataset.km;
                const nights = option.dataset.nights;
                
                // Update the custom inputs for reference
                this.customKmInput.value = km;
                this.customNightsInput.value = nights;
            }
        }
    }

    calculatePricing() {
        try {
            // Validate and get input data
            const inputData = this.validateAndGetInputData();
            if (!inputData) return;

            // Perform calculations
            const calculation = this.performCalculations(inputData);

            // Display results
            this.displayResults(calculation, inputData);

            // Show results section
            this.resultsSection.style.display = 'block';
            this.resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Calculation error:', error);
            this.showError('An error occurred during calculation. Please check your inputs and try again.');
        }
    }

    validateAndGetInputData() {
        const routeType = this.routeTypeSelect.value;
        
        if (!routeType) {
            this.showError('Please select a route type.');
            return null;
        }

        let km, nights, routeKey, pickup, destination;

        if (routeType === 'predefined') {
            routeKey = this.predefinedRouteSelect.value;
            if (!routeKey) {
                this.showError('Please select a predefined corridor.');
                return null;
            }

            const option = this.predefinedRouteSelect.querySelector(`option[value="${routeKey}"]`);
            km = parseInt(option.dataset.km);
            nights = parseInt(option.dataset.nights);
            
            // Extract route names for display
            const routeText = option.textContent;
            const parts = routeText.split('→');
            pickup = parts[0]?.trim() || 'Dar es Salaam';
            destination = parts[1]?.split('(')[0]?.trim() || 'Destination';

        } else if (routeType === 'custom') {
            km = parseInt(this.customKmInput.value);
            nights = parseInt(this.customNightsInput.value);
            pickup = document.getElementById('pickup').value || 'Pickup Location';
            destination = document.getElementById('destination').value || 'Destination';
            routeKey = 'custom';

            if (!km || km <= 0) {
                this.showError('Please enter a valid distance in kilometers.');
                return null;
            }

            if (nights < 0) {
                this.showError('Number of nights cannot be negative.');
                return null;
            }
        }

        const platformCommission = parseFloat(this.platformCommissionSelect.value);
        const waitingHours = parseInt(this.waitingHoursInput.value) || 0;
        const afterHoursCharge = parseInt(this.afterHoursSelect.value) || 0;

        return {
            routeType,
            routeKey,
            km,
            nights,
            pickup,
            destination,
            platformCommission,
            waitingHours,
            afterHoursCharge
        };
    }

    performCalculations(data) {
        // Base formula implementation
        const baseKmFee = data.km * this.RATE_PER_KM;
        const perDiem = data.nights * this.PER_DIEM_RATE;
        
        // Return travel allowance
        let returnTravel;
        if (data.routeType === 'predefined' && this.RETURN_ALLOWANCES[data.routeKey]) {
            returnTravel = this.RETURN_ALLOWANCES[data.routeKey];
        } else {
            // For custom routes, estimate based on distance or use default
            returnTravel = Math.min(this.DEFAULT_RETURN_ALLOWANCE, data.km * 0.5 * this.RATE_PER_KM);
        }

        // Extra charges
        const waitingFee = Math.max(0, data.waitingHours - this.FREE_WAITING_HOURS) * this.WAITING_FEE_PER_HOUR;
        const afterHoursFee = data.afterHoursCharge;
        const extras = waitingFee + afterHoursFee;

        // Calculate subtotal (driver service total)
        const subtotal = baseKmFee + perDiem + returnTravel + extras;

        // Platform commission
        const commissionAmount = subtotal * data.platformCommission;
        
        // Customer total
        const customerTotal = subtotal + commissionAmount;

        // Driver payout (assuming no withholding for now)
        const driverPayout = subtotal;

        return {
            baseKmFee,
            perDiem,
            returnTravel,
            waitingFee,
            afterHoursFee,
            extras,
            subtotal,
            commissionAmount,
            customerTotal,
            driverPayout,
            commissionRate: data.platformCommission
        };
    }

    displayResults(calc, data) {
        // Update all result elements
        document.getElementById('baseKmFee').textContent = this.formatCurrency(calc.baseKmFee);
        document.getElementById('perDiemFee').textContent = this.formatCurrency(calc.perDiem);
        document.getElementById('returnTravelFee').textContent = this.formatCurrency(calc.returnTravel);
        
        // Show/hide optional fees
        const waitingFeeRow = document.getElementById('waitingFeeRow');
        const afterHoursFeeRow = document.getElementById('afterHoursFeeRow');
        
        if (calc.waitingFee > 0) {
            waitingFeeRow.style.display = 'flex';
            document.getElementById('waitingFee').textContent = this.formatCurrency(calc.waitingFee);
        } else {
            waitingFeeRow.style.display = 'none';
        }

        if (calc.afterHoursFee > 0) {
            afterHoursFeeRow.style.display = 'flex';
            document.getElementById('afterHoursFee').textContent = this.formatCurrency(calc.afterHoursFee);
        } else {
            afterHoursFeeRow.style.display = 'none';
        }

        document.getElementById('subtotal').textContent = this.formatCurrency(calc.subtotal);
        document.getElementById('commissionAmount').textContent = 
            `${this.formatCurrency(calc.commissionAmount)} (${(calc.commissionRate * 100).toFixed(0)}%)`;
        document.getElementById('customerTotal').textContent = this.formatCurrency(calc.customerTotal);
        document.getElementById('driverPayout').textContent = this.formatCurrency(calc.driverPayout);

        // Store calculation data for WhatsApp sharing
        this.lastCalculation = { calc, data };
    }

    formatCurrency(amount) {
        return `TSh ${amount.toLocaleString('en-US')}`;
    }

    resetCalculator() {
        // Reset all form fields
        document.getElementById('pricingCalculator').reset();
        
        // Hide conditional sections
        this.predefinedRouteGroup.style.display = 'none';
        this.customRouteGroup.style.display = 'none';
        this.resultsSection.style.display = 'none';

        // Reset required attributes
        this.predefinedRouteSelect.required = false;
        this.customKmInput.required = false;
        this.customNightsInput.required = false;

        // Clear stored calculation
        this.lastCalculation = null;
    }

    sendWhatsAppQuote() {
        if (!this.lastCalculation) {
            this.showError('Please calculate a quote first.');
            return;
        }

        const { calc, data } = this.lastCalculation;
        
        const message = this.generateWhatsAppMessage(calc, data);
        const phoneNumber = '+255XXXXXXXXX'; // Replace with actual WhatsApp number
        const encodedMessage = encodeURIComponent(message);
        const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        
        window.open(whatsappURL, '_blank');
    }

    generateWhatsAppMessage(calc, data) {
        const message = `
🚗 *Manyanza Transit Quote*

*Route:* ${data.pickup} → ${data.destination}
*Distance:* ${data.km} km
*Overnight Stays:* ${data.nights} night(s)

*PRICE BREAKDOWN:*
• Base Distance Fee: ${this.formatCurrency(calc.baseKmFee)}
• Per Diem: ${this.formatCurrency(calc.perDiem)}
• Return Travel: ${this.formatCurrency(calc.returnTravel)}
${calc.waitingFee > 0 ? `• Waiting Fee: ${this.formatCurrency(calc.waitingFee)}\n` : ''}${calc.afterHoursFee > 0 ? `• After-Hours: ${this.formatCurrency(calc.afterHoursFee)}\n` : ''}
*TOTAL: ${this.formatCurrency(calc.customerTotal)}*

I'd like to book this trip or get more information about your services.
        `.trim();

        return message;
    }

    showError(message) {
        // Create or update error notification
        const existingError = document.querySelector('.calculator-error');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'calculator-error';
        errorDiv.style.cssText = `
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;

        // Insert error before the form actions
        const formActions = document.querySelector('.form-actions');
        formActions.parentNode.insertBefore(errorDiv, formActions);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the pricing calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the pricing calculator page
    if (document.getElementById('pricingCalculator')) {
        new ManyanzaPricingEngine();
    }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManyanzaPricingEngine;
}