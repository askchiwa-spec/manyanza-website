#!/bin/bash

echo "🚀 Setting up Manyanza WhatsApp Webhook Server..."

# Copy webhook package.json
cp webhook-package.json package-webhook.json

# Install dependencies for webhook
echo "📦 Installing dependencies..."
npm init -y
npm install express twilio dotenv nodemon

# Copy environment file
cp webhook.env .env

echo "✅ Webhook server setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Run the server: node webhook-server.js"
echo "2. In another terminal, install ngrok: brew install ngrok"
echo "3. Run ngrok: ngrok http 3000"
echo "4. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "5. Go to Twilio Console > Messaging > Try WhatsApp > Sandbox Settings"
echo "6. Set webhook URL to: https://your-ngrok-url.ngrok.io/whatsapp"
echo "7. Test by sending WhatsApp messages to the sandbox number!"
echo ""
echo "📱 Your WhatsApp number: +255765111131"
echo "🌐 Server will run on: http://localhost:3000"
echo "📋 Health check: http://localhost:3000/health"