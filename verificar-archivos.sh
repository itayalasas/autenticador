#!/bin/bash

echo "🔍 VERIFICACIÓN DE ARCHIVOS PARA DEPLOYMENT"
echo "============================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Archivos críticos
CRITICAL_FILES=(
    "package.json"
    "package-lock.json"
    "vite.config.ts"
    "netlify.toml"
    "tsconfig.json"
    "index.html"
    "_redirects"
    "src/main.tsx"
    "src/App.tsx"
    "src/index.css"
    "netlify/functions/api.js"
    "netlify/functions/health.js"
    "src/utils/securityValidation.ts"
    "src/utils/brandedPublicAuthTemplate.ts"
    "src/utils/publicAuthFormsTemplate.ts"
    "src/services/dLocalService.ts"
)

missing_count=0
found_count=0

echo "📋 Verificando archivos críticos..."
echo ""

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
        ((found_count++))
    else
        echo -e "${RED}❌${NC} $file ${YELLOW}(FALTA)${NC}"
        ((missing_count++))
    fi
done

echo ""
echo "============================================"
echo -e "✅ Encontrados: ${GREEN}$found_count${NC}"
echo -e "❌ Faltantes: ${RED}$missing_count${NC}"
echo ""

# Contar todos los archivos TypeScript
ts_files=$(find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
echo "📊 Total de archivos TypeScript en src/: $ts_files"

# Verificar node_modules
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️${NC} node_modules/ existe (no debe estar en Git)"
else
    echo -e "${GREEN}✅${NC} node_modules/ no existe (correcto)"
fi

# Verificar dist
if [ -d "dist" ]; then
    echo -e "${YELLOW}⚠️${NC} dist/ existe (no debe estar en Git)"
else
    echo -e "${GREEN}✅${NC} dist/ no existe (correcto)"
fi

# Verificar .env
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️${NC} .env existe (NO debe estar en Git - verifica .gitignore)"
else
    echo -e "${GREEN}✅${NC} .env no encontrado en la verificación (correcto si está en .gitignore)"
fi

echo ""
echo "============================================"

if [ $missing_count -eq 0 ]; then
    echo -e "${GREEN}🎉 ¡Todos los archivos críticos están presentes!${NC}"
    echo ""
    echo "✅ El proyecto está listo para deploy"
else
    echo -e "${RED}⚠️ Faltan $missing_count archivos críticos${NC}"
    echo ""
    echo "Para agregar los archivos faltantes:"
    echo "  git add ."
    echo "  git commit -m 'Add missing files for deployment'"
    echo "  git push origin main"
fi

echo ""
