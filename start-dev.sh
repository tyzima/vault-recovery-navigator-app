#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}🚀 Starting Vault Recovery Navigator development environment...${NC}"
echo -e "${YELLOW}📁 Working from: ${SCRIPT_DIR}${NC}"

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${YELLOW}📦 Cleaning up processes...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# Trap cleanup on script exit
trap cleanup EXIT

# Start backend server
echo -e "${GREEN}🔧 Starting backend server on port 3001...${NC}"
cd "${SCRIPT_DIR}/server" && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend dev server
echo -e "${GREEN}🎨 Starting frontend dev server on port 8080...${NC}"
cd "${SCRIPT_DIR}"
npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Start Caddy proxy
echo -e "${GREEN}🌐 Starting Caddy reverse proxy...${NC}"
cd "${SCRIPT_DIR}"
caddy run --config Caddyfile &
CADDY_PID=$!

echo -e "${GREEN}✅ All services started!${NC}"
echo -e "${GREEN}🌍 Your app is now available at: ${YELLOW}https://runbooks.local${NC}"
echo -e "${GREEN}📊 Backend API: ${YELLOW}https://runbooks.local/api${NC}"
echo -e "${GREEN}🛑 Press Ctrl+C to stop all services${NC}"

# Wait for all background processes
wait 