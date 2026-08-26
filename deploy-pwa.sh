#!/bin/bash
# Pingo - PWA Local Deployment Script
# Usage: ./deploy-pwa.sh [version_bump]

set -e

# Configuration
TARGET_USER="jose"
TARGET_IP="192.168.1.3"
TARGET_DIR="/home/jose/pingo-pwa"
FINAL_DIR="/var/www/accreativos/pingo"
TEMP_DIR="/tmp/pingo_deploy_$(date +%s)"

echo "🚀 Starting Pingo PWA Deployment..."

# 1. Build the PWA
echo "🏗️  Building PWA..."
npm run build

# 2. Deploy via SCP
echo "📤 Transferring files to $TARGET_IP..."
ssh "$TARGET_USER@$TARGET_IP" "mkdir -p $TARGET_DIR"
scp -r dist/* "$TARGET_USER@$TARGET_IP:$TARGET_DIR/"

# 3. Final Copy to Web Server Destination
echo "📂 Moving files to production directory: $FINAL_DIR..."
ssh "$TARGET_USER@$TARGET_IP" "mkdir -p $FINAL_DIR && cp -R $TARGET_DIR/* $FINAL_DIR/"

echo "✅ Deployment complete! PWA is live at jose@$TARGET_IP:$FINAL_DIR"
