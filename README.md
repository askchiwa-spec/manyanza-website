# Manyanza Company Limited - Complete Platform

![Manyanza Logo](https://img.shields.io/badge/Manyanza-Vehicle%20Transit-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Phase%202%20Automation-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Tanzania-red?style=for-the-badge)

A comprehensive platform for **Manyanza Company Limited**, Tanzania's trusted vehicle transit and driver marketplace. Now featuring full WhatsApp automation with Twilio integration for seamless booking management.

## 🏗 Platform Architecture

```
Phase 1 Website ←→ Phase 2 Backend API ←→ Twilio WhatsApp ←→ Clients
     (Frontend)            (Automation)           (Business API)
        ↓                        ↓                        ↓
   Static Pages           SQLite Database          WhatsApp Business
   Pricing Calculator     Admin Dashboard          SMS Notifications
   Contact Forms         Booking Management        Payment Verification
```

## 🚗 About Manyanza

Manyanza Company Limited is revolutionizing vehicle transit across Tanzania by connecting vehicle owners with vetted, professional drivers for safe and reliable transportation. We serve both local and international clients with transparent pricing and professional service.

### Key Features
- ✅ **Vetted Professional Drivers** - Thorough background checks and verification
- ✅ **Comprehensive Insurance** - Full coverage during transit
- ✅ **Transparent Pricing** - No hidden fees, clear breakdown
- ✅ **WhatsApp Support** - 24/7 customer service
- ✅ **Flexible Options** - Per-km or full-package pricing

## 🌐 Website Features

### Pages
1. **[Home](index.html)** - Hero section, benefits, and how it works
2. **[About](about.html)** - Company mission, vision, and values
3. **[Services](services.html)** - Detailed service offerings and coverage
4. **[Pricing Calculator](pricing-calculator.html)** - Interactive pricing engine
5. **[Become a Driver](become-driver.html)** - Driver recruitment and application
6. **[Contact](contact.html)** - Multiple contact options and support

### Advanced Pricing Calculator
- **Per-Kilometer Model** implementation
- **Real-time calculations** with detailed breakdowns
- **Corridor-specific pricing** for major routes
- **WhatsApp quote sharing** integration
- **Mobile-responsive** design

## 💰 Pricing Engine

### Model A: Per-Kilometer Transparent Pricing

**Base Formula:**
```
Base_Km_Fee = Km × TSh 1,500
Per_Diem = Nights × TSh 50,000
Return_Travel = Corridor-specific allowance
Extras = Waiting_Fee + After-hours_Surcharge
Subtotal = Base_Km_Fee + Per_Diem + Return_Travel + Extras
Customer_Total = Subtotal × (1 + Platform_Commission%)
```

**Parameters:**
- Rate per Km: **TSh 1,500**
- Per Diem: **TSh 50,000** per night
- Platform Commission: **15-20%** (default 18%)
- Waiting Fee: **TSh 15,000/hour** (after 2 free hours)
- After-hours: **TSh 25,000**

**Return Travel Allowances:**
- Tunduma: TSh 65,000
- Rusumo: TSh 90,000  
- Mutukula: TSh 95,000
- Kabanga/Kobero: TSh 85,000
- Kasumulu: TSh 70,000

### Sample Calculations
| Route | Distance | Price (18% commission) |
|-------|----------|------------------------|
| Dar → Tunduma | 932 km | **TSh 1,785,340** |
| Dar → Rusumo | 1,300 km | **TSh 2,525,200** |
| Dar → Mutukula | 1,480 km | **TSh 2,849,700** |

> **Note:** Fuel, tolls, port fees, storage, and statutory fees are excluded and paid separately by owner/agent.

## 🛠 Technical Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Styling:** Modern CSS with Grid and Flexbox
- **Icons:** Font Awesome 6.0
- **Fonts:** Inter (Google Fonts)
- **Server:** Python 3 built-in HTTP server
- **Version Control:** Git

## 🚀 Quick Start

### Frontend (Phase 1 Website)

**Local Development:**
```bash
# Start static website
python3 -m http.server 8080
# Access: http://localhost:8080
```

**Production Deployment:**
- **GitHub Pages:** https://askchiwa-spec.github.io/manyanza-website
- **Custom Domain:** Configure DNS and SSL

### Backend (Phase 2 Automation)

**Setup & Installation:**
```bash
cd backend
./setup.sh  # Automated setup script
```

**Development:**
```bash
npm run dev  # Start development server
```

**Production:**
```bash
npm start   # Start production server
```

**API Documentation:**
- **Health Check:** http://localhost:3000/health
- **Admin Dashboard:** http://localhost:3000/api/admin/dashboard
- **Complete API Docs:** `/backend/README.md`

## 📱 WhatsApp Automation Features

### 🤖 Intelligent Bot Conversations
- **Natural language booking** collection
- **Real-time pricing** calculations
- **Payment proof** handling with image uploads
- **Status updates** throughout journey
- **Emergency alerts** and support

### 📊 Admin Workflow
- **Booking management** dashboard
- **Driver assignment** with SMS/WhatsApp notifications
- **Payment verification** system
- **Document management** for driver onboarding
- **Real-time analytics** and reporting

### 📞 Communication Channels
- **Primary:** WhatsApp Business API (+255765111131)
- **Backup:** SMS notifications
- **Admin:** Email alerts and dashboard notifications
- **Emergency:** Multi-channel escalation

## 🔄 Complete User Journey

### Client Booking Flow
```
1. WhatsApp: "book" → Bot starts conversation
2. Collect: Pickup → Destination → Vehicle → Date
3. Calculate: Real-time pricing with breakdown
4. Payment: Upload M-Pesa/TigoPesa proof
5. Confirm: Booking created, driver assignment pending
6. Assign: Admin assigns vetted driver
7. Updates: Real-time status via WhatsApp
8. Complete: Delivery confirmation and rating
```

### Admin Workflow
```
1. Alert: New booking notification
2. Verify: Payment proof validation
3. Assign: Select available driver
4. Monitor: Track booking progress
5. Support: Handle any issues
6. Complete: Finalize payment and rating
```

## 🔧 Configuration

### Contact Information
Update the following placeholders in all HTML files:

```javascript
// In js/script.js and js/pricing-calculator.js
const phoneNumber = '+255XXXXXXXXX'; // Replace with actual WhatsApp number

// In HTML files
info@manyanza.co.tz // Update email addresses
"Dar es Salaam, Tanzania" // Update office address
```

### WhatsApp Integration
The website includes comprehensive WhatsApp integration:
- Direct quote sharing from pricing calculator
- Context-aware messaging based on page
- Professional message formatting
- Mobile-optimized chat initiation

## 📊 Business Integration

### Phase 1 Manual Operations
This website supports manual operations for MVP validation:

1. **Customer Inquiries** → WhatsApp/Email handling
2. **Driver Applications** → Manual processing and verification
3. **Booking Management** → WhatsApp coordination
4. **Payment Processing** → Manual M-Pesa/TigoPesa handling
5. **Trip Tracking** → WhatsApp milestone updates

### Future Enhancements (Phase 2+)
- Real-time booking system
- Automated driver matching
- GPS tracking integration
- Payment gateway integration
- Mobile applications
- Customer portal
- Driver management dashboard

## 🎨 Design System

### Brand Colors
- **Primary Blue:** `#2563eb`
- **Dark Blue:** `#1e40af`
- **Light Blue:** `#eff6ff`
- **Success Green:** `#22c55e`
- **Warning Yellow:** `#f59e0b`
- **Error Red:** `#dc2626`

### Typography
- **Font Family:** Inter (Google Fonts)
- **Headings:** 600-700 weight
- **Body:** 400-500 weight
- **Scale:** Modular scale based on 1rem base

## 🔒 Security Considerations

- Form validation (client-side)
- File upload restrictions
- XSS protection through proper escaping
- HTTPS recommended for production
- Input sanitization for contact forms

## 📈 SEO Optimization

- Semantic HTML structure
- Meta tags and descriptions
- OpenGraph tags for social sharing
- Fast loading performance
- Mobile-responsive design
- Clean URL structure

## 🤝 Contributing

This is a proprietary project for Manyanza Company Limited. For internal development:

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request
5. Deploy after review

## 📄 License

© 2025 Manyanza Company Limited. All rights reserved.

This project is proprietary software. Unauthorized copying, modification, distribution, or use is strictly prohibited.

## 📞 Support

- **WhatsApp:** +255 XXX XXX XXX
- **Email:** info@manyanza.co.tz
- **Office:** Dar es Salaam, Tanzania

---

**Built with ❤️ for Tanzania's transportation industry**