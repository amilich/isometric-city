#!/bin/bash

echo "📦 Installing dependencies from scratch..."
npm install

echo "🏗️ Building project..."
npm run build

echo "🔄 Restarting PM2 service (mycity)..."
# If a service named 'mycity' exists, restart it; otherwise continue without error or create it
if pm2 list | grep -q "mycity"; then
    pm2 restart mycity
    echo "✅ PM2 service restarted."
else
    echo "⚠️ No running PM2 service named 'mycity' found."
    echo "To start the service: pm2 start npm --name 'mycity' -- start"
fi

echo "✨ Process completed successfully!"

