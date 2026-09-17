# lapa-casa-hostel/docs/deployment/setup-guide.md

# Lapa Casa Hostel - Complete Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Application Deployment](#application-deployment)
5. [Payment Gateway Setup](#payment-gateway-setup)
6. [Monitoring Setup](#monitoring-setup)
7. [Production Checklist](#production-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js**: v20.x or higher
- **Docker**: v24.x or higher
- **Docker Compose**: v2.x or higher
- **Git**: Latest version
- **kubectl**: v1.28.x (for Kubernetes deployment)
- **Terraform**: v1.0+ (optional, for IaC)

### Required Accounts
- **Stripe Account**: For international payments
- **Mercado Pago Account**: For Brazilian payments (PIX)
- **Google Cloud Account**: For Sheets integration
- **Resend Account**: For transactional emails
- **Domain**: lapacasario.com configured

### System Requirements
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: Minimum 50GB SSD
- **CPU**: 4 cores minimum
- **Network**: Stable internet connection

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/lapa-casa-hostel/lapa-casa-hostel.git
cd lapa-casa-hostel
```

### 2. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
cd ..
```

#### Backend
```bash
cd backend
npm install
cd ..
```

### 3. Environment Variables

Create environment files for each environment:

#### `.env.local` (Development)
```env
# Database
DATABASE_URL="postgresql://lapacasa:password@localhost:5432/lapa_channel_manager"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="development"
PORT=3000
BACKEND_PORT=4000

# Security
JWT_SECRET="your-development-jwt-secret-min-32-chars"
ENCRYPTION_KEY="your-development-encryption-key-32-chars"

# Stripe (Test Mode)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Mercado Pago (Test Mode)
MP_ACCESS_TOKEN="TEST-..."
MP_PUBLIC_KEY="TEST-..."
MP_WEBHOOK_SECRET="your-mp-webhook-secret"

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="lapalandiarj@gmail.com"

# Google Sheets
GOOGLE_SHEETS_ID="your-sheet-id"
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# URLs
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

#### `.env.production` (Production)
```env
# Database (use managed PostgreSQL)
DATABASE_URL="postgresql://lapacasa:STRONG_PASSWORD@postgres:5432/lapa_channel_manager"

# Redis (use managed Redis)
REDIS_URL="redis://redis:6379"

# Application
NODE_ENV="production"
PORT=3000
BACKEND_PORT=4000

# Security (GENERATE STRONG SECRETS!)
JWT_SECRET="GENERATE-STRONG-SECRET-MIN-32-CHARS"
ENCRYPTION_KEY="GENERATE-STRONG-SECRET-32-CHARS"

# Stripe (Live Mode)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Mercado Pago (Production)
MP_ACCESS_TOKEN="APP_USR-..."
MP_PUBLIC_KEY="APP_USR-..."
MP_WEBHOOK_SECRET="GENERATE-STRONG-SECRET"

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="lapalandiarj@gmail.com"

# WhatsApp
WHATSAPP_API_KEY="your-whatsapp-api-key"
WHATSAPP_PHONE_NUMBER="+5521999999999"

# Google Sheets
GOOGLE_SHEETS_ID="production-sheet-id"
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# URLs
NEXT_PUBLIC_API_URL="https://api.lapacasario.com"
NEXT_PUBLIC_SITE_URL="https://lapacasario.com"

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."
```

### 4. Generate Secrets

```bash
# Generate JWT Secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Encryption Key (exactly 32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Database Configuration

### 1. Local Development with Docker

```bash
# Start PostgreSQL
docker run -d \
  --name lapa-postgres \
  -e POSTGRES_USER=lapacasa \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=lapa_channel_manager \
  -p 5432:5432 \
  postgres:16-alpine

# Start Redis
docker run -d \
  --name lapa-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 2. Run Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 3. Seed Database

```bash
npx prisma db seed
```

This creates:
- 4 rooms (Mixto 12A, Mixto 12B, Mixto 7, Flexible 7)
- Sample pricing configurations
- Test bookings (development only)

---

## Application Deployment

### Local development
```bash
docker-compose up -d
```
(usa `backend/docker-compose.yml`: Postgres, Redis y herramientas opcionales
de desarrollo -- MailHog, pgAdmin, Redis Commander, Prisma Studio bajo el
profile `tools`).

### Production

> **FIX (auditoría 2026-08-30):** este documento describía Docker Compose
> production y Kubernetes como opciones de deploy, apoyadas en archivos
> de `infrastructure/` (Dockerfile.prod, docker-compose.prod.yml,
> kubernetes/*.yaml) que nunca estuvieron conectados al despliegue real
> -- no existían las ramas que dispararían su CI, el Dockerfile copiaba
> un script inexistente, y el manifiesto de Kubernetes referenciaba un
> Secret sin la clave que su propio StatefulSet necesitaba. Se
> eliminaron junto con el resto de `infrastructure/`. El deploy real de
> producción es en Vercel (frontend) y Fly.io (backend/worker) -- ver **[docs/DEPLOY.md](../DEPLOY.md)** para
> el procedimiento completo y actualizado.

### Manual/local build

#### Build
```bash
# Frontend
cd frontend
npm run build

# Backend
cd ../backend
npm run build
```

#### Start Services
```bash
# Backend (in one terminal)
cd backend
npm start

# Frontend (in another terminal)
cd frontend
npm start
```

---

## Payment Gateway Setup

### Stripe Configuration

#### 1. Create Stripe Account
- Go to https://stripe.com
- Create account and verify business

#### 2. Get API Keys
- Dashboard → Developers → API Keys
- Copy Secret Key and Publishable Key

#### 3. Configure Webhooks
```bash
# Webhook URL
https://api.lapacasario.com/api/webhooks/stripe

# Events to subscribe:
- payment_intent.succeeded
- payment_intent.payment_failed
- charge.refunded
```

#### 4. Test Stripe Integration
```bash
# Use test card
Card Number: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

### Mercado Pago Configuration

#### 1. Create Mercado Pago Account
- Go to https://www.mercadopago.com.br
- Create business account

#### 2. Get Credentials
- Dashboard → Credentials
- Copy Access Token and Public Key

#### 3. Configure Webhooks
```bash
# Webhook URL
https://api.lapacasario.com/api/webhooks/mercadopago

# Events:
- payment
- merchant_order
```

#### 4. PIX Configuration
- Enable PIX in Mercado Pago dashboard
- Configure PIX key for instant payments

---

## Monitoring Setup

> **FIX (auditoría 2026-08-30):** esta sección describía un stack
> Prometheus + Grafana que nunca llegó a funcionar -- los archivos de
> configuración (`infrastructure/monitoring/*`) tenían YAML/JSON
> inválido (texto de generación pegado al final), y el scrape config
> apuntaba a un endpoint `/metrics` en formato de texto de Prometheus
> que el backend nunca expuso (el real es `GET /api/metrics`, JSON,
> protegido con auth admin). Se eliminó esa configuración junto con el
> resto de `infrastructure/` en vez de dejarla ahí rota.
>
> Monitoreo real disponible hoy: `GET /api/metrics` (requiere login
> admin) para requests/min, latencia y tasa de error en memoria del
> proceso actual; y las alertas de servicios caídos en
> `backend/src/monitoring/alerts.ts` (DB, Redis, colas), que se envían
> por email. Un stack de métricas real (Prometheus/Grafana u otro APM)
> queda pendiente de implementar desde cero cuando haga falta.

---

## Production Checklist

### Pre-Launch

- [ ] All environment variables configured
- [ ] Strong secrets generated (32+ characters)
- [ ] SSL certificates installed
- [ ] Database backups configured
- [ ] Monitoring dashboards configured
- [ ] Payment gateways tested (both Stripe and MP)
- [ ] Email sending tested
- [ ] Google Sheets sync tested
- [ ] Domain DNS configured correctly
- [ ] Rate limiting configured
- [ ] CORS policies configured

### Security

- [ ] JWT secrets are strong and unique
- [ ] Database passwords are strong
- [ ] No secrets in git repository
- [ ] HTTPS enforced on all endpoints
- [ ] API rate limiting active
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection headers configured
- [ ] CSRF protection enabled

### Performance

- [ ] Database indexes created
- [ ] Redis caching configured
- [ ] CDN configured for static assets
- [ ] Images optimized
- [ ] Gzip compression enabled
- [ ] Connection pooling configured
- [ ] Load testing completed

### Monitoring

- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards working
- [ ] Error tracking configured (Sentry)
- [ ] Log aggregation configured
- [ ] Alerts configured for critical issues
- [ ] Uptime monitoring active

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Symptom**: `Error: connect ECONNREFUSED`

**Solution**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Redis Connection Failed

**Symptom**: `Error: Redis connection failed`

**Solution**:
```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

#### 3. Stripe Webhook Verification Failed

**Symptom**: `Webhook signature verification failed`

**Solution**:
- Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard
- Check webhook URL is correct
- Ensure request body is not modified before verification

#### 4. Payment Intent Creation Failed

**Symptom**: `Error creating payment intent`

**Solution**:
- Check Stripe/MP API keys are correct
- Verify amount is valid (minimum $0.50 for Stripe)
- Check currency is supported
- Review Stripe/MP dashboard for errors

#### 5. Booking Overbooking Detected

**Symptom**: More bookings than beds available

**Solution**:
```bash
# Check availability logic
# Run anti-overbooking audit
npm run audit:overbooking

# Verify database transactions are atomic
# Check Redis cache consistency
```

### Debug Mode

Enable debug logging:

```env
DEBUG=lapa:*
LOG_LEVEL=debug
```

View detailed logs:
```bash
docker-compose logs -f --tail=100 app
```

### Performance Issues

#### Slow Response Times

1. Check database query performance
```bash
# Enable slow query log in PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
```

2. Check Redis hit rate
```bash
redis-cli info stats | grep keyspace
```

3. Profile Node.js application
```bash
node --prof backend/dist/server.js
```

### Getting Help

- **Documentation**: `/docs` folder
- **API Docs**: `https://api.lapacasario.com/docs`
- **GitHub Issues**: https://github.com/lapa-casa-hostel/lapa-casa-hostel/issues
- **Email Support**: lapalandiarj@gmail.com

---

## Next Steps

After successful deployment:

1. **Test Booking Flow**: Create test booking end-to-end
2. **Test Payment Flow**: Complete payment with test cards
3. **Verify Notifications**: Check email and WhatsApp
4. **Monitor Metrics**: Watch Grafana dashboards
5. **Review Logs**: Check for any errors
6. **Backup Test**: Run backup script and verify
7. **Load Testing**: Simulate concurrent users
8. **Security Audit**: Run security scan

**Congratulations! Your Lapa Casa Hostel Channel Manager is now live! 🎉**

✅ Archivo 182/184 completado
