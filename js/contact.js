// Contact page JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Handle logo image errors
    const logoImages = document.querySelectorAll('.logo-img, .footer-logo-img');
    logoImages.forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
        });
    });
    
    // Handle WhatsApp buttons with consistent message format
    const whatsappButtons = document.querySelectorAll('a[href*="wa.me"]');
    
    whatsappButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Check if the button already has a predefined message
            const currentHref = this.getAttribute('href');
            if (!currentHref.includes('text=')) {
                e.preventDefault();
                
                // Pre-filled message with standard quote format
                const message = `🚗 *Manyanza Transit Quote*

Route: Dar es Salaam → Tunduma
Distance: 932 km
Overnight Stays: 1 night(s)

PRICE BREAKDOWN:
* Base Distance Fee: TSh 1,398,000
* Per Diem: TSh 50,000
* Return Travel: TSh 65,000

TOTAL: TSh 1,785,340

I'd like to book this trip or get more information about your services.`;
                
                const phoneNumber = '+255765111131'; // Manyanza Company Limited WhatsApp
                const encodedMessage = encodeURIComponent(message);
                const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
                
                window.open(whatsappURL, '_blank');
            }
        });
    });
    
    // Handle contact form submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const fullName = formData.get('fullName');
            const email = formData.get('email');
            const phone = formData.get('phone');
            const serviceType = formData.get('serviceType');
            const message = formData.get('message');
            
            // Simple validation
            if (!fullName || !email || !phone || !message) {
                alert('Please fill in all required fields.');
                return;
            }
            
            // In a real implementation, you would send this data to your server
            // For now, we'll just show a success message
            alert('Thank you for your message! We will get back to you within 24 hours.');
            contactForm.reset();
        });
    }
});