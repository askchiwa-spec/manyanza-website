const Database = require('../database/db');
const PricingCalculator = require('./pricingCalculator');
const { v4: uuidv4 } = require('uuid');

class WhatsAppBot {
    constructor() {
        this.db = new Database().getConnection();
        this.pricingCalculator = new PricingCalculator();
        
        // Conversation states
        this.states = {
            IDLE: 'idle',
            COLLECTING_PICKUP: 'collecting_pickup',
            COLLECTING_DESTINATION: 'collecting_destination',
            COLLECTING_VEHICLE: 'collecting_vehicle',
            COLLECTING_DATE: 'collecting_date',
            CONFIRMING_DETAILS: 'confirming_details',
            AWAITING_PAYMENT: 'awaiting_payment',
            BOOKING_CONFIRMED: 'booking_confirmed'
        };

        // Predefined corridors
        this.corridors = {
            'dar-tunduma': { distance: 932, nights: 1, returnAllowance: 65000, name: 'Dar es Salaam → Tunduma' },
            'dar-rusumo': { distance: 1300, nights: 2, returnAllowance: 90000, name: 'Dar es Salaam → Rusumo' },
            'dar-mutukula': { distance: 1480, nights: 2, returnAllowance: 95000, name: 'Dar es Salaam → Mutukula' },
            'dar-kabanga': { distance: 1200, nights: 2, returnAllowance: 85000, name: 'Dar es Salaam → Kabanga/Kobero' },
            'dar-kasumulu': { distance: 1100, nights: 2, returnAllowance: 70000, name: 'Dar es Salaam → Kasumulu' }
        };

        // Vehicle types
        this.vehicleTypes = [
            'pickup', 'van', 'truck', 'saloon', 'suv', 'bus', 'lorry', 'motorcycle'
        ];
    }

    async processMessage(messageData) {
        const { from, body, mediaUrl, hasMedia, messageSid } = messageData;
        
        try {
            // Get or create client
            const client = await this.getOrCreateClient(from);
            
            // Get current conversation state
            const conversationState = await this.getConversationState(from);
            
            // Process message based on state and content
            const response = await this.handleMessage(client, body, conversationState, hasMedia, mediaUrl);
            
            // Update conversation state if needed
            if (response.newState) {
                await this.updateConversationState(from, response.newState, response.bookingId);
            }
            
            return response;
            
        } catch (error) {
            console.error('Error processing WhatsApp message:', error);
            return {
                message: "Sorry, I encountered an error. Please try again or contact our support team.",
                newState: this.states.IDLE
            };
        }
    }

    async handleMessage(client, body, currentState, hasMedia, mediaUrl) {
        const message = body?.toLowerCase().trim() || '';
        
        // Handle global commands first
        if (message.includes('help') || message.includes('menu')) {
            return this.showMainMenu();
        }
        
        if (message.includes('cancel') || message.includes('stop')) {
            await this.cancelCurrentBooking(client.phone_number);
            return {
                message: "Your current booking has been cancelled. Type 'book' to start a new booking or 'help' for assistance.",
                newState: this.states.IDLE
            };
        }

        // Handle states
        switch (currentState) {
            case this.states.IDLE:
                return this.handleIdleState(message, client);
                
            case this.states.COLLECTING_PICKUP:
                return this.handlePickupCollection(message, client);
                
            case this.states.COLLECTING_DESTINATION:
                return this.handleDestinationCollection(message, client);
                
            case this.states.COLLECTING_VEHICLE:
                return this.handleVehicleCollection(message, client);
                
            case this.states.COLLECTING_DATE:
                return this.handleDateCollection(message, client);
                
            case this.states.CONFIRMING_DETAILS:
                return this.handleDetailsConfirmation(message, client);
                
            case this.states.AWAITING_PAYMENT:
                return this.handlePaymentProof(message, client, hasMedia, mediaUrl);
                
            default:
                return this.showMainMenu();
        }
    }

    async handleIdleState(message, client) {
        if (message.includes('book') || message.includes('hire') || message.includes('transport')) {
            return {
                message: `🚗 *Welcome to Manyanza Vehicle Transit!*\n\nI'll help you book professional vehicle transit service.\n\n📍 *Step 1: Pickup Location*\nPlease tell me where you want the vehicle picked up from:\n\nExample: "Dar es Salaam CBD" or "Kariakoo Market"`,
                newState: this.states.COLLECTING_PICKUP
            };
        }
        
        if (message.includes('price') || message.includes('cost') || message.includes('rate')) {
            return {
                message: this.getPricingInfo(),
                newState: this.states.IDLE
            };
        }
        
        if (message.includes('driver') || message.includes('join')) {
            return {
                message: `👨‍💼 *Become a Manyanza Driver*\n\nInterested in joining our professional driver network?\n\n📋 Requirements:\n• Valid driver's license\n• 3+ years experience\n• Police clearance\n• Age 25-55\n\n📱 Apply online: https://askchiwa-spec.github.io/manyanza-website/become-driver.html\n\nOr call us for assistance.`,
                newState: this.states.IDLE
            };
        }
        
        return this.showMainMenu();
    }

    async handlePickupCollection(message, client) {
        if (message.length < 3) {
            return {
                message: "Please provide a more detailed pickup location.\n\nExample: 'Dar es Salaam, Kariakoo' or 'Arusha Bus Station'",
                newState: this.states.COLLECTING_PICKUP
            };
        }

        // Save pickup location and move to destination
        await this.saveBookingData(client.phone_number, 'pickup_location', message);
        
        return {
            message: `✅ Pickup: ${message}\n\n📍 *Step 2: Destination*\nWhere should the vehicle be delivered?\n\nExample: "Mwanza City" or "Tunduma Border"`,
            newState: this.states.COLLECTING_DESTINATION
        };
    }

    async handleDestinationCollection(message, client) {
        if (message.length < 3) {
            return {
                message: "Please provide a more detailed destination.\n\nExample: 'Mbeya, Mbalizi Road' or 'Dodoma City Center'",
                newState: this.states.COLLECTING_DESTINATION
            };
        }

        // Save destination and check for predefined corridors
        await this.saveBookingData(client.phone_number, 'destination', message);
        
        const corridorMatch = this.detectCorridor(await this.getBookingData(client.phone_number, 'pickup_location'), message);
        
        if (corridorMatch) {
            await this.saveBookingData(client.phone_number, 'corridor_type', corridorMatch.key);
            await this.saveBookingData(client.phone_number, 'distance_km', corridorMatch.distance);
        }

        return {
            message: `✅ Destination: ${message}\n\n🚙 *Step 3: Vehicle Type*\nWhat type of vehicle do you need?\n\n${this.getVehicleOptions()}\n\nJust type the vehicle type (e.g., "pickup" or "van")`,
            newState: this.states.COLLECTING_VEHICLE
        };
    }

    async handleVehicleCollection(message, client) {
        const vehicleType = this.matchVehicleType(message);
        
        if (!vehicleType) {
            return {
                message: `Please select a valid vehicle type:\n\n${this.getVehicleOptions()}\n\nType the vehicle name (e.g., "pickup")`,
                newState: this.states.COLLECTING_VEHICLE
            };
        }

        await this.saveBookingData(client.phone_number, 'vehicle_type', vehicleType);
        
        return {
            message: `✅ Vehicle: ${vehicleType.toUpperCase()}\n\n📅 *Step 4: Pickup Date*\nWhen do you need the vehicle?\n\nExamples:\n• "Today"\n• "Tomorrow"\n• "December 15"\n• "Next Monday"`,
            newState: this.states.COLLECTING_DATE
        };
    }

    async handleDateCollection(message, client) {
        const parsedDate = this.parseDate(message);
        
        if (!parsedDate.isValid) {
            return {
                message: "Please provide a clear date.\n\nExamples:\n• 'Today'\n• 'Tomorrow'\n• 'December 15'\n• 'Next Monday'\n• '2025-01-15'",
                newState: this.states.COLLECTING_DATE
            };
        }

        await this.saveBookingData(client.phone_number, 'pickup_date', parsedDate.date);
        
        // Calculate pricing and show confirmation
        const bookingData = await this.getAllBookingData(client.phone_number);
        const pricing = await this.calculatePricing(bookingData);
        
        const confirmationMessage = await this.generateConfirmationMessage(bookingData, pricing);
        
        return {
            message: confirmationMessage,
            newState: this.states.CONFIRMING_DETAILS
        };
    }

    async handleDetailsConfirmation(message, client) {
        if (message.includes('yes') || message.includes('confirm') || message.includes('book')) {
            // Create booking
            const bookingData = await this.getAllBookingData(client.phone_number);
            const pricing = await this.calculatePricing(bookingData);
            const bookingId = await this.createBooking(client, bookingData, pricing);
            
            const paymentMessage = this.generatePaymentMessage(pricing, bookingId);
            
            return {
                message: paymentMessage,
                newState: this.states.AWAITING_PAYMENT,
                bookingId: bookingId
            };
        }
        
        if (message.includes('no') || message.includes('change') || message.includes('edit')) {
            await this.clearBookingData(client.phone_number);
            return {
                message: "Let's start over.\n\n📍 Where would you like the vehicle picked up from?",
                newState: this.states.COLLECTING_PICKUP
            };
        }
        
        return {
            message: "Please reply with:\n• 'YES' to confirm booking\n• 'NO' to start over\n• 'CANCEL' to stop",
            newState: this.states.CONFIRMING_DETAILS
        };
    }

    async handlePaymentProof(message, client, hasMedia, mediaUrl) {
        if (hasMedia && mediaUrl) {
            // Handle payment proof image
            const bookingId = await this.getCurrentBookingId(client.phone_number);
            await this.savePaymentProof(bookingId, mediaUrl, message);
            
            return {
                message: `📷 Payment proof received!\n\n⏳ We're verifying your payment. You'll receive confirmation within 30 minutes.\n\n📋 Your booking reference: #${bookingId}\n\nThank you for choosing Manyanza! 🙏`,
                newState: this.states.BOOKING_CONFIRMED
            };
        }
        
        return {
            message: "Please send a photo of your payment receipt or proof of transfer.\n\nSupported methods:\n💳 M-Pesa screenshot\n🏦 Bank transfer receipt\n💰 TigoPesa confirmation",
            newState: this.states.AWAITING_PAYMENT
        };
    }

    // Helper methods
    showMainMenu() {
        return {
            message: `🚗 *Welcome to Manyanza Vehicle Transit*\n\nHow can I help you today?\n\n📋 *Services:*\n• Type 'BOOK' - Book vehicle transit\n• Type 'PRICE' - View pricing rates\n• Type 'DRIVER' - Become a driver\n• Type 'HELP' - Get assistance\n\n💬 Or just tell me what you need!`,
            newState: this.states.IDLE
        };
    }

    getPricingInfo() {
        return `💰 *Manyanza Transparent Pricing*\n\n📊 *Per-Kilometer Model:*\n• TSh 1,500 per kilometer\n• TSh 50,000 per overnight stay\n• Platform commission: 18%\n\n🛣️ *Popular Routes:*\n• Dar → Tunduma: ~TSh 1,785,000\n• Dar → Mwanza: ~TSh 2,200,000\n• Dar → Arusha: ~TSh 1,650,000\n\n*Excludes: Fuel, tolls, permits\n\n📱 Type 'BOOK' to get exact quote!`;
    }

    getVehicleOptions() {
        return `🚗 *Available Vehicles:*\n• PICKUP - Small cargo transport\n• VAN - Medium goods/passengers\n• TRUCK - Large cargo\n• SALOON - 4-5 passengers\n• SUV - 7+ passengers\n• BUS - Large groups\n• LORRY - Heavy goods\n• MOTORCYCLE - Quick delivery`;
    }

    // Database helper methods would continue here...
    // (Additional helper methods for database operations, pricing calculations, etc.)

    async getOrCreateClient(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR IGNORE INTO users (phone_number, whatsapp_number, role, created_at)
                VALUES (?, ?, 'client', datetime('now'))
            `;
            
            this.db.run(query, [phoneNumber, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Get the client
                const selectQuery = `SELECT * FROM users WHERE phone_number = ? AND role = 'client'`;
                this.db.get(selectQuery, [phoneNumber], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            }.bind(this));
        });
    }

    async saveBookingData(phoneNumber, field, value) {
        // Implementation for saving temporary booking data
        // This could use a separate table or JSON field
        return Promise.resolve();
    }

    async calculatePricing(bookingData) {
        return this.pricingCalculator.calculate({
            distance: bookingData.distance_km || 100,
            nights: bookingData.nights || 0,
            returnAllowance: bookingData.return_allowance || 0,
            vehicleType: bookingData.vehicle_type
        });
    }

    // Conversation state management
    async getConversationState(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT conversation_state FROM users 
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.get(query, [phoneNumber], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.conversation_state || this.states.IDLE : this.states.IDLE);
                }
            });
        });
    }

    async updateConversationState(phoneNumber, newState, bookingId = null) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE users 
                SET conversation_state = ?, current_booking_id = ?, updated_at = datetime('now')
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.run(query, [newState, bookingId, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async getBookingData(phoneNumber, field) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT booking_data FROM users 
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.get(query, [phoneNumber], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.booking_data) {
                        try {
                            const data = JSON.parse(row.booking_data);
                            resolve(data[field] || null);
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    async getAllBookingData(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT booking_data FROM users 
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.get(query, [phoneNumber], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.booking_data) {
                        try {
                            resolve(JSON.parse(row.booking_data));
                        } catch (e) {
                            resolve({});
                        }
                    } else {
                        resolve({});
                    }
                }
            });
        });
    }

    async saveBookingData(phoneNumber, field, value) {
        return new Promise((resolve, reject) => {
            // Get current booking data
            this.db.get(
                `SELECT booking_data FROM users WHERE phone_number = ? AND role = 'client'`,
                [phoneNumber],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let bookingData = {};
                    if (row && row.booking_data) {
                        try {
                            bookingData = JSON.parse(row.booking_data);
                        } catch (e) {
                            bookingData = {};
                        }
                    }
                    
                    // Update the field
                    bookingData[field] = value;
                    
                    // Save back to database
                    const updateQuery = `
                        UPDATE users 
                        SET booking_data = ?, updated_at = datetime('now')
                        WHERE phone_number = ? AND role = 'client'
                    `;
                    
                    this.db.run(updateQuery, [JSON.stringify(bookingData), phoneNumber], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            );
        });
    }

    async clearBookingData(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE users 
                SET booking_data = NULL, conversation_state = ?, updated_at = datetime('now')
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.run(query, [this.states.IDLE, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async generateConfirmationMessage(bookingData, pricing) {
        // Get corridor name for display
        let corridorName = 'Custom Route';
        if (bookingData.corridor_type) {
            const corridor = this.corridors[bookingData.corridor_type];
            if (corridor) {
                corridorName = corridor.name;
            }
        }

        return `🚗 *Manyanza Transit Quote*\n\n` +
               `Route: ${bookingData.pickup_location} → ${bookingData.destination}\n` +
               `Distance: ${bookingData.distance_km || 0} km\n` +
               `Overnight Stays: ${bookingData.nights || 0} night(s)\n\n` +
               `PRICE BREAKDOWN:\n` +
               `* Base Distance Fee: TSh ${pricing.subtotal?.toLocaleString()}\n` +
               `* Per Diem: TSh ${this.pricingCalculator.PER_DIEM_RATE * (bookingData.nights || 0)}\n` +
               `* Return Travel: TSh ${this.pricingCalculator.getReturnAllowance(bookingData.corridor_type)}\n` +
               `\nTOTAL: TSh ${pricing.total?.toLocaleString()}\n\n` +
               `I'd like to book this trip or get more information about your services.`;
    }

    async createBooking(client, bookingData, pricing) {
        return new Promise((resolve, reject) => {
            const bookingId = uuidv4().substring(0, 8).toUpperCase();
            
            const query = `
                INSERT INTO bookings (
                    booking_id, client_id, pickup_location, destination,
                    vehicle_type, pickup_date, total_amount, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', datetime('now'))
            `;
            
            this.db.run(query, [
                bookingId, client.id, bookingData.pickup_location,
                bookingData.destination, bookingData.vehicle_type,
                bookingData.pickup_date, pricing.total
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(bookingId);
                }
            });
        });
    }

    generatePaymentMessage(pricing, bookingId) {
        return `💳 *Payment Required*\n\n` +
               `📋 Booking: #${bookingId}\n` +
               `💰 Amount: **TSh ${pricing.total?.toLocaleString()}**\n\n` +
               `💸 *Payment Methods:*\n` +
               `• M-Pesa: 0765 111 131\n` +
               `• TigoPesa: 0765 111 131\n` +
               `• Bank Transfer: Contact us\n\n` +
               `📷 Send payment proof here after payment`;
    }

    async getCurrentBookingId(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT current_booking_id FROM users 
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.get(query, [phoneNumber], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.current_booking_id : null);
                }
            });
        });
    }

    async savePaymentProof(bookingId, mediaUrl, message) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE bookings 
                SET payment_proof_url = ?, payment_notes = ?, status = 'payment_submitted', updated_at = datetime('now')
                WHERE booking_id = ?
            `;
            
            this.db.run(query, [mediaUrl, message, bookingId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async cancelCurrentBooking(phoneNumber) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE users 
                SET conversation_state = ?, booking_data = NULL, current_booking_id = NULL
                WHERE phone_number = ? AND role = 'client'
            `;
            
            this.db.run(query, [this.states.IDLE, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Additional helper methods...
    detectCorridor(pickup, destination) {
        // Logic to detect predefined corridors
        return null;
    }

    matchVehicleType(input) {
        return this.vehicleTypes.find(type => 
            input.toLowerCase().includes(type.toLowerCase())
        );
    }

    parseDate(input) {
        // Date parsing logic
        return { isValid: true, date: new Date().toISOString().split('T')[0] };
    }
}

module.exports = WhatsAppBot;