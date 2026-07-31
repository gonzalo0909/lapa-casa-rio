#!/bin/bash
# lapa-casa-hostel/infrastructure/scripts/deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-latest}"

echo -e "${GREEN}🚀 Deploying Lapa Casa Hostel${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Image Tag: ${IMAGE_TAG}${NC}"
echo -e "${BLUE}Project Root: ${PROJECT_ROOT}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment. Use 'staging' or 'production'${NC}"
    exit 1
fi

# Load environment variables
ENV_FILE="${PROJECT_ROOT}/.env.${ENVIRONMENT}"
if [ -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}📋 Loading environment variables from ${ENV_FILE}...${NC}"
    set -a
    source "${ENV_FILE}"
    set +a
else
    echo -e "${RED}❌ Environment file not found: ${ENV_FILE}${NC}"
    exit 1
fi

# Pre-deployment checks
echo -e "${YELLOW}🔍 Running pre-deployment checks...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ docker-compose is available${NC}"

# Check required environment variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "STRIPE_SECRET_KEY"
    "MP_ACCESS_TOKEN"
    "RESEND_API_KEY"
)

echo -e "${YELLOW}🔐 Checking required environment variables...${NC}"
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Required variable $var is not set${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ $var is set${NC}"
done

# Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
cd "${PROJECT_ROOT}"
docker build \
    -f infrastructure/Dockerfile.prod \
    -t lapa-casa-hostel:${IMAGE_TAG} \
    --build-arg NODE_VERSION=20 \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker image built successfully${NC}"

# Tag image
docker tag lapa-casa-hostel:${IMAGE_TAG} lapa-casa-hostel:${ENVIRONMENT}
echo -e "${GREEN}✅ Image tagged as ${ENVIRONMENT}${NC}"

# Production warning
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}🚨 PRODUCTION DEPLOYMENT${NC}"
    echo -e "${YELLOW}Press Ctrl+C within 10 seconds to cancel...${NC}"
    for i in {10..1}; do
        echo -e "${YELLOW}$i...${NC}"
        sleep 1
    done
fi

# Create backup before deployment
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}💾 Creating pre-deployment backup...${NC}"
    BACKUP_SCRIPT="${PROJECT_ROOT}/infrastructure/scripts/backup.sh"
    if [ -f "${BACKUP_SCRIPT}" ]; then
        bash "${BACKUP_SCRIPT}"
        echo -e "${GREEN}✅ Backup completed${NC}"
    else
        echo -e "${YELLOW}⚠️  Backup script not found, skipping...${NC}"
    fi
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f infrastructure/docker-compose.prod.yml down

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker run --rm \
    --network host \
    -e DATABASE_URL="${DATABASE_URL}" \
    lapa-casa-hostel:${IMAGE_TAG} \
    sh -c "cd backend && npx prisma migrate deploy"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database migrations completed${NC}"

# Start new containers
echo -e "${YELLOW}🚀 Starting new containers...${NC}"
docker-compose -f infrastructure/docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start containers${NC}"
    exit 1
fi

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
ATTEMPTS=0
MAX_ATTEMPTS=60
BACKEND_URL="http://localhost:4000"

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if curl -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    
    ATTEMPTS=$((ATTEMPTS + 1))
    echo -e "${YELLOW}Attempt $ATTEMPTS/$MAX_ATTEMPTS - waiting for backend...${NC}"
    sleep 2
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Health check failed after $MAX_ATTEMPTS attempts${NC}"
    echo -e "${YELLOW}📋 Showing container logs:${NC}"
    docker-compose -f infrastructure/docker-compose.prod.yml logs --tail=50 app
    exit 1
fi

# Run smoke tests
echo -e "${YELLOW}🧪 Running smoke tests...${NC}"

# Test frontend
echo -e "${YELLOW}Testing frontend...${NC}"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${RED}❌ Frontend is not responding${NC}"
    exit 1
fi

# Test backend health endpoint
echo -e "${YELLOW}Testing backend health...${NC}"
if curl -f http://localhost:4000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health endpoint is responding${NC}"
else
    echo -e "${RED}❌ Backend health endpoint is not responding${NC}"
    exit 1
fi

# Test backend API
echo -e "${YELLOW}Testing backend API...${NC}"
if curl -f http://localhost:4000/api/rooms > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is responding${NC}"
else
    echo -e "${RED}❌ Backend API is not responding${NC}"
    exit 1
fi

# Show running containers
echo -e "${YELLOW}📊 Running containers:${NC}"
docker-compose -f infrastructure/docker-compose.prod.yml ps

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f --filter "label=project=lapa-casa-hostel" --filter "until=72h" || true
echo -e "${GREEN}✅ Cleanup completed${NC}"

# Log deployment
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployments.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployed ${ENVIRONMENT} - ${IMAGE_TAG} - ${USER}" >> "${DEPLOYMENT_LOG}"

# Final success message
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Environment:${NC} ${ENVIRONMENT}"
echo -e "${GREEN}Image Tag:${NC} ${IMAGE_TAG}"
echo -e "${GREEN}Frontend:${NC} http://localhost:3000"
echo -e "${GREEN}Backend:${NC} http://localhost:4000"
echo -e "${GREEN}Prometheus:${NC} http://localhost:9090"
echo -e "${GREEN}Grafana:${NC} http://localhost:3001"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit 0

✅ Archivo 176/180 completado
