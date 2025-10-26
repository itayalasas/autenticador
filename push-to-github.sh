#!/bin/bash

echo "=================================="
echo "SUBIENDO CAMBIOS A GITHUB"
echo "=================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d ".git" ]; then
    echo "❌ ERROR: No se encuentra el repositorio git"
    echo "Por favor ejecuta este script desde /tmp/cc-agent/59248428/project"
    exit 1
fi

echo "✅ Repositorio git encontrado"
echo ""

# Mostrar información del commit
echo "📦 Commit a subir:"
git log -1 --oneline
echo ""

# Verificar si el remote existe
if git remote | grep -q "origin"; then
    echo "⚠️  Remote 'origin' ya existe. Actualizando..."
    git remote remove origin
fi

# Agregar el remote
echo "🔗 Conectando con GitHub..."
git remote add origin https://github.com/itayalasas/auth-apis-pets.git

# Verificar la conexión
echo ""
echo "📡 Remote configurado:"
git remote -v
echo ""

# Preguntar antes de subir
echo "=================================="
echo "¿Estás listo para subir los cambios?"
echo "Se subirán 272 archivos a GitHub"
echo "=================================="
echo ""
read -p "Presiona ENTER para continuar o CTRL+C para cancelar..."

# Subir los cambios
echo ""
echo "🚀 Subiendo cambios a GitHub..."
echo ""

# Intentar push normal primero
if git push -u origin master 2>&1; then
    echo ""
    echo "✅ ¡Cambios subidos exitosamente!"
else
    echo ""
    echo "⚠️  Push normal falló. Intentando con --force..."
    if git push -u origin master --force 2>&1; then
        echo ""
        echo "✅ ¡Cambios subidos exitosamente con --force!"
    else
        echo ""
        echo "❌ Error al subir cambios."
        echo ""
        echo "Posibles causas:"
        echo "1. No tienes permisos de escritura en el repositorio"
        echo "2. Necesitas autenticarte con un token de GitHub"
        echo "3. La rama principal es 'main' en lugar de 'master'"
        echo ""
        echo "Intenta manualmente:"
        echo "  git push -u origin master --force"
        echo "O si tu rama es 'main':"
        echo "  git branch -M main"
        echo "  git push -u origin main --force"
        exit 1
    fi
fi

echo ""
echo "=================================="
echo "✅ ¡LISTO!"
echo "=================================="
echo ""
echo "Próximos pasos:"
echo "1. Ve a https://app.netlify.com/sites/auth-apis-pets/deploys"
echo "2. Espera 2-3 minutos a que Netlify haga el deploy"
echo "3. Prueba: https://auth-apis-pets.netlify.app/login?app_id=app_8cc6bda9-120"
echo ""
echo "Verifica en GitHub:"
echo "https://github.com/itayalasas/auth-apis-pets/commits/master"
echo ""
