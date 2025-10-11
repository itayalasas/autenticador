#!/bin/bash

# ============================================
# Script Manual para Actualizar Edge Functions
# ============================================

echo "🚀 Script de Actualización Manual de Edge Functions"
echo "=================================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que tengas Supabase CLI instalado
if ! command -v supabase &> /dev/null
then
    echo -e "${RED}❌ Supabase CLI no está instalado${NC}"
    echo ""
    echo "Instala Supabase CLI con:"
    echo "  npm install -g supabase"
    echo "  o"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"
echo ""

# Verificar que estés en el directorio correcto
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}❌ No se encontró el directorio supabase/functions${NC}"
    echo "Asegúrate de estar en el directorio raíz del proyecto"
    exit 1
fi

echo -e "${GREEN}✅ Directorio del proyecto correcto${NC}"
echo ""

# Verificar que estés logueado en Supabase
echo -e "${BLUE}🔑 Verificando autenticación con Supabase...${NC}"
if ! supabase projects list &> /dev/null
then
    echo -e "${YELLOW}⚠️  No estás autenticado en Supabase${NC}"
    echo ""
    echo "Ejecuta primero:"
    echo "  supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Autenticado en Supabase${NC}"
echo ""

# Listar proyectos disponibles
echo -e "${BLUE}📋 Tus proyectos de Supabase:${NC}"
supabase projects list
echo ""

# Pedir el Project ID
read -p "Ingresa tu Project ID (Ref ID): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Project ID no puede estar vacío${NC}"
    exit 1
fi

# Link al proyecto
echo ""
echo -e "${BLUE}🔗 Conectando al proyecto...${NC}"
supabase link --project-ref "$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al conectar con el proyecto${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Conectado al proyecto${NC}"
echo ""

# Lista de funciones críticas que necesitan actualización
FUNCTIONS=(
    "collect-source-files"
    "github-commit-push"
    "deploy-to-netlify"
)

echo -e "${BLUE}📦 Funciones a actualizar:${NC}"
for func in "${FUNCTIONS[@]}"; do
    echo "   - $func"
done
echo ""

# Preguntar si desea continuar
read -p "¿Deseas continuar con la actualización? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]
then
    echo -e "${YELLOW}⚠️  Actualización cancelada${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Iniciando actualización de funciones...${NC}"
echo ""

# Desplegar cada función
for func in "${FUNCTIONS[@]}"; do
    echo -e "${BLUE}📤 Desplegando: $func${NC}"

    if [ ! -d "supabase/functions/$func" ]; then
        echo -e "${RED}   ❌ Directorio no encontrado: supabase/functions/$func${NC}"
        continue
    fi

    supabase functions deploy "$func" --project-ref "$PROJECT_ID" --no-verify-jwt

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}   ✅ $func desplegado exitosamente${NC}"
    else
        echo -e "${RED}   ❌ Error al desplegar $func${NC}"
    fi

    echo ""
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 ACTUALIZACIÓN COMPLETADA${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo "📋 Próximos pasos:"
echo "   1. Ve a tu dashboard de AuthSystem"
echo "   2. Navega a 'Ambientes'"
echo "   3. Selecciona tu aplicación"
echo "   4. Haz clic en 'Desplegar' en production"
echo ""

echo -e "${GREEN}✨ Las funciones actualizadas ahora leerán los archivos corregidos${NC}"
