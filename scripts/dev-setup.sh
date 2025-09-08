echo "🏨 Lapa Casa Backend - Setup Automático"
echo "======================================"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Instalar desde https://nodejs.org"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no encontrado. Instalar Docker Desktop"
    exit 1
fi

echo "✅ Dependencias verificadas"

# Instalar paquetes npm
echo "📦 Instalando dependencias..."
npm install

# Crear .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "⚠️  Edita .env con tus configuraciones"
fi

# Iniciar servicios Docker
echo "🐳 Iniciando servicios Docker..."
docker-compose down
docker-compose up -d

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando PostgreSQL..."
sleep 10

# Configurar Prisma
echo "🗄️  Configurando base de datos..."
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# Verificar salud del sistema
echo "🔍 Verificando instalación..."
npm run test -- --testTimeout=10000

echo ""
echo "🎉 Setup completado!"
echo ""
echo "Comandos útiles:"
echo "  npm run dev     # Iniciar desarrollo"
echo "  npm test        # Ejecutar tests"
echo "  npm run db:studio # UI base de datos"
echo ""
echo "API disponible en: http://localhost:3001"
echo "Health check: curl http://localhost:3001/health"
