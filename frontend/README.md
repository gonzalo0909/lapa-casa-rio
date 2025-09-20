# Lapa Casa Hostel - Frontend

Sistema de reservas online para Lapa Casa Hostel, ubicado en Santa Teresa, Rio de Janeiro. Especializado en grupos grandes con capacidad para 38 huéspedes en 4 habitaciones.

## 🏨 Características del Hostel

- **Ubicación**: Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro
- **Capacidad**: 38 camas en 4 habitaciones
- **Especialidad**: Grupos de 7+ personas
- **Habitaciones**:
  - Mixto 12A (12 camas)
  - Mixto 12B (12 camas) 
  - Mixto 7 (7 camas)
  - Flexible 7 (7 camas - femenino/mixto)

## 🚀 Tecnologías

- **Framework**: Next.js 14 con App Router
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **UI**: Radix UI + componentes personalizados
- **Estado**: Zustand
- **Formularios**: React Hook Form + Zod
- **Pagos**: Stripe + Mercado Pago
- **Fechas**: date-fns + React Day Picker
- **Internacionalización**: next-intl (PT/EN/ES)

## 📋 Funcionalidades

### Sistema de Reservas
- ✅ Booking engine optimizado para grupos
- ✅ Calendario de disponibilidad en tiempo real
- ✅ Lógica anti-overbooking
- ✅ Precios dinámicos por temporada
- ✅ Descuentos automáticos por grupo:
  - 10% para 7-15 personas
  - 15% para 16-25 personas  
  - 20% para 26+ personas

### Gestión de Pagos
- ✅ Depósito inicial (30-50%)
- ✅ Pago automático del saldo (7 días antes)
- ✅ Stripe para tarjetas internacionales
- ✅ Mercado Pago + PIX para Brasil
- ✅ Manejo de webhooks

### Experiencia de Usuario
- ✅ Diseño mobile-first
- ✅ PWA con funcionalidad offline
- ✅ Multiidioma (Portugués, Inglés, Español)
- ✅ Integración WhatsApp Business
- ✅ SEO optimizado
- ✅ Analytics y conversión

## 🛠 Instalación

```bash
# Clonar repositorio
git clone https://github.com/lapacasahostel/frontend.git
cd lapa-casa-hostel-frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Ejecutar en desarrollo
npm run dev
```

## 📁 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── [locale]/          # Rutas internacionalizadas
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página de inicio
├── components/
│   ├── ui/                # Componentes base reutilizables
│   ├── booking/           # Componentes del motor de reservas
│   ├── payment/           # Componentes de pago
│   ├── rooms/             # Componentes de habitaciones
│   └── forms/             # Formularios especializados
├── lib/                   # Utilidades y configuraciones
├── hooks/                 # Custom hooks
├── stores/                # Estado global (Zustand)
├── types/                 # Definiciones TypeScript
└── constants/             # Constantes de la aplicación
```

## 🏗 Arquitectura

### Componentes del Booking Engine
- **DateSelector**: Selección de fechas con validaciones
- **RoomSelector**: Selección de habitaciones con disponibilidad
- **PricingCalculator**: Cálculo dinámico de precios
- **GuestInformation**: Formulario de huéspedes
- **PaymentProcessor**: Procesamiento de pagos

### Lógica Anti-Overbooking
- Verificación atómica de disponibilidad
- Locks temporales durante reserva
- Validación en tiempo real
- Manejo de habitación flexible

### Sistema de Precios
- Precio base: R$ 60 por cama/noche
- Multiplicadores estacionales:
  - Carnaval: 2.0x (mínimo 5 noches)
  - Alta: 1.5x (Dic-Mar)
  - Media: 1.0x (Abr-May, Oct-Nov)
  - Baja: 0.8x (Jun-Sep)

## 🔧 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Producción
npm run start        # Servidor producción
npm run lint         # Linting
npm run type-check   # Verificación TypeScript
npm run test         # Tests
npm run analyze      # Análisis de bundle
```

## 🌍 Variables de Entorno

```bash
# APIs
NEXT_PUBLIC_API_URL=            # URL del backend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Clave pública Stripe
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=  # Clave pública MP

# Configuración
NEXT_PUBLIC_WHATSAPP_NUMBER=    # WhatsApp del hostel
NEXT_PUBLIC_MAX_BEDS_PER_BOOKING=38  # Máximo camas
NEXT_PUBLIC_BASE_PRICE=60       # Precio base

# Features
NEXT_PUBLIC_ENABLE_PWA=true     # Habilitar PWA
NEXT_PUBLIC_ENABLE_ANALYTICS=   # Google Analytics
```

## 📱 Responsive Design

- **Mobile First**: Optimizado para móviles (70% del tráfico)
- **Breakpoints**: xs(475px), sm(640px), md(768px), lg(1024px), xl(1280px)
- **Touch Friendly**: Botones y áreas de toque optimizadas
- **Performance**: < 2s tiempo de carga garantizado

## 🔒 Seguridad

- CSP (Content Security Policy)
- Headers de seguridad
- Validación client-side y server-side
- Sanitización de inputs
- Rate limiting
- HTTPS obligatorio en producción

## 📈 SEO y Performance

- **Core Web Vitals**: Optimizado
- **Lighthouse Score**: 90+ en todas las métricas
- **Schema.org**: Markup para hoteles
- **Sitemap**: Generación automática
- **Meta tags**: Dinámicos por página
- **Open Graph**: Compartir en redes sociales

## 🚀 Deployment

### Vercel (Recomendado)
```bash
# Conectar repositorio en vercel.com
# Las variables de entorno se configuran en el dashboard
# Deploy automático en push a main
```

### Docker
```bash
# Build imagen
docker build -t lapa-casa-frontend .

# Ejecutar contenedor
docker run -p 3000:3000 lapa-casa-frontend
```

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests con coverage
npm run test:coverage

# Tests E2E
npm run test:e2e
```

## 📊 Monitoreo

- **Analytics**: Google Analytics 4
- **Errors**: Sentry
- **Performance**: Web Vitals
- **Conversión**: Funnel de reservas
- **User Experience**: Hotjar

## 🤝 Contribución

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📞 Soporte

- **Email**: tech@lapacasahostel.com
- **WhatsApp**: +55 21 99999-9999
- **Documentación**: [docs.lapacasahostel.com](https://docs.lapacasahostel.com)

## 📄 Licencia

Propietario - Lapa Casa Hostel. Todos los derechos reservados.

---

**Desarrollado con ❤️ para Lapa Casa Hostel**  
*Santa Teresa, Rio de Janeiro - Brasil*
