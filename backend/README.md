# lapa-casa-hostel/backend/README.md

# Lapa Casa Hostel - Backend API

Channel Manager backend system for Lapa Casa Hostel, Rio de Janeiro.

## 🏨 About Lapa Casa Hostel

**Location:** Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro  
**Capacity:** 45 beds across 4 rooms  
**Specialty:** Group bookings (7+ people), corporate events  
**Website:** [lapacasahostel.com](https://lapacasahostel.com)

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Room Configuration](#room-configuration)
- [Pricing Logic](#pricing-logic)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## 🚀 Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Cache:** Redis
- **Authentication:** JWT + bcrypt
- **Payments:** Stripe + Mercado Pago (PIX)
- **Email:** Resend
- **Integrations:** Google Sheets, WhatsApp Business API
- **Monitoring:** Winston, Prometheus, Sentry

---

## 🛏️ Room Configuration

### Room 1: MIXTO-12A
- **ID:** `room_mixto_12a`
- **Capacity:** 12 beds
- **Type:** Mixed dorm
- **Base Price:** R$ 60.00/bed/night

### Room 2: MIXTO-12B
- **ID:** `room_mixto_12b`
- **Capacity:** 12 beds
- **Type:** Mixed dorm
- **Base Price:** R$ 60.00/bed/night

### Room 3: MIXTO-7
- **ID:** `room_mixto_7`
- **Capacity:** 7 beds
- **Type:** Mixed dorm
- **Base Price:** R$ 60.00/bed/night

### Room 4: FLEXIBLE-7
- **ID:** `room_flexible_7`
- **Capacity:** 7 beds
- **Type:** Female (auto-converts to mixed 48h before check-in if no female bookings)
- **Base Price:** R$ 60.00/bed/night

---

## 💰 Pricing Logic

### Group Discounts
```javascript
7-15 beds:  10% discount
16-25 beds: 15% discount
26+ beds:   20% discount
```

### Seasonal Multipliers
```javascript
High Season (Dec-Mar):     +50% (1.5x)
Medium Season (Apr-May, Oct-Nov): Base price (1.0x)
Low Season (Jun-Sep):      -20% (0.8x)
Carnival (February):       +100% (2.0x, minimum 5 nights)
```

### Deposit Structure
- **Standard:** 30% deposit, 70% balance
- **Large groups (15+):** 50% deposit, 50% balance
- **Auto-charge:** 7 days before check-in
- **Retry attempts:** 3 automatic retries

---

## 📦 Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 14
- Redis >= 6.0
- npm >= 9.0.0

---

## 🔧 Installation

```bash
# Clone repository
git clone https://github.com/lapa-casa-hostel/channel-manager-backend.git
cd channel-manager-backend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate
```

---

## ⚙️ Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lapa_casa_hostel

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_PUBLIC_KEY=APP_USR-...

# Email
RESEND_API_KEY=re_...

# Google Sheets
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
```

---

## 🗄️ Database Setup

```bash
# Run migrations
npm run prisma:migrate

# Seed initial data (creates 4 rooms)
npm run prisma:seed

# Open Prisma Studio (optional)
npm run prisma:studio
```

---

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Server runs on `http://localhost:5000`

### Production Mode
```bash
# Build
npm run build

# Start
npm run start:prod
```

### Docker
```bash
# Build and run
npm run docker:build
npm run docker:run

# Stop
npm run docker:stop

# View logs
npm run docker:logs
```

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:5000/api/v1
Production: https://api.lapacasahostel.com/api/v1
```

### Endpoints

#### Availability
```http
GET /availability/check
POST /availability/room-availability
```

#### Bookings
```http
POST /bookings
GET /bookings/:id
PATCH /bookings/:id
DELETE /bookings/:id
```

#### Payments
```http
POST /payments/create-intent
POST /payments/confirm
POST /payments/deposit
POST /payments/webhook
```

#### Rooms
```http
GET /rooms
GET /rooms/:id
```

### Full API Documentation
- OpenAPI Spec: `/docs/api/openapi.yaml`
- Swagger UI: `http://localhost:5000/api-docs` (development only)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

### Test Structure
```
tests/
├── backend/
│   ├── booking-service.test.ts
│   ├── pricing-service.test.ts
│   ├── payments.test.ts
│   └── api.test.ts
└── shared/
    └── mock-bookings.json
```

---

## 🚀 Deployment

### Railway/Render
```bash
# Deploy script
npm run deploy
```

### Manual Deployment
```bash
# Build
npm run build

# Run migrations
npm run prisma:migrate:prod

# Start production server
npm run start:prod
```

### Environment Variables (Production)
Ensure all production values are set:
- `NODE_ENV=production`
- `DATABASE_URL` (production database)
- `REDIS_HOST` (production Redis)
- All API keys and secrets

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── database/         # Prisma schema & models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── lib/              # Core logic (anti-overbooking, pricing)
│   ├── integrations/     # External APIs (Sheets, WhatsApp)
│   ├── utils/            # Helper functions
│   ├── types/            # TypeScript types
│   ├── cache/            # Redis cache layer
│   ├── app.ts            # Express app
│   └── server.ts         # Server entry point
├── tests/                # Test files
├── infrastructure/       # Docker, K8s, CI/CD
├── logs/                 # Application logs
├── .env                  # Environment variables
├── docker-compose.yml    # Docker services
└── Dockerfile            # Production image

```

---

## 🔐 Security

- JWT authentication for admin routes
- Rate limiting on all endpoints
- Helmet.js security headers
- CORS configured for frontend only
- Input validation with Joi/Zod
- SQL injection prevention via Prisma
- Encrypted sensitive data at rest

---

## 🌐 Integrations

### Google Sheets
Automatic sync of bookings to spreadsheet:
- Column A: booking_id
- Column B: guest_name
- Column E: check_in_date
- Column F: check_out_date
- Full schema in `/docs/business/pricing-logic.md`

### WhatsApp Business
Automated notifications:
- Booking confirmation
- Payment reminders
- Check-in instructions

### Email (Resend)
Templates for:
- Booking confirmation
- Payment receipts
- Cancellation notices

---

## 📊 Monitoring

### Logs
```bash
# View logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Prometheus Metrics
```
http://localhost:9090/metrics
```

### Sentry Error Tracking
Configure `SENTRY_DSN` in `.env`

---

## 🛠️ Development

### Code Quality
```bash
# Lint
npm run lint
npm run lint:fix

# Format
npm run format
```

### Git Workflow
```bash
# Feature branch
git checkout -b feature/your-feature

# Commit
git commit -m "feat: add feature description"

# Push
git push origin feature/your-feature
```

---

## 📞 Support

**Technical Issues:** [GitHub Issues](https://github.com/lapa-casa-hostel/channel-manager-backend/issues)  
**Business Contact:** contact@lapacasahostel.com  
**Phone:** +55 21 XXXX-XXXX

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👥 Contributors

Lapa Casa Hostel Tech Team

---

**Built with ❤️ in Rio de Janeiro**
