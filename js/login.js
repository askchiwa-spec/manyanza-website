// Tab switching functionality
document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and forms
        document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding form
        const role = tab.dataset.role;
        document.getElementById(role + 'Form').classList.add('active');
    });
});

// Handle page load - check URL parameters and set up form handlers
document.addEventListener('DOMContentLoaded', function() {
    // Check URL parameters for error messages and role
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const role = urlParams.get('role');
    const redirect = urlParams.get('redirect');

    // Switch to specific role tab if specified
    if (role && ['client', 'driver', 'admin'].includes(role)) {
        document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
        
        const tabElement = document.querySelector(`[data-role="${role}"]`);
        if (tabElement) {
            tabElement.classList.add('active');
            document.getElementById(role + 'Form').classList.add('active');
        }
    }

    // Display error messages
    if (error) {
        showAlert(getErrorMessage(error), 'error');
    }

    // Set up form submission handlers
    document.getElementById('clientLoginForm').addEventListener('submit', handleStaticLogin);
    document.getElementById('driverLoginForm').addEventListener('submit', handleStaticLogin);
    document.getElementById('adminLoginForm').addEventListener('submit', handleStaticLogin);
});

// Simplified login handler for static website demo
function handleStaticLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const role = form.closest('.login-form').id.replace('Form', '');
    
    // Show loading
    showLoading();
    
    // Simulate login process for demo purposes
    setTimeout(() => {
        // For static demo, we'll just redirect to dashboard
        showAlert('Login successful! Redirecting...', 'success');
        
        // Set demo flag for admin
        if (role === 'admin') {
            localStorage.setItem('isAdminDemo', 'true');
        }
        
        // Redirect based on role
        setTimeout(() => {
            // Get redirect parameter from URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');
            
            let redirectPath = redirect || getDashboardPath(role);
            // For static version, redirect to HTML files
            if (redirectPath.startsWith('/')) {
                redirectPath = redirectPath.substring(1);
            }
            // Ensure .html extension
            if (!redirectPath.endsWith('.html')) {
                redirectPath += '.html';
            }
            window.location.href = redirectPath;
        }, 1500);
    }, 1000);
}

function getDashboardPath(role) {
    switch (role) {
        case 'client': return 'client-dashboard';
        case 'driver': return 'driver-dashboard';
        case 'admin': return 'admin-dashboard';
        default: return 'dashboard';
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = type === 'error' ? 'alert-error' : 
                      type === 'success' ? 'alert-success' : 'alert-info';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 3000);
    }
}

function showLoading() {
    document.getElementById('loading').classList.add('show');
    document.querySelectorAll('.login-btn').forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Signing in...';
    });
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
    document.querySelectorAll('.login-btn').forEach(btn => {
        btn.disabled = false;
        // Reset button text based on form
        const form = btn.closest('.login-form');
        if (form.id === 'clientForm') btn.textContent = 'Sign In as Client';
        else if (form.id === 'driverForm') btn.textContent = 'Sign In as Driver';
        else if (form.id === 'adminForm') btn.textContent = 'Sign In as Admin';
    });
}

function getErrorMessage(error) {
    switch (error) {
        case 'invalid_credentials':
            return 'Invalid email/phone or password. Please try again.';
        case 'account_not_approved':
            return 'Your driver account is pending approval. Please contact support.';
        case 'account_suspended':
            return 'Your account has been suspended. Please contact support.';
        case 'token_expired':
            return 'Your session has expired. Please sign in again.';
        case 'access_denied':
            return 'Access denied. Please check your credentials.';
        default:
            return 'An error occurred during authentication. Please try again.';
    }
}

// Simplified authentication check for static website
// In a real implementation, this would check with the backend
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('authToken');
    if (token) {
        // For static demo, we'll just check if token exists
        // In a real app, this would validate with backend
        console.log('User appears to be logged in (demo mode)');
        // Uncomment the lines below if you want to auto-redirect when token exists
        /*
        const redirectPath = redirect || 'dashboard.html';
        window.location.href = redirectPath;
        */
    }
});