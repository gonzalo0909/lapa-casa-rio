#!/bin/bash

# Lapa Casa Hostel - Build Script
# Construcción y compresión completa del frontend

set -e  # Salir si hay error

echo "🏨 Iniciando build de Lapa Casa Hostel Frontend..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js no está instalado"
    exit 1
fi

# Verificar que npm está instalado
if ! command -v npm &> /dev/null; then
    error "npm no está instalado"
    exit 1
fi

# Obtener directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "package.json no encontrado. ¿Estás en el directorio correcto?"
    exit 1
fi

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    log "Instalando dependencias..."
    npm install
    success "Dependencias instaladas"
fi

# Limpiar build anterior
log "Limpiando builds anteriores..."
npm run clean
success "Limpieza completada"

# Crear directorios
log "Creando estructura de directorios..."
mkdir -p dist/temp dist/assets/css dist/assets/js
success "Directorios creados"

# Verificar archivos fuente
log "Verificando archivos fuente..."

required_files=(
    "src/index.html"
    "src/js/main.js"
    "src/assets/css"
    "src/js/core"
    "src/js/managers"
    "src/js/validators"
    "src/js/ui"
    "src/js/utils"
    "src/js/integrations"
)

for file in "${required_files[@]}"; do
    if [ ! -e "$file" ]; then
        error "Archivo/directorio requerido no encontrado: $file"
        exit 1
    fi
done

success "Archivos fuente verificados"

# Build CSS
log "Construyendo CSS..."
npm run css:concat
npm run css:minify
success "CSS compilado y minificado"

# Build JavaScript
log "Construyendo JavaScript..."
npm run js:concat
npm run js:minify
success "JavaScript compilado y minificado"

# Comprimir con Gzip
log "Comprimiendo con Gzip..."
if command -v gzip &> /dev/null; then
    npm run compress:gzip
    success "Compresión Gzip completada"
else
    warning "Gzip no disponible, saltando compresión gzip"
fi

# Comprimir con Brotli
log "Comprimiendo con Brotli..."
if command -v brotli &> /dev/null; then
    npm run compress:brotli
    success "Compresión Brotli completada"
else
    warning "Brotli no disponible, saltando compresión brotli"
fi

# Copiar archivos estáticos
log "Copiando archivos estáticos..."
npm run copy:final
success "Archivos estáticos copiados"

# Reporte de tamaños
log "Generando reporte de tamaños..."

echo ""
echo "📊 REPORTE DE TAMAÑOS:"
echo "======================="

if [ -f "dist/assets/css/styles.min.css" ]; then
    css_size=$(stat -f%z "dist/assets/css/styles.min.css" 2>/dev/null || stat -c%s "dist/assets/css/styles.min.css" 2>/dev/null || echo "unknown")
    echo "CSS minificado: $css_size bytes"
    
    if [ -f "dist/assets/css/styles.min.css.gz" ]; then
        css_gz_size=$(stat -f%z "dist/assets/css/styles.min.css.gz" 2>/dev/null || stat -c%s "dist/assets/css/styles.min.css.gz" 2>/dev/null || echo "unknown")
        echo "CSS gzip: $css_gz_size bytes"
    fi
fi

if [ -f "dist/assets/js/main.min.js" ]; then
    js_size=$(stat -f%z "dist/assets/js/main.min.js" 2>/dev/null || stat -c%s "dist/assets/js/main.min.js" 2>/dev/null || echo "unknown")
    echo "JS minificado: $js_size bytes"
    
    if [ -f "dist/assets/js/main.min.js.gz" ]; then
        js_gz_size=$(stat -f%z "dist/assets/js/main.min.js.gz" 2>/dev/null || stat -c%s "dist/assets/js/main.min.js.gz" 2>/dev/null || echo "unknown")
        echo "JS gzip: $js_gz_size bytes"
    fi
fi

# Verificar límites de tamaño (opcional)
if command -v bundlesize &> /dev/null; then
    log "Verificando límites de tamaño..."
    npm run analyze
else
    warning "bundlesize no disponible, saltando análisis de tamaño"
fi

# Verificar integridad de archivos
log "Verificando integridad de build..."

critical_files=(
    "dist/index.html"
    "dist/assets/css/styles.min.css"
    "dist/assets/js/main.min.js"
)

for file in "${critical_files[@]}"; do
    if [ ! -f "$file" ]; then
        error "Archivo crítico faltante: $file"
        exit 1
    fi
    
    # Verificar que no esté vacío
    if [ ! -s "$file" ]; then
        error "Archivo crítico vacío: $file"
        exit 1
    fi
done

success "Integridad de build verificada"

# Limpiar archivos temporales
log "Limpiando archivos temporales..."
npm run cleanup:temp
success "Limpieza temporal completada"

echo ""
echo "🎉 BUILD COMPLETADO EXITOSAMENTE!"
echo "=================================="
echo ""
echo "Archivos generados en: ./dist/"
echo ""
echo "Para servir localmente:"
echo "  npm run serve"
echo ""
echo "Para servir con compresión:"
echo "  npm run serve:gzip"
echo ""

# Mostrar estructura final
echo "📁 Estructura final:"
echo "==================="
find dist -type f | head -20

exit 0
