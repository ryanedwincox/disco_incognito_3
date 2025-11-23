#!/bin/bash
set -e

# Disco Incognito - One-time setup script
# Run this once after cloning the repository

echo "Setting up Disco Incognito..."

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || { echo "Error: docker-compose is required but not installed."; exit 1; }

# Create backend .env from example if it doesn't exist
if [ ! -f backend/.env ]; then
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        echo "Created backend/.env from .env.example"
    else
        echo "Warning: backend/.env.example not found, skipping .env creation"
    fi
else
    echo "backend/.env already exists, skipping"
fi

# Create data directory if it doesn't exist
mkdir -p data
if [ ! -f data/disco_incognito.json ]; then
    echo "{}" > data/disco_incognito.json
    echo "Created data/disco_incognito.json"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm ci
cd ..

# Build docker images
echo "Building docker images..."
docker-compose -f docker-compose.dev.yml build

echo ""
echo "Setup complete! Run ./run.sh to start the development environment."
