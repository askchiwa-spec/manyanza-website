# Manyanza Backend API

🚗 **Comprehensive backend system for Manyanza Company Limited's WhatsApp-powered vehicle transit automation.**

## 🎯 Overview

This backend implements a complete Twilio WhatsApp automation system for vehicle transit bookings, driver management, and admin workflow. Built to transform Manyanza from Phase 1 MVP to fully automated Phase 2 operations.

## ✨ Key Features

### 🤖 WhatsApp Automation
- **Intelligent conversation flow** for booking collection
- **Automated pricing calculations** using exact frontend formula
- **Payment proof handling** with image uploads
- **Real-time status updates** to clients and drivers
- **Emergency alerts** and admin notifications

### 👨‍💼 Admin Dashboard
- **Booking management** with assignment workflow
- **Driver verification** and document management
- **Payment verification** system
- **Comprehensive reporting** and analytics
- **Real-time notifications** and alerts

### 📱 Communication System
- **WhatsApp Business API** integration
- **SMS notifications** for critical updates
- **Multi-channel delivery** with fallback options
- **Message history** and conversation tracking

### 🔒 Security & Compliance
- **JWT-based authentication** for admin access
- **Input validation** and sanitization
- **File upload security** with type restrictions
- **Database encryption** and backup systems

## 🏗 Architecture

```
Frontend (Phase 1) ←→ Backend API ←→ Twilio WhatsApp ←→ Clients
                          ↕
                    SQLite Database
                          ↕
                    Admin Dashboard
```

## 📊 Database Schema

### Core Tables
- **clients** - Customer information and contact details
- **drivers** - Driver profiles, documents, and verification status
- **bookings** - Complete booking lifecycle with pricing
- **whatsapp_conversations** - Message history and conversation state
- **payment_proofs** - Payment verification and processing
- **notifications** - SMS/WhatsApp delivery tracking
- **admin_users** - Admin authentication and roles
- **system_logs** - Comprehensive audit trail

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Git
- Twilio Account with WhatsApp Business API

### Installation

1. **Clone and setup:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Twilio credentials
   ```

3. **Initialize database:**
   ```bash
   npm run migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Environment setup:**
   ```bash
   NODE_ENV=production
   PORT=3000
   # Set all production environment variables
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## 📡 API Endpoints

### WhatsApp Automation
```
POST /api/webhooks/twilio       # Twilio WhatsApp webhook
POST /api/webhooks/sms          # SMS response handling
POST /api/webhooks/status       # Message status callbacks
```

### Booking Management
```
GET  /api/bookings              # List bookings (admin)
POST /api/bookings              # Create booking
GET  /api/bookings/:id          # Get booking details
PATCH /api/bookings/:id/status  # Update booking status
```

### Driver Management
```
GET  /api/drivers               # List drivers (admin)
POST /api/drivers/register      # Driver registration
GET  /api/drivers/:id           # Driver profile
PATCH /api/drivers/:id/status   # Update driver status
GET  /api/drivers/:id/documents # Get driver documents
```

### Admin Dashboard
```
POST /api/admin/login           # Admin authentication
GET  /api/admin/dashboard       # Dashboard overview
POST /api/admin/bookings/:id/assign-driver  # Assign driver
GET  /api/admin/drivers/available           # Available drivers
```

### Payments & Notifications
```
POST /api/payments/submit-proof     # Submit payment proof
POST /api/payments/verify/:id       # Verify payment (admin)
GET  /api/payments/pending-verifications  # Pending payments

POST /api/notifications/send        # Send manual notification
POST /api/notifications/reminder    # Send booking reminder
GET  /api/notifications/history/:id # Notification history
```

## 🤖 WhatsApp Flow Example

```
Client: "Book"
Bot: "Welcome! Where do you need pickup?"

Client: "Dar es Salaam CBD"
Bot: "Great! Where's the destination?"

Client: "Tunduma border"
Bot: "What vehicle type? (pickup/van/truck/etc)"

Client: "pickup"
Bot: "When do you need pickup?"

Client: "tomorrow"
Bot: "📊 PRICING BREAKDOWN:
• Distance: 932 km × TSh 1,500 = TSh 1,398,000
• Return Allowance: TSh 65,000
• Platform Fee (18%): TSh 263,340
• TOTAL: TSh 1,726,340

Confirm booking? (YES/NO)"

Client: "yes"
Bot: "💰 PAYMENT REQUIRED:
Upfront (80%): TSh 1,381,072
Please send M-Pesa/TigoPesa proof..."

[Client sends payment screenshot]
Bot: "Payment received! Verifying... 
You'll get driver details within 2 hours!"
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+255765111131

# Security
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD_HASH=bcrypt_hash

# Pricing (matches frontend exactly)
RATE_PER_KM=1500
PER_DIEM_RATE=50000
PLATFORM_COMMISSION_DEFAULT=0.18
```

### Webhook URLs (Production)
```bash
# Twilio Console Configuration
Webhook URL: https://api.manyanza.co.tz/api/webhooks/twilio
Status Callback: https://api.manyanza.co.tz/api/webhooks/status
```

## 📱 Mobile Integration

### WhatsApp Business Profile
```
Business Name: Manyanza Vehicle Transit
Category: Transportation
Description: Professional vehicle transit across Tanzania
Phone: +255765111131
Website: https://askchiwa-spec.github.io/manyanza-website
Hours: Mon-Fri 8AM-6PM, Sat 9AM-4PM, Sun Emergency
```

### Message Templates (Pre-approved by WhatsApp)
- Booking confirmation
- Driver assignment
- Status updates
- Payment reminders

## 🔒 Security Features

### Authentication
- JWT tokens for admin access
- Session management with expiry
- Role-based access control

### Input Validation
- Request payload validation
- File upload type restrictions
- Phone number format validation
- SQL injection prevention

### Data Protection
- Environment variable encryption
- Database backup automation
- Audit logs for all actions
- GDPR compliance measures

## 📊 Monitoring & Analytics

### System Metrics
- Message delivery rates
- Booking conversion rates
- Response time analytics
- Error rate monitoring

### Business Intelligence
- Revenue tracking
- Driver performance metrics
- Customer satisfaction scores
- Operational efficiency reports

## 🚨 Error Handling

### WhatsApp Failures
- Automatic retry mechanisms
- SMS fallback for critical messages
- Admin alerts for system issues
- Graceful degradation

### Database Issues
- Connection pooling
- Automatic backup verification
- Data consistency checks
- Recovery procedures

## 🔄 Maintenance

### Regular Tasks
- Database backup verification
- Log file rotation
- Security patch updates
- Performance optimization

### Monitoring Alerts
- Failed message delivery
- High error rates
- Database connectivity issues
- Webhook endpoint failures

## 📞 Support & Troubleshooting

### Common Issues

1. **WhatsApp messages not sending:**
   - Check Twilio account status
   - Verify webhook configuration
   - Test with curl commands

2. **Database connection errors:**
   - Check SQLite file permissions
   - Verify disk space availability
   - Review connection pool settings

3. **Admin login failures:**
   - Verify JWT secret configuration
   - Check password hash generation
   - Review session timeout settings

### Debug Mode
```bash
NODE_ENV=development npm run dev
# Enables detailed logging and error messages
```

## 📈 Scaling Considerations

### Performance Optimization
- Database indexing for frequent queries
- Message queue for high-volume notifications
- Caching for repeated API calls
- CDN for static file delivery

### Infrastructure Scaling
- Load balancer configuration
- Database clustering options
- Microservices architecture
- Auto-scaling policies

## 🛣 Roadmap

### Phase 2 Enhancements
- [ ] Real-time GPS tracking
- [ ] Mobile driver app
- [ ] Advanced analytics dashboard
- [ ] Multi-language support

### Phase 3 Features
- [ ] AI-powered route optimization
- [ ] Predictive pricing models
- [ ] Integration with fleet management
- [ ] Customer mobile app

---

## 📋 Deployment Checklist

- [ ] Twilio WhatsApp Business API configured
- [ ] Environment variables set correctly
- [ ] Database initialized and tested
- [ ] Webhook endpoints configured
- [ ] SSL certificates installed
- [ ] Admin credentials created
- [ ] Payment integration tested
- [ ] Monitoring alerts configured
- [ ] Backup systems verified
- [ ] Security audit completed

**🎉 Your Manyanza automation system is ready for production!**