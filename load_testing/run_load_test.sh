#!/bin/bash

# Chatify Load Test Runner
# Usage: ./run_load_test.sh [users] [duration] [ramp-up]

USERS=${1:-100}
DURATION=${2:-60}
RAMP_UP=${3:-10}
MESSAGES=${4:-20}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Chatify Load Test"
echo "===================="
echo "Users: $USERS"
echo "Duration: ${DURATION}s"
echo "Ramp-up: ${RAMP_UP}s"
echo "Messages per user: $MESSAGES"
echo ""

# Check for Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python3."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
python3 -m pip install -q -r "$SCRIPT_DIR/requirements.txt" 2>/dev/null || pip3 install -q -r "$SCRIPT_DIR/requirements.txt"

# Run the load test
echo "🏃 Starting load test..."
echo ""

cd "$SCRIPT_DIR"
python3 websocket_load_test.py \
    --users $USERS \
    --duration $DURATION \
    --ramp-up $RAMP_UP \
    --messages $MESSAGES \
    --host localhost \
    --port 8080

echo ""
echo "✅ Load test completed!"
echo ""
echo "📊 View metrics at:"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001 (admin/admin)"
