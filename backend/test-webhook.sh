#!/bin/bash

echo "🧪 Testing Manyanza WhatsApp Webhook System..."
echo ""

# Test if server is running
echo "1. Testing webhook server health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Webhook server is running!"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "❌ Webhook server not running on port 3000"
    echo "   Run: node webhook-server.js"
fi

echo ""

# Test WhatsApp webhook endpoint
echo "2. Testing WhatsApp webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3000/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255765111131&To=whatsapp:+14155238886&Body=test&MessageSid=TEST123" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ WhatsApp webhook responding!"
    echo "   TwiML Response received"
else
    echo "❌ WhatsApp webhook not responding"
fi

echo ""

# Check if ngrok is running
echo "3. Checking ngrok tunnel..."
NGROK_STATUS=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok\.io')
if [ $? -eq 0 ]; then
    echo "✅ ngrok tunnel active!"
    echo "   Public URL: $NGROK_STATUS"
    echo "   Configure Twilio webhook to: $NGROK_STATUS/whatsapp"
else
    echo "❌ ngrok not running"
    echo "   Run: ngrok http 3000"
fi

echo ""

# Test different message types
echo "4. Testing different message types..."

# Test booking message
curl -s -X POST http://localhost:3000/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255765111131&To=whatsapp:+14155238886&Body=book&MessageSid=TEST124" > /dev/null

echo "✅ Booking message test sent"

# Test help message
curl -s -X POST http://localhost:3000/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255765111131&To=whatsapp:+14155238886&Body=help&MessageSid=TEST125" > /dev/null

echo "✅ Help message test sent"

echo ""
echo "🎯 Next Steps:"
echo "1. Copy ngrok HTTPS URL above"
echo "2. Go to Twilio Console > Messaging > Try WhatsApp > Sandbox Settings"
echo "3. Set 'When a message comes in' to: YOUR_NGROK_URL/whatsapp"
echo "4. Send WhatsApp message to sandbox number to test!"
echo ""
echo "📱 Your business WhatsApp: +255765111131"
echo "🔧 Debug endpoint: http://localhost:3000/debug/last-request"