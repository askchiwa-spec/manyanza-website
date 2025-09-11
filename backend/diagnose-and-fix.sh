#!/bin/bash

echo "🔍 MANYANZA WEBHOOK DIAGNOSTIC SCRIPT"
echo "===================================="

# Check Node.js and npm
echo "1. Checking Node.js and npm..."
node --version || echo "❌ Node.js not found"
npm --version || echo "❌ npm not found"

# Check if dependencies are installed
echo ""
echo "2. Checking dependencies..."
cd "/Users/baamrecs/Driver website/backend"
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    npm list express twilio 2>/dev/null || echo "⚠️  Some dependencies missing"
else
    echo "❌ package.json not found"
fi

# Check what's running on port 4000
echo ""
echo "3. Checking port 4000..."
lsof -i :4000 || echo "✅ Port 4000 is free"

# Check ngrok installation
echo ""
echo "4. Checking ngrok..."
which ngrok || echo "❌ ngrok not found in PATH"
ngrok version 2>/dev/null || echo "⚠️  ngrok version check failed"

# Kill any existing processes
echo ""
echo "5. Cleaning up existing processes..."
pkill -f "node.*webhook" || echo "ℹ️  No webhook processes to kill"
pkill ngrok || echo "ℹ️  No ngrok processes to kill"

# Install dependencies if needed
echo ""
echo "6. Installing dependencies..."
npm install express twilio

# Start the diagnostic server
echo ""
echo "7. Starting diagnostic webhook server..."
echo "📡 Starting server on port 4000..."
node diagnostic-webhook.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Test local connectivity
echo ""
echo "8. Testing local connectivity..."
curl -s "http://localhost:4000/health" | head -5 || echo "❌ Local server not responding"

# Start ngrok
echo ""
echo "9. Starting ngrok tunnel..."
ngrok http 4000 --log=stdout &
NGROK_PID=$!

# Wait for ngrok to start
sleep 5

# Get ngrok URL
echo ""
echo "10. Getting ngrok URL..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*' | head -1)

if [ ! -z "$NGROK_URL" ]; then
    echo "✅ Ngrok tunnel active:"
    echo "🌐 Public URL: $NGROK_URL"
    echo "📱 Webhook URL: $NGROK_URL/whatsapp"
    echo "🔗 Health check: $NGROK_URL/health"
    echo ""
    echo "🎯 COPY THIS URL TO TWILIO:"
    echo "$NGROK_URL/whatsapp"
else
    echo "❌ Could not get ngrok URL"
fi

echo ""
echo "🔧 DIAGNOSTIC COMPLETE"
echo "====================="
echo "Server PID: $SERVER_PID"
echo "Ngrok PID: $NGROK_PID"
echo ""
echo "To stop servers:"
echo "kill $SERVER_PID $NGROK_PID"
echo ""
echo "Monitor logs in terminal..."