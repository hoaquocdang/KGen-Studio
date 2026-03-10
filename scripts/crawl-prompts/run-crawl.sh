#!/bin/bash
# ============================================================
# KGen Gallery — Auto Crawl & Deploy Script
# 
# This script is designed to run as a cron job on the VPS.
# It crawls new prompts, updates the gallery JSON, and
# optionally rebuilds the Docker container.
#
# SETUP:
#   1. Copy this script to the VPS
#   2. chmod +x /opt/kgen-gallery/scripts/crawl-prompts/run-crawl.sh
#   3. Add to crontab:
#      crontab -e
#      # Run every 6 hours
#      0 */6 * * * /opt/kgen-gallery/scripts/crawl-prompts/run-crawl.sh >> /var/log/kgen-crawl.log 2>&1
#
# ENVIRONMENT:
#   Set these in /opt/kgen-gallery/.env or export before running
# ============================================================

set -euo pipefail

# ---- Configuration ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="/var/log/kgen-crawl.log"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Defaults
export APIFY_TOKEN="${APIFY_TOKEN:-}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export PROMPTS_JSON_PATH="${PROMPTS_JSON_PATH:-$PROJECT_DIR/web-ui/data/trending-prompts.json}"
export IMAGE_BASE_URL="${IMAGE_BASE_URL:-https://images.meigen.ai/tweets}"
export IMAGE_DOWNLOAD_DIR="${IMAGE_DOWNLOAD_DIR:-$PROJECT_DIR/web-ui/data/images}"

# ---- Pre-checks ----
echo "=========================================="
echo "KGen Prompt Crawl — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

if [ -z "$APIFY_TOKEN" ]; then
    echo "❌ ERROR: APIFY_TOKEN is not set!"
    echo "   Set it in $PROJECT_DIR/.env or export APIFY_TOKEN=..."
    exit 1
fi

# ---- Ensure dependencies ----
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# ---- Run crawler ----
echo "🚀 Starting crawl..."
node crawl.js --since 3

# ---- Restart Docker if needed ----
PROMPTS_FILE="$PROMPTS_JSON_PATH"
if [ -f "$PROMPTS_FILE" ]; then
    # Check if file was modified in the last 5 minutes
    MODIFIED=$(find "$PROMPTS_FILE" -mmin -5 2>/dev/null)
    if [ -n "$MODIFIED" ]; then
        echo "📦 Prompts updated. Restarting container..."
        cd "$PROJECT_DIR"
        docker compose restart web 2>/dev/null || docker restart kgen-gallery-web 2>/dev/null || true
        echo "✅ Container restarted"
    else
        echo "ℹ️ No new prompts. Skipping restart."
    fi
fi

echo ""
echo "✅ Crawl complete — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
