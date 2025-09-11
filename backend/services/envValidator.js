const fs = require('fs');
const path = require('path');

class EnvironmentValidator {
    constructor() {
        this.requiredVars = [
            'JWT_SECRET',
            'REFRESH_SECRET',
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_WHATSAPP_NUMBER'
        ];
        
        this.optionalVars = [
            'PORT',
            'NODE_ENV',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'SESSION_SECRET'
        ];
        
        this.securityRequirements = {
            'JWT_SECRET': { minLength: 32, pattern: /^[A-Za-z0-9+/=_-]+$/ },
            'REFRESH_SECRET': { minLength: 32, pattern: /^[A-Za-z0-9+/=_-]+$/ },
            'TWILIO_ACCOUNT_SID': { pattern: /^AC[a-f0-9]{32}$/i },
            'TWILIO_AUTH_TOKEN': { minLength: 32 },
            'TWILIO_WHATSAPP_NUMBER': { pattern: /^\+\d{10,15}$/ }
        };
    }

    // Validate all environment variables
    validateEnvironment() {
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            summary: {
                required: { total: this.requiredVars.length, valid: 0, missing: 0 },
                optional: { total: this.optionalVars.length, present: 0 },
                security: { passed: 0, failed: 0 }
            }
        };

        // Check required variables
        this.requiredVars.forEach(varName => {
            const value = process.env[varName];
            if (!value) {
                results.valid = false;
                results.errors.push(`Missing required environment variable: ${varName}`);
                results.summary.required.missing++;
            } else {
                results.summary.required.valid++;
                
                // Validate security requirements
                const requirement = this.securityRequirements[varName];
                if (requirement) {
                    const securityResult = this.validateSecurityRequirement(varName, value, requirement);
                    if (!securityResult.valid) {
                        results.valid = false;
                        results.errors.push(...securityResult.errors);
                        results.summary.security.failed++;
                    } else {
                        results.summary.security.passed++;
                        if (securityResult.warnings.length > 0) {
                            results.warnings.push(...securityResult.warnings);
                        }
                    }
                }
            }
        });

        // Check optional variables
        this.optionalVars.forEach(varName => {
            if (process.env[varName]) {
                results.summary.optional.present++;
                
                // Additional checks for specific optional vars
                if (varName === 'NODE_ENV' && !['development', 'production', 'test'].includes(process.env[varName])) {
                    results.warnings.push(`NODE_ENV should be 'development', 'production', or 'test', got: ${process.env[varName]}`);
                }
                
                if (varName === 'PORT') {
                    const port = parseInt(process.env[varName]);
                    if (isNaN(port) || port < 1 || port > 65535) {
                        results.warnings.push(`PORT should be a valid port number (1-65535), got: ${process.env[varName]}`);
                    }
                }
            }
        });

        // Additional security checks
        this.performAdditionalSecurityChecks(results);

        return results;
    }

    // Validate individual security requirement
    validateSecurityRequirement(varName, value, requirement) {
        const result = { valid: true, errors: [], warnings: [] };

        // Check minimum length
        if (requirement.minLength && value.length < requirement.minLength) {
            result.valid = false;
            result.errors.push(`${varName} must be at least ${requirement.minLength} characters long`);
        }

        // Check pattern
        if (requirement.pattern && !requirement.pattern.test(value)) {
            result.valid = false;
            result.errors.push(`${varName} format is invalid`);
        }

        // Security-specific warnings
        if (varName.includes('SECRET')) {
            if (value.length < 64) {
                result.warnings.push(`${varName} should be at least 64 characters for enhanced security`);
            }
            
            if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
                result.warnings.push(`${varName} should contain uppercase, lowercase, and numeric characters`);
            }
            
            // Check for common weak secrets
            const weakSecrets = ['secret', 'password', '123456', 'your-secret-key', 'your-refresh-secret-key'];
            if (weakSecrets.some(weak => value.toLowerCase().includes(weak.toLowerCase()))) {
                result.valid = false;
                result.errors.push(`${varName} appears to contain a default or weak value`);
            }
        }

        return result;
    }

    // Additional security checks
    performAdditionalSecurityChecks(results) {
        // Check if running in production with development settings
        if (process.env.NODE_ENV === 'production') {
            if (process.env.JWT_SECRET === process.env.REFRESH_SECRET) {
                results.warnings.push('JWT_SECRET and REFRESH_SECRET should be different in production');
            }
            
            if (!process.env.HTTPS) {
                results.warnings.push('HTTPS should be enabled in production');
            }
        }

        // Check file permissions for .env file
        try {
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                const stats = fs.statSync(envPath);
                const mode = (stats.mode & parseInt('777', 8)).toString(8);
                if (mode !== '600' && mode !== '644') {
                    results.warnings.push('.env file should have restrictive permissions (600 or 644)');
                }
            }
        } catch (error) {
            results.warnings.push('Could not check .env file permissions');
        }

        // Check for .env.example
        try {
            const envExamplePath = path.join(process.cwd(), '.env.example');
            if (!fs.existsSync(envExamplePath)) {
                results.warnings.push('.env.example file is missing for development reference');
            }
        } catch (error) {
            // Ignore error
        }
    }

    // Generate environment report
    generateReport() {
        const validation = this.validateEnvironment();
        
        console.log('\n🔒 Environment Validation Report');
        console.log('================================');
        
        if (validation.valid) {
            console.log('✅ Environment validation passed');
        } else {
            console.log('❌ Environment validation failed');
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   Required variables: ${validation.summary.required.valid}/${validation.summary.required.total} valid`);
        console.log(`   Optional variables: ${validation.summary.optional.present}/${validation.summary.optional.total} present`);
        console.log(`   Security checks: ${validation.summary.security.passed}/${validation.summary.security.passed + validation.summary.security.failed} passed`);
        
        if (validation.errors.length > 0) {
            console.log('\n❌ Errors:');
            validation.errors.forEach(error => console.log(`   • ${error}`));
        }
        
        if (validation.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            validation.warnings.forEach(warning => console.log(`   • ${warning}`));
        }
        
        console.log('');
        return validation;
    }

    // Create .env.example template
    createEnvExample() {
        const template = `# Manyanza Backend Environment Configuration
# Copy this file to .env and fill in your actual values

# JWT Configuration (Generate secure random strings)
JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long
REFRESH_SECRET=your-refresh-secret-key-different-from-jwt-secret

# Server Configuration
PORT=3000
NODE_ENV=development

# Twilio Configuration (WhatsApp Business API)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890

# Google OAuth (Optional - for social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Session Configuration
SESSION_SECRET=your-session-secret-key

# Security Settings
ROTATE_REFRESH_TOKENS=true
HTTPS=true
`;

        const envExamplePath = path.join(process.cwd(), '.env.example');
        
        try {
            fs.writeFileSync(envExamplePath, template);
            console.log('✅ Created .env.example template');
            return true;
        } catch (error) {
            console.error('❌ Failed to create .env.example:', error.message);
            return false;
        }
    }

    // Generate secure secrets
    generateSecrets() {
        const crypto = require('crypto');
        
        const secrets = {
            JWT_SECRET: crypto.randomBytes(64).toString('base64'),
            REFRESH_SECRET: crypto.randomBytes(64).toString('base64'),
            SESSION_SECRET: crypto.randomBytes(32).toString('base64')
        };
        
        console.log('\n🔐 Generated Secure Secrets:');
        console.log('============================');
        Object.entries(secrets).forEach(([key, value]) => {
            console.log(`${key}=${value}`);
        });
        console.log('\n⚠️  Store these securely and never commit them to version control!');
        
        return secrets;
    }

    // Initialize environment setup
    initializeEnvironment() {
        console.log('\n🚀 Initializing Manyanza Environment Setup');
        console.log('==========================================');
        
        // Create .env.example if it doesn't exist
        this.createEnvExample();
        
        // Generate secure secrets
        const secrets = this.generateSecrets();
        
        // Validate current environment
        const validation = this.generateReport();
        
        return {
            validation,
            secrets,
            recommendations: this.getRecommendations(validation)
        };
    }

    // Get setup recommendations
    getRecommendations(validation) {
        const recommendations = [];
        
        if (!validation.valid) {
            recommendations.push('Fix all environment variable errors before running in production');
        }
        
        if (validation.warnings.length > 0) {
            recommendations.push('Address security warnings to improve system security');
        }
        
        if (process.env.NODE_ENV === 'production') {
            recommendations.push('Enable HTTPS in production');
            recommendations.push('Use environment-specific secrets');
            recommendations.push('Regularly rotate JWT secrets');
            recommendations.push('Monitor environment variables for security issues');
        }
        
        return recommendations;
    }
}

module.exports = EnvironmentValidator;