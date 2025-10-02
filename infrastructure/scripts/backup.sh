#!/bin/bash
# lapa-casa-hostel/infrastructure/scripts/backup.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="${DB_CONTAINER:-lapa-postgres}"
DB_NAME="${DB_NAME:-lapa_channel_manager}"
DB_USER="${DB_USER:-lapacasa}"
REDIS_CONTAINER="${REDIS_CONTAINER:-lapa-redis}"

echo -e "${GREEN}🔄 Starting backup process${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"
echo -e "${BLUE}Backup Directory: ${BACKUP_DIR}${NC}"

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

# Backup PostgreSQL database
echo -e "${YELLOW}📦 Backing up PostgreSQL database...${NC}"
POSTGRES_BACKUP_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${TIMESTAMP}.sql"

# Check if container exists and is running
if ! docker ps | grep -q "${DB_CONTAINER}"; then
    echo -e "${RED}❌ PostgreSQL container ${DB_CONTAINER} is not running${NC}"
    exit 1
fi

# Create database dump
docker exec -t "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v > "${POSTGRES_BACKUP_FILE}"

if [ $? -eq 0 ]; then
    # Compress backup
    gzip "${POSTGRES_BACKUP_FILE}"
    POSTGRES_BACKUP_FILE="${POSTGRES_BACKUP_FILE}.gz"
    
    BACKUP_SIZE=$(du -h "${POSTGRES_BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✅ PostgreSQL backup completed${NC}"
    echo -e "${GREEN}   File: ${POSTGRES_BACKUP_FILE}${NC}"
    echo -e "${GREEN}   Size: ${BACKUP_SIZE}${NC}"
else
    echo -e "${RED}❌ PostgreSQL backup failed${NC}"
    exit 1
fi

# Backup Redis data
echo -e "${YELLOW}📦 Backing up Redis data...${NC}"
REDIS_BACKUP_FILE="${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

if docker ps | grep -q "${REDIS_CONTAINER}"; then
    # Force Redis to save
    docker exec "${REDIS_CONTAINER}" redis-cli SAVE > /dev/null 2>&1
    
    # Copy RDB file
    docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${REDIS_BACKUP_FILE}" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        gzip "${REDIS_BACKUP_FILE}"
        REDIS_BACKUP_FILE="${REDIS_BACKUP_FILE}.gz"
        
        REDIS_SIZE=$(du -h "${REDIS_BACKUP_FILE}" | cut -f1)
        echo -e "${GREEN}✅ Redis backup completed${NC}"
        echo -e "${GREEN}   File: ${REDIS_BACKUP_FILE}${NC}"
        echo -e "${GREEN}   Size: ${REDIS_SIZE}${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis backup failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Redis container not running, skipping backup${NC}"
fi

# Backup application uploads
echo -e "${YELLOW}📦 Backing up application uploads...${NC}"
UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
UPLOADS_PATH="/app/uploads"

if docker exec lapa-app test -d "${UPLOADS_PATH}" 2>/dev/null; then
    docker exec lapa-app tar -czf - "${UPLOADS_PATH}" > "${UPLOADS_BACKUP_FILE}"
    
    if [ $? -eq 0 ]; then
        UPLOADS_SIZE=$(du -h "${UPLOADS_BACKUP_FILE}" | cut -f1)
        echo -e "${GREEN}✅ Uploads backup completed${NC}"
        echo -e "${GREEN}   File: ${UPLOADS_BACKUP_FILE}${NC}"
        echo -e "${GREEN}   Size: ${UPLOADS_SIZE}${NC}"
    else
        echo -e "${YELLOW}⚠️  Uploads backup failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No uploads directory found${NC}"
fi

# Backup environment files
echo -e "${YELLOW}📦 Backing up configuration files...${NC}"
CONFIG_BACKUP_FILE="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

tar -czf "${CONFIG_BACKUP_FILE}" \
    -C "${PROJECT_ROOT}" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='build' \
    infrastructure/docker-compose.prod.yml \
    .env.production \
    2>/dev/null || true

if [ -f "${CONFIG_BACKUP_FILE}" ]; then
    CONFIG_SIZE=$(du -h "${CONFIG_BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✅ Configuration backup completed${NC}"
    echo -e "${GREEN}   File: ${CONFIG_BACKUP_FILE}${NC}"
    echo -e "${GREEN}   Size: ${CONFIG_SIZE}${NC}"
fi

# Create backup manifest
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"
cat > "${MANIFEST_FILE}" << EOF
========================================
Lapa Casa Hostel - Backup Manifest
========================================
Timestamp: ${TIMESTAMP}
Date: $(date '+%Y-%m-%d %H:%M:%S')
Hostname: $(hostname)
User: ${USER}

Backup Files:
----------------------------------------
PostgreSQL: $(basename ${POSTGRES_BACKUP_FILE})
Redis: $(basename ${REDIS_BACKUP_FILE})
Uploads: $(basename ${UPLOADS_BACKUP_FILE})
Config: $(basename ${CONFIG_BACKUP_FILE})

Database Information:
----------------------------------------
Database Name: ${DB_NAME}
Database User: ${DB_USER}
Container: ${DB_CONTAINER}

Backup Location:
----------------------------------------
Directory: ${BACKUP_DIR}

Status: SUCCESS
========================================
EOF

echo -e "${GREEN}✅ Manifest created: ${MANIFEST_FILE}${NC}"

# Verify backups
echo -e "${YELLOW}🔍 Verifying backups...${NC}"
VERIFICATION_PASSED=true

# Verify PostgreSQL backup
if [ -f "${POSTGRES_BACKUP_FILE}" ]; then
    if gzip -t "${POSTGRES_BACKUP_FILE}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL backup verified${NC}"
    else
        echo -e "${RED}❌ PostgreSQL backup verification failed${NC}"
        VERIFICATION_PASSED=false
    fi
fi

# Verify Redis backup
if [ -f "${REDIS_BACKUP_FILE}" ]; then
    if gzip -t "${REDIS_BACKUP_FILE}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis backup verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis backup verification failed${NC}"
    fi
fi

# Cleanup old backups
echo -e "${YELLOW}🧹 Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
DELETED_COUNT=0

# Find and delete old backups
find "${BACKUP_DIR}" -type f \( -name "*.gz" -o -name "*.sql" -o -name "*.rdb" \) -mtime +${RETENTION_DAYS} -print | while read file; do
    echo -e "${YELLOW}Deleting: $(basename $file)${NC}"
    rm -f "$file"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

# Delete old manifests
find "${BACKUP_DIR}" -type f -name "manifest_*.txt" -mtime +${RETENTION_DAYS} -delete

echo -e "${GREEN}✅ Cleaned up old backup files${NC}"

# Upload to cloud storage (if configured)
if [ -n "${AWS_S3_BUCKET}" ]; then
    echo -e "${YELLOW}☁️  Uploading backups to AWS S3...${NC}"
    
    if command -v aws &> /dev/null; then
        aws s3 cp "${POSTGRES_BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/postgres/" --storage-class GLACIER
        aws s3 cp "${REDIS_BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/redis/" --storage-class GLACIER
        aws s3 cp "${UPLOADS_BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/uploads/" --storage-class GLACIER
        aws s3 cp "${MANIFEST_FILE}" "s3://${AWS_S3_BUCKET}/backups/manifests/"
        
        echo -e "${GREEN}✅ Cloud backup completed${NC}"
    else
        echo -e "${YELLOW}⚠️  AWS CLI not installed, skipping cloud backup${NC}"
    fi
fi

# Send notification via Slack
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    echo -e "${YELLOW}📢 Sending Slack notification...${NC}"
    
    MANIFEST_CONTENT=$(cat "${MANIFEST_FILE}")
    
    curl -X POST "${SLACK_WEBHOOK_URL}" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Backup completed successfully - Lapa Casa Hostel\",
            \"attachments\": [{
                \"color\": \"good\",
                \"text\": \"\`\`\`${MANIFEST_CONTENT}\`\`\`\"
            }]
        }" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Slack notification sent${NC}"
    fi
fi

# Calculate total backup size
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

# Final summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ BACKUP COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Backup Location:${NC} ${BACKUP_DIR}"
echo -e "${GREEN}Timestamp:${NC} ${TIMESTAMP}"
echo -e "${GREEN}Total Size:${NC} ${TOTAL_SIZE}"
echo -e "${GREEN}Retention:${NC} ${RETENTION_DAYS} days"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Exit with appropriate status
if [ "$VERIFICATION_PASSED" = true ]; then
    exit 0
else
    exit 1
fi

✅ Archivo 177/180 completado
