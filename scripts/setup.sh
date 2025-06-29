#!/bin/bash

# MulaERP Setup Script
echo "Setting up MulaERP..."

# Create necessary directories
mkdir -p nginx/ssl
mkdir -p config
mkdir -p logs

# Generate SSL certificates for development (self-signed)
if [ ! -f nginx/ssl/cert.pem ]; then
    echo "Generating self-signed SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=MulaERP/CN=localhost"
fi

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file. Please update with your configuration."
fi

# Generate random secrets
if [ ! -f .env.secrets ]; then
    echo "Generating random secrets..."
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    REDIS_PASSWORD=$(openssl rand -base64 16)
    
    cat > .env.secrets << EOF
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF
    echo "Generated secrets in .env.secrets"
fi

# Set permissions
chmod 600 .env.secrets
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem

echo "Setup complete!"
echo "Run 'docker-compose up -d' to start MulaERP"