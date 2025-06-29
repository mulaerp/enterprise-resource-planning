#!/bin/bash

# MulaERP Backup Script
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup in $BACKUP_DIR..."

# Backup DynamoDB data
docker-compose exec dynamodb-local aws dynamodb scan \
    --table-name mulaerp-config \
    --endpoint-url http://localhost:8000 \
    --region us-east-1 > "$BACKUP_DIR/config.json"

# Backup Valkey data
docker-compose exec valkey valkey-cli --rdb /data/backup.rdb
docker cp $(docker-compose ps -q valkey):/data/backup.rdb "$BACKUP_DIR/cache.rdb"

# Backup application logs
docker-compose logs > "$BACKUP_DIR/application.log"

# Create archive
tar -czf "$BACKUP_DIR.tar.gz" -C "$BACKUP_DIR" .
rm -rf "$BACKUP_DIR"

echo "Backup created: $BACKUP_DIR.tar.gz"