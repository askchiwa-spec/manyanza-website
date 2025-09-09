# Manyanza Company Limited - Website

![Manyanza Logo](https://img.shields.io/badge/Manyanza-Vehicle%20Transit-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Phase%201%20MVP-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Tanzania-red?style=for-the-badge)

A professional website for **Manyanza Company Limited**, Tanzania's trusted vehicle transit and driver marketplace. This Phase 1 Manual MVP is designed to validate demand, pricing, and workflow for vehicle transit services across Tanzania.

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

## 🚀 Getting Started

### Prerequisites
- Python 3.x
- Modern web browser
- Git (for development)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/manyanza-website.git
   cd manyanza-website
   ```

2. **Start local server:**
   ```bash
   python3 -m http.server 8080
   ```

3. **Open in browser:**
   ```
   http://localhost:8080
   ```

### Deployment

**Static Hosting (Recommended):**
- GitHub Pages
- Netlify
- Vercel
- Any static web hosting service

**Traditional Hosting:**
- Upload all files maintaining directory structure
- No server-side processing required

## 📱 Mobile-First Design

The website is built with a mobile-first approach, ensuring optimal experience across all devices:
- Responsive navigation menu
- Touch-friendly buttons and forms
- Optimized for WhatsApp sharing
- Fast loading on mobile networks

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