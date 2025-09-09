// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-menu');

    if (mobileMenu) {
        mobileMenu.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Animate hamburger menu
            mobileMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileMenu.classList.remove('active');
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const isClickInsideNav = navMenu.contains(event.target);
        const isClickOnToggle = mobileMenu.contains(event.target);
        
        if (!isClickInsideNav && !isClickOnToggle && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileMenu.classList.remove('active');
        }
    });
});

// Form Handling
document.addEventListener('DOMContentLoaded', function() {
    // Contact Form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData);
            
            // Show success message (in a real application, you would send this to a server)
            showNotification('Thank you for your message! We will get back to you within 24 hours.', 'success');
            
            // Reset form
            contactForm.reset();
        });
    }

    // Driver Application Form
    const driverForm = document.getElementById('driverApplicationForm');
    if (driverForm) {
        driverForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate form
            if (validateDriverForm()) {
                // Get form data
                const formData = new FormData(driverForm);
                const data = Object.fromEntries(formData);
                
                // Show success message
                showNotification('Your driver application has been submitted successfully! We will review your application and contact you within 3-5 business days.', 'success');
                
                // Reset form
                driverForm.reset();
            }
        });
    }
});

// Form Validation
function validateDriverForm() {
    const requiredFields = [
        'fullName',
        'phone',
        'email',
        'experience',
        'nidaUpload',
        'licenseUpload',
        'clearanceUpload'
    ];
    
    let isValid = true;
    
    // Check required fields
    requiredFields.forEach(fieldName => {
        const field = document.querySelector(`[name="${fieldName}"]`);
        if (field && !field.value.trim()) {
            showFieldError(field, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });
    
    // Check if at least one corridor is selected
    const corridorCheckboxes = document.querySelectorAll('[name="corridors"]:checked');
    if (corridorCheckboxes.length === 0) {
        showNotification('Please select at least one preferred corridor.', 'error');
        isValid = false;
    }
    
    // Check terms agreement
    const termsCheckbox = document.querySelector('[name="terms"]');
    if (termsCheckbox && !termsCheckbox.checked) {
        showNotification('Please agree to the terms and conditions.', 'error');
        isValid = false;
    }
    
    return isValid;
}

// Show field error
function showFieldError(field, message) {
    clearFieldError(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#dc2626';
    errorDiv.style.fontSize = '0.9rem';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = '#dc2626';
}

// Clear field error
function clearFieldError(field) {
    if (field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        field.style.borderColor = '#e5e7eb';
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : '#2563eb'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        margin-left: 1rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    `;
    closeButton.addEventListener('click', () => notification.remove());
    
    notification.appendChild(closeButton);
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .nav-toggle.active .bar:nth-child(2) {
        opacity: 0;
    }
    
    .nav-toggle.active .bar:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
    }
    
    .nav-toggle.active .bar:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
    }
`;
document.head.appendChild(style);

// File Upload Feedback
document.addEventListener('DOMContentLoaded', function() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const label = this.parentNode.querySelector('.file-upload-label span');
            if (this.files && this.files.length > 0) {
                label.textContent = `Selected: ${this.files[0].name}`;
                label.style.color = '#2563eb';
            } else {
                label.textContent = label.getAttribute('data-original') || 'Choose file';
                label.style.color = '#64748b';
            }
        });
        
        // Store original text
        const label = input.parentNode.querySelector('.file-upload-label span');
        if (label) {
            label.setAttribute('data-original', label.textContent);
        }
    });
});

// Smooth Scrolling for Anchor Links
document.addEventListener('DOMContentLoaded', function() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});

// WhatsApp Integration (Placeholder)
function openWhatsApp(message = '') {
    const phoneNumber = '+255XXXXXXXXX'; // Replace with actual WhatsApp number
    const defaultMessage = message || 'Hello, I would like to inquire about your vehicle transit services.';
    const encodedMessage = encodeURIComponent(defaultMessage);
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    window.open(whatsappURL, '_blank');
}

// Add WhatsApp functionality to buttons
document.addEventListener('DOMContentLoaded', function() {
    const whatsappButtons = document.querySelectorAll('a[href="#"]');
    
    whatsappButtons.forEach(button => {
        if (button.innerHTML.includes('whatsapp') || button.innerHTML.includes('WhatsApp')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                let message = 'Hello, I would like to inquire about your vehicle transit services.';
                
                // Customize message based on page context
                if (window.location.pathname.includes('become-driver')) {
                    message = 'Hello, I am interested in becoming a driver with Manyanza. Can you provide more information?';
                } else if (window.location.pathname.includes('services')) {
                    message = 'Hello, I would like to get a quote for vehicle transit services.';
                }
                
                openWhatsApp(message);
            });
        }
    });
});

// Loading States for Forms
function setFormLoading(form, isLoading) {
    const submitButton = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, select, textarea');
    
    if (isLoading) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        inputs.forEach(input => input.disabled = true);
    } else {
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.getAttribute('data-original-text') || 'Submit';
        inputs.forEach(input => input.disabled = false);
    }
}

// Initialize form button text storage
document.addEventListener('DOMContentLoaded', function() {
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    submitButtons.forEach(button => {
        button.setAttribute('data-original-text', button.textContent);
    });
});

// Simple Analytics (Page Views)
document.addEventListener('DOMContentLoaded', function() {
    // Track page view (in a real application, you would send this to your analytics service)
    const pageData = {
        page: window.location.pathname,
        title: document.title,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
    
    // Store in localStorage for now (replace with actual analytics)
    const visits = JSON.parse(localStorage.getItem('manyanza_visits') || '[]');
    visits.push(pageData);
    localStorage.setItem('manyanza_visits', JSON.stringify(visits.slice(-50))); // Keep last 50 visits
});

// Print functionality
function printPage() {
    window.print();
}

// Share functionality
function sharePage() {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            text: 'Check out Manyanza - Tanzania\'s trusted vehicle transit service',
            url: window.location.href
        });
    } else {
        // Fallback to copying URL
        navigator.clipboard.writeText(window.location.href).then(() => {
            showNotification('Page URL copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Unable to copy URL. Please copy manually: ' + window.location.href, 'info');
        });
    }
}