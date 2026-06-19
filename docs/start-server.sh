#!/bin/bash

# dToken Dashboard - Local Server Launcher
# This script starts a simple HTTP server to run the dashboard

PORT=8000
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting dToken Dashboard..."
echo "Serving from: $DIR"
echo "Server will be available at: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    cd "$DIR" && python3 -m http.server $PORT
# Fallback to Python 2
elif command -v python &> /dev/null; then
    cd "$DIR" && python -m SimpleHTTPServer $PORT
# Try Node.js http-server if available
elif command -v npx &> /dev/null; then
    echo "Using npx http-server..."
    cd "$DIR" && npx -y http-server -p $PORT
else
    echo "Error: No suitable HTTP server found."
    echo "Please install Python or Node.js to run this server."
    exit 1
fi
