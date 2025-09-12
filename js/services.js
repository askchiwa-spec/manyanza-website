// Services page JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Handle the "Calculate Price & Book Now" button
    const bookBtn = document.querySelector('.book-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', function() {
            window.location.href = 'pricing-calculator.html';
        });
    }
    
    // Handle logout button if it exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Clear any stored authentication data
            localStorage.removeItem('authToken');
            alert('Logged out successfully');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        });
    }
    
    // Handle WhatsApp button
    const whatsappBtn = document.querySelector('.whatsapp-btn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function() {
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
        });
    }
});