#!/bin/bash

# Manyanza Backend Setup Script
# This script sets up the complete backend infrastructure

echo "🚗 Setting up Manyanza Backend API..."
echo "=================================="

# Check Node.js version
echo "📋 Checking requirements..."
node_version=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js: $node_version"
else
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is available
npm_version=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ npm: $npm_version"
else
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p data
mkdir -p uploads/drivers
mkdir -p uploads/payments
mkdir -p logs

echo "✅ Directories created"

# Check if .env exists, if not copy from template
if [ ! -f ".env" ]; then
    echo ""
    echo "⚙️  Creating environment configuration..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created from template"
        echo "⚠️  Please edit .env file with your Twilio credentials before starting"
    else
        echo "❌ .env.example not found. Please create .env manually"
    fi
else
    echo "✅ .env file already exists"
fi

# Initialize database
echo ""
echo "🗄️  Initializing database..."
node -e "
const Database = require('./database/db');
const db = new Database();
db.initialize().then(() => {
    console.log('✅ Database initialized successfully');
    process.exit(0);
}).catch(err => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
});
"

if [ $? -ne 0 ]; then
    echo "❌ Database initialization failed"
    exit 1
fi

# Set correct permissions
echo ""
echo "🔒 Setting permissions..."
chmod 755 data
chmod 755 uploads
chmod -R 755 uploads/*
chmod 600 .env 2>/dev/null || true

echo "✅ Permissions set correctly"

# Run basic tests
echo ""
echo "🧪 Running basic tests..."

# Test database connection
node -e "
const Database = require('./database/db');
const db = new Database();
console.log('✅ Database connection test passed');
db.close();
"

if [ $? -ne 0 ]; then
    echo "❌ Database connection test failed"
    exit 1
fi

# Check if all required files exist
echo ""
echo "📋 Verifying installation..."

required_files=(
    "server.js"
    "package.json"
    "database/db.js"
    "routes/webhooks.js"
    "routes/admin.js"
    "routes/bookings.js"
    "routes/drivers.js"
    "routes/payments.js"
    "routes/notifications.js"
    "services/whatsappBot.js"
    "services/pricingCalculator.js"
    "services/notificationService.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        exit 1
    fi
done

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your Twilio credentials:"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_AUTH_TOKEN"
echo "   - TWILIO_WHATSAPP_NUMBER=whatsapp:+255765111131"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. Start production server:"
echo "   npm start"
echo ""
echo "4. Configure Twilio webhooks:"
echo "   - Webhook URL: https://your-domain.com/api/webhooks/twilio"
echo "   - Status Callback: https://your-domain.com/api/webhooks/status"
echo ""
echo "5. Test the API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "📖 Read the documentation:"
echo "   - README.md - Complete API documentation"
echo "   - TWILIO_SETUP.md - Twilio configuration guide"
echo ""
echo "🚗 Your Manyanza backend is ready for action!"