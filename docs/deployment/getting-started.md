# lapa-casa-hostel/docs/development/getting-started.md

# Developer Guide - Getting Started

## Welcome to Lapa Casa Hostel Channel Manager Development

This guide will help you set up your local development environment and understand the project structure.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Architecture Overview](#architecture-overview)
5. [Coding Standards](#coding-standards)
6. [Testing Guide](#testing-guide)
7. [Common Tasks](#common-tasks)
8. [Debugging Tips](#debugging-tips)

---

## Quick Start

### 1. Prerequisites

Ensure you have installed:
- Node.js v20+
- Docker Desktop
- Git
- VS Code (recommended)

### 2. Clone and Install

```bash
# Clone repository
git clone https://github.com/lapa-casa-hostel/lapa-casa-hostel.git
cd lapa-casa-hostel

# Install dependencies
npm run install:all
```

### 3. Start Development Environment

```bash
# Start database services
docker-compose up -d postgres redis

# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate

# Seed database with test data
npx prisma db seed

# Start development servers
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Database: localhost:5432
- Redis: localhost:6379

### 4. Verify Installation

Open http://localhost:3000 in your browser. You should see the Lapa Casa Hostel booking interface.

Test the API:
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Project Structure

```
lapa-casa-hostel/
├── frontend/                 # Next.js 14 frontend
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   │   ├── booking/     # Booking engine components
│   │   │   ├── payment/     # Payment processor components
│   │   │   └── ui/          # Base UI components
│   │   ├── lib/             # Utilities and helpers
│   │   ├── hooks/           # Custom React hooks
│   │   └── stores/          # Zustand state management
│   └── public/              # Static assets
│
├── backend/                  # Node.js + Express backend
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── database/        # Prisma schema and models
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── lib/             # Core utilities
│   │   │   ├── anti-overbooking/  # Inventory control
│   │   │   ├── pricing/           # Pricing logic
│   │   │   └── payments/          # Payment handlers
│   │   ├── integrations/    # External services
│   │   └── middleware/      # Express middleware
│   └── prisma/              # Database schema
│
├── tests/                    # Test suites
│   ├── frontend/            # Frontend tests
│   └── backend/             # Backend tests
│
├── infrastructure/           # DevOps configuration
│   ├── docker-compose.yml
│   ├── kubernetes/
│   ├── scripts/
│   └── monitoring/
│
└── docs/                     # Documentation
    ├── api/
    ├── deployment/
    └── development/
```

---

## Development Workflow

### Branch Strategy

```
main           # Production-ready code
├── staging    # Pre-production testing
└── feature/*  # New features
└── fix/*      # Bug fixes
```

### Typical Development Flow

1. **Create Feature Branch**
```bash
git checkout -b feature/booking-calendar-improvements
```

2. **Make Changes**
```bash
# Edit files
# Run tests frequently
npm test

# Check linting
npm run lint
```

3. **Commit Changes**
```bash
git add .
git commit -m "feat(booking): improve calendar date selection"
```

4. **Push and Create PR**
```bash
git push origin feature/booking-calendar-improvements
# Create Pull Request on GitHub
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
style(scope): formatting changes
refactor(scope): code refactoring
test(scope): add tests
chore(scope): maintenance tasks
```

Examples:
```bash
feat(booking): add group discount calculator
fix(payment): resolve Stripe webhook verification
docs(api): update OpenAPI spec
test(availability): add overbooking test cases
```

---

## Architecture Overview

### Frontend Architecture

**Framework**: Next.js 14 (App Router)
**Language**: TypeScript
**Styling**: Tailwind CSS
**State Management**: Zustand
**Forms**: React Hook Form + Zod

#### Key Components

1. **Booking Engine** (`frontend/src/components/booking/`)
   - Date selection with calendar
   - Room selection with availability
   - Guest information form
   - Price calculation with discounts

2. **Payment Processor** (`frontend/src/components/payment/`)
   - Stripe Elements integration
   - Mercado Pago SDK integration
   - PIX payment flow
   - Payment status tracking

3. **UI Components** (`frontend/src/components/ui/`)
   - Reusable base components
   - Button, Input, Select, etc.
   - Consistent design system

### Backend Architecture

**Framework**: Express.js
**Language**: TypeScript
**Database**: PostgreSQL + Prisma ORM
**Cache**: Redis
**Auth**: JWT

#### Key Services

1. **Booking Service** (`backend/src/services/booking-service.ts`)
   - Booking creation and validation
   - Anti-overbooking logic
   - Status management

2. **Pricing Service** (`backend/src/services/pricing-service.ts`)
   - Group discount calculation
   - Seasonal pricing
   - Currency conversion

3. **Payment Service** (`backend/src/services/payment-service.ts`)
   - Stripe integration
   - Mercado Pago integration
   - Webhook handling

### Data Flow

```
User Request
    ↓
Frontend (Next.js)
    ↓
API Call (fetch/axios)
    ↓
Backend API Routes
    ↓
Business Logic Services
    ↓
Database (PostgreSQL) / Cache (Redis)
    ↓
Response
    ↓
Frontend Update
```

---

## Coding Standards

### TypeScript

**Always use TypeScript**. No plain JavaScript files in src/.

```typescript
// ✅ Good
interface BookingRequest {
  checkIn: Date;
  checkOut: Date;
  beds: number;
}

function createBooking(request: BookingRequest): Promise<Booking> {
  // Implementation
}

// ❌ Bad
function createBooking(request) {
  // No types
}
```

### React Components

**Use functional components with hooks**

```typescript
// ✅ Good
export function BookingForm() {
  const [loading, setLoading] = useState(false);
  
  return <form>...</form>;
}

// ❌ Bad - Class components
export class BookingForm extends React.Component {
  // ...
}
```

### Naming Conventions

- **Components**: PascalCase (`BookingEngine.tsx`)
- **Files**: kebab-case (`booking-service.ts`)
- **Functions**: camelCase (`calculatePrice()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_BEDS`)
- **Types/Interfaces**: PascalCase (`BookingRequest`)

### File Organization

```typescript
// 1. Imports (external first, then internal)
import { useState } from 'react';
import { BookingService } from '@/services/booking-service';

// 2. Types/Interfaces
interface Props {
  bookingId: string;
}

// 3. Constants
const MAX_RETRIES = 3;

// 4. Component/Function
export function BookingDetails({ bookingId }: Props) {
  // Implementation
}

// 5. Exports
export default BookingDetails;
```

### Error Handling

**Always handle errors explicitly**

```typescript
// ✅ Good
try {
  const booking = await createBooking(data);
  return { success: true, booking };
} catch (error) {
  logger.error('Failed to create booking', { error, data });
  return { success: false, error: error.message };
}

// ❌ Bad - No error handling
const booking = await createBooking(data);
return booking;
```

---

## Testing Guide

### Running Tests

```bash
# Run all tests
npm test

# Run frontend tests only
cd frontend && npm test

# Run backend tests only
cd backend && npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

#### Frontend Component Test

```typescript
// frontend/src/components/booking/__tests__/booking-form.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingForm } from '../booking-form';

describe('BookingForm', () => {
  it('renders form fields', () => {
    render(<BookingForm />);
    
    expect(screen.getByLabelText(/check-in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/check-out/i)).toBeInTheDocument();
  });

  it('validates dates', async () => {
    render(<BookingForm />);
    
    const checkIn = screen.getByLabelText(/check-in/i);
    fireEvent.change(checkIn, { target: { value: '2025-01-01' } });
    
    // Assertions
  });
});
```

#### Backend Service Test

```typescript
// backend/src/services/__tests__/booking-service.test.ts
import { BookingService } from '../booking-service';

describe('BookingService', () => {
  it('creates booking successfully', async () => {
    const service = new BookingService();
    
    const result = await service.createBooking({
      checkIn: new Date('2025-12-15'),
      checkOut: new Date('2025-12-20'),
      beds: 10
    });
    
    expect(result.success).toBe(true);
    expect(result.booking).toBeDefined();
  });

  it('prevents overbooking', async () => {
    const service = new BookingService();
    
    // Create booking that fills room
    await service.createBooking({ beds: 12, ... });
    
    // Try to create another booking
    const result = await service.createBooking({ beds: 5, ... });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });
});
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create route file**
```typescript
// backend/src/routes/bookings/get-booking-summary.ts
import { Router } from 'express';

const router = Router();

router.get('/summary/:id', async (req, res) => {
  // Implementation
});

export default router;
```

2. **Register route**
```typescript
// backend/src/routes/bookings/bookings.routes.ts
import summaryRoute from './get-booking-summary';

router.use('/', summaryRoute);
```

3. **Add tests**
```typescript
// backend/src/routes/bookings/__tests__/get-booking-summary.test.ts
```

### Adding a New React Component

1. **Create component file**
```typescript
// frontend/src/components/booking/booking-summary.tsx
export function BookingSummary() {
  return <div>...</div>;
}
```

2. **Add tests**
```typescript
// frontend/src/components/booking/__tests__/booking-summary.test.tsx
```

3. **Export from index**
```typescript
// frontend/src/components/booking/index.ts
export { BookingSummary } from './booking-summary';
```

### Database Schema Changes

1. **Update Prisma schema**
```prisma
// backend/prisma/schema.prisma
model Booking {
  // Add new field
  specialRequests String?
}
```

2. **Create migration**
```bash
cd backend
npx prisma migrate dev --name add_special_requests
```

3. **Update TypeScript types**
```bash
npx prisma generate
```

---

## Debugging Tips

### Frontend Debugging

**React DevTools**
- Install React DevTools browser extension
- Inspect component state and props
- Profile component performance

**Console Logging**
```typescript
console.log('Booking data:', bookingData);
console.table(rooms);
console.error('Payment failed:', error);
```

**VS Code Debugging**
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Next.js: debug client-side",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend"
    }
  ]
}
```

### Backend Debugging

**Node.js Inspector**
```bash
node --inspect backend/dist/server.js
# Open chrome://inspect
```

**Debug Logs**
```typescript
import { logger } from '@/utils/logger';

logger.debug('Processing booking', { bookingId, userId });
logger.info('Booking created successfully');
logger.warn('Low availability detected');
logger.error('Payment failed', { error });
```

**Database Query Logging**
```typescript
// Enable in development
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

---

## Additional Resources

- **API Documentation**: http://localhost:4000/docs
- **Storybook**: `npm run storybook` (if configured)
- **Database GUI**: Use Prisma Studio `npx prisma studio`
- **Redis GUI**: Use Redis Commander `npm install -g redis-commander && redis-commander`

---

## Getting Help

- Check existing documentation in `/docs`
- Search GitHub issues
- Ask in team Slack channel
- Email: tech@lapacasahostel.com

**Happy coding! 🚀**

✅ Archivo 183/184 completado
