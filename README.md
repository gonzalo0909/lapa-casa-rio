# Lapa Casa Hostel - Backend API

Sistema de reservas para Lapa Casa Hostel con gestión de inventario en tiempo real.

## Instalación Rápida

```bash
# 1. Clonar proyecto
git clone [URL]
cd lapa-casa-backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Iniciar servicios
docker-compose up -d

# 5. Configurar base de datos
npm run db:generate
npm run db:migrate
npm run db:seed

# 6. Iniciar desarrollo
npm run dev
```

## Scripts Disponibles

- `npm run dev` - Desarrollo con hot reload
- `npm run build` - Compilar TypeScript
- `npm start` - Producción
- `npm test` - Ejecutar tests
- `npm run db:migrate` - Aplicar migraciones
- `npm run db:studio` - UI de base de datos

## APIs Principales

- `POST /api/availability` - Consultar disponibilidad
- `POST /api/bookings` - Crear reserva
- `POST /api/holds` - Hold temporal
- `GET /api/admin/dashboard` - Panel admin

## Configuración Requerida

Variables en `.env`:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection  
- `ADMIN_TOKEN` - Token admin panel

## Troubleshooting

**Error de conexión DB:**
```bash
docker-compose down
docker-compose up -d postgres
npm run db:migrate
```

**Error Redis:**
```bash
docker-compose restart redis
