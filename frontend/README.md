# 🏨 Lapa Casa Hostel - Channel Manager & Booking Engine

<div align="center">

![Lapa Casa Hostel](https://via.placeholder.com/600x200/0ea5e9/ffffff?text=LAPA+CASA+HOSTEL)

**Sistema completo de gestão de reservas e canal de vendas para hostel**  
*Santa Teresa, Rio de Janeiro - Brasil*

[![Next.js](https://img.shields.io/badge/Next.js-14.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payment-635bff?style=for-the-badge&logo=stripe)](https://stripe.com/)
[![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago-PIX-00b1ea?style=for-the-badge)](https://www.mercadopago.com.br/)

</div>

---

## 🎯 **Sobre o Projeto**

Sistema de reservas e gestão de canal desenvolvido especificamente para o **Lapa Casa Hostel**, localizado no coração de Santa Teresa, Rio de Janeiro. Especializado em grupos corporativos e eventos com **45 camas distribuídas em 4 quartos** únicos.

### 🏠 **Configuração do Hostel**
- **📍 Endereço:** Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro
- **🛏️ Capacidade:** 45 camas total
- **🏠 Quartos:** 4 quartos (2x Mixto 12, 1x Mixto 7, 1x Flexível 7)
- **🎯 Especialização:** Grupos 7+ pessoas com descontos automáticos
- **💰 Preço base:** R$ 60,00 por cama/noite

---

## ⚡ **Características Principais**

### 🔥 **Booking Engine Avançado**
- ✅ **Anti-overbooking** com sistema de bloqueio inteligente
- ✅ **Pricing dinâmico** com descontos automáticos para grupos
- ✅ **Quarto flexível** (feminino → mixto em 48h)
- ✅ **Temporadas** com multiplicadores sazonais
- ✅ **Multi-moeda** (BRL, USD, EUR)

### 💳 **Pagamentos Otimizados**
- ✅ **Stripe** - Cartões internacionais
- ✅ **Mercado Pago** - PIX, cartões BR, parcelamento 12x
- ✅ **Sistema de depósitos** (30% entrada, 70% na chegada)
- ✅ **Cobrança automática** 7 dias antes do check-in
- ✅ **Webhooks** para confirmações instantâneas

### 📊 **Gestão Inteligente**
- ✅ **Dashboard** com métricas em tempo real
- ✅ **Sincronização Google Sheets** automática
- ✅ **WhatsApp** para confirmações e lembretes
- ✅ **Email marketing** com templates personalizados
- ✅ **Analytics** e conversion tracking

---

## 🏗️ **Arquitetura Técnica**

### 🎨 **Frontend Stack**
```typescript
// Core Framework
Next.js 14.1          // App Router + Server Components
React 18.2            // Latest features + Concurrent mode
TypeScript 5.3        // Type safety + Developer experience

// Styling & UI
Tailwind CSS 3.4      // Utility-first + Custom design system
Framer Motion         // Smooth animations + Micro-interactions
Lucide React          // Consistent iconography

// State Management
Zustand               // Lightweight + TypeScript-first
React Hook Form       // Performance + Validation
Zod                   // Schema validation + Type inference

// Payments
Stripe Elements       // International cards + Apple/Google Pay
Mercado Pago SDK      // PIX + Brazilian market optimization
```

### ⚙️ **Backend Stack**
```typescript
// Runtime & Framework
Node.js 20+           // Latest LTS + Performance improvements
Express.js            // Robust + Middleware ecosystem
TypeScript            // End-to-end type safety

// Database & Cache
PostgreSQL            // ACID compliance + Complex queries
Redis                 // Session storage + Rate limiting
Prisma ORM            // Type-safe + Migration management

// External Integrations
Google Sheets API     // Booking sync + Reporting
WhatsApp Business     // Guest communication
SMTP (Gmail)          // Transactional emails
```

---

## 🚀 **Quick Start**

### 📋 **Pré-requisitos**
```bash
Node.js >= 18.17.0
npm >= 9.0.0
PostgreSQL >= 14
Redis >= 6.0
```

### 🔧 **Instalação**

1. **Clone o repositório**
```bash
git clone https://github.com/lapacasahostel/booking-system.git
cd booking-system/frontend
```

2. **Instalar dependências**
```bash
npm install
```

3. **Configurar ambiente**
```bash
cp .env.example .env.local
# Editar .env.local com suas configurações
```

4. **Executar em desenvolvimento**
```bash
npm run dev
```

5. **Acessar aplicação**
```
Frontend: http://localhost:3000
API Docs: http://localhost:8000/docs
```

---

## 💰 **Sistema de Preços**

### 🎯 **Descontos Automáticos por Grupo**
```javascript
const groupDiscounts = {
  '7-15 camas':  '10% desconto',
  '16-25 camas': '15% desconto', 
  '26+ camas':   '20% desconto'
};
```

### 📅 **Multiplicadores Sazonais**
```javascript
const seasonRates = {
  'Alta (Dez-Mar)':    '+50%',
  'Média (Abr-Mai)':   'Base',
  'Baixa (Jun-Set)':   '-20%',
  'Carnaval (Fev)':    '+100% (mín. 5 noites)'
};
```

### 💳 **Estrutura de Depósitos**
```javascript
const deposits = {
  'Grupos padrão':     '30% entrada + 70% chegada',
  'Grupos 15+ pessoas': '50% entrada + 50% chegada',
  'Cobrança automática': '7 dias antes check-in'
};
```

---

## 🏠 **Configuração dos Quartos**

### 🛏️ **Room Setup**
```typescript
interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  basePrice: number;
  isFlexible: boolean;
}

const rooms: Room[] = [
  {
    id: 'mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'mixto_12b', 
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false
  },
  {
    id: 'flexible_7',
    name: 'Flexível 7',
    capacity: 7,
    type: 'female', // Default feminino
    basePrice: 60.00,
    isFlexible: true // Converte para mixto em 48h
  }
];
```

---

## 🔧 **Scripts Disponíveis**

```bash
# Desenvolvimento
npm run dev              # Servidor desenvolvimento
npm run type-check       # Verificação TypeScript
npm run lint            # ESLint + correções
npm run format          # Prettier formatting

# Build & Deploy
npm run build           # Build produção
npm run start           # Servidor produção
npm run analyze         # Bundle analyzer

# Testes
npm run test            # Jest test suite
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# SEO & Performance
npm run sitemap         # Gerar sitemap.xml
```

---

## 📊 **Monitoramento & Analytics**

### 📈 **Métricas Principais**
- **Conversion Rate:** Objetivo >8%
- **Page Load Time:** <2 segundos
- **Mobile Performance:** Score >90
- **SEO Score:** >95
- **Accessibility:** WCAG 2.1 AA

### 🔍 **Ferramentas de Análise**
- **Google Analytics 4** - Comportamento usuários
- **Google Tag Manager** - Event tracking
- **Hotjar** - Heatmaps + Session recordings
- **Sentry** - Error monitoring
- **DataDog** - Performance monitoring

---

## 🌐 **Internacionalização**

### 🗣️ **Idiomas Suportados**
- 🇧🇷 **Português** (padrão)
- 🇺🇸 **English**
- 🇪🇸 **Español**

### 🌍 **Detecção Automática**
- Accept-Language header
- Geolocation (opcional)
- User preference storage
- URL prefix (/pt, /en, /es)

---

## 🔐 **Segurança**

### 🛡️ **Medidas Implementadas**
- ✅ **HTTPS** obrigatório
- ✅ **CSP Headers** configurados
- ✅ **Rate Limiting** por IP
- ✅ **Input Validation** com Zod
- ✅ **SQL Injection** prevention
- ✅ **XSS Protection** 
- ✅ **GDPR Compliance** para dados pessoais

### 🔑 **Autenticação**
- JWT tokens com refresh
- Bcrypt password hashing
- Session management
- OAuth providers (Google, Facebook)

---

## 🚀 **Deploy & DevOps**

### ☁️ **Infraestrutura**
- **Frontend:** Vercel / Netlify
- **Backend:** Railway / DigitalOcean
- **Database:** PostgreSQL Cloud
- **Cache:** Redis Cloud
- **CDN:** Cloudflare
- **Monitoring:** DataDog

### 🔄 **CI/CD Pipeline**
```yaml
# GitHub Actions
- Lint & Type Check
- Unit & Integration Tests  
- Build & Bundle Analysis
- Deploy Staging
- E2E Tests
- Deploy Production
- Performance Monitoring
```

---

## 🤝 **Contribuição**

### 🔀 **Workflow**
1. Fork o repositório
2. Criar branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'feat: adicionar nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abrir Pull Request

### 📝 **Convenções**
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
- **Branches:** `feature/`, `bugfix/`, `hotfix/`
- **Code Style:** Prettier + ESLint
- **Testing:** Jest + Testing Library

---

## 📞 **Suporte & Contato**

### 🏨 **Lapa Casa Hostel**
- **📧 Email:** contato@lapacasahostel.com
- **📱 WhatsApp:** +55 21 99999-9999
- **🌐 Website:** [lapacasahostel.com](https://lapacasahostel.com)
- **📍 Endereço:** Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro

### 💻 **Suporte Técnico**
- **📧 Dev Team:** dev@lapacasahostel.com
- **🐛 Issues:** [GitHub Issues](https://github.com/lapacasahostel/booking-system/issues)
- **📚 Docs:** [Documentação Técnica](https://docs.lapacasahostel.com)

---

## 📄 **Licença**

Copyright © 2024 Lapa Casa Hostel. Todos os direitos reservados.

Este projeto é propriedade privada do Lapa Casa Hostel e não pode ser reproduzido, distribuído ou usado comercialmente sem autorização expressa.

---

<div align="center">

**Desenvolvido com ❤️ para o melhor hostel de Santa Teresa**

*Sistema de reservas profissional para hospitalidade moderna*

</div>
