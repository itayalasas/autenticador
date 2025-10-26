#!/bin/bash

# Script para subir TODO el proyecto a GitHub de una vez
# Esto permitirá que Netlify despliegue el sitio correctamente

echo "🚀 Subiendo proyecto completo a GitHub"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: No estás en el directorio del proyecto"
  echo "   Ejecuta: cd /tmp/cc-agent/59250850/project"
  exit 1
fi

# Verificar si git ya está inicializado
if [ ! -d ".git" ]; then
  echo "📦 Inicializando repositorio Git..."
  git init
  echo "✅ Git inicializado"
else
  echo "✅ Git ya está inicializado"
fi

# Agregar el remote si no existe
if ! git remote | grep -q "origin"; then
  echo "🔗 Agregando remote de GitHub..."
  git remote add origin https://github.com/itayalasas/auth-apis-pets.git
  echo "✅ Remote agregado"
else
  echo "✅ Remote ya existe"
  git remote -v
fi

# Crear .gitignore si no existe o actualizarlo
echo "📝 Configurando .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
.vite/

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Temporary files
*.tmp
*.temp

# Database exports (son muy grandes)
*.sql
complete_database_export.sql
database_setup_script.sql

# Archives
*.tar.gz
*.zip

# Archivos de documentación interna (opcional, puedes comentar si los quieres subir)
# *.md
EOF

echo "✅ .gitignore configurado"

# Mostrar estado actual
echo ""
echo "📊 Archivos que se subirán:"
echo ""

# Agregar TODOS los archivos (excepto los del .gitignore)
echo "➕ Agregando archivos..."
git add -A

echo ""
echo "📋 Estado de git:"
git status --short | head -20
echo "..."
echo "($(git status --short | wc -l) archivos en total)"

# Crear commit
echo ""
echo "💾 Creando commit..."
git commit -m "Add complete project with auth system

- React frontend with Vite
- Supabase Edge Functions integration
- Authentication system (login, register, reset password)
- Branding system
- Role-based access control
- Netlify deployment configuration
- Environment management
- All TypeScript services and components" || {
  echo "⚠️  No hay cambios para commitear o ya existe el commit"
}

# Mostrar información antes de push
echo ""
echo "🔍 Commit listo para subir:"
git log --oneline -1

echo ""
echo "⚠️  IMPORTANTE: Esto va a SOBRESCRIBIR el repositorio remoto"
echo "   El repositorio actual solo tiene algunos archivos de src/"
echo "   Después de esto tendrá el proyecto COMPLETO"
echo ""
read -p "¿Continuar? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "❌ Cancelado por el usuario"
  exit 1
fi

# Push forzado
echo ""
echo "📤 Subiendo a GitHub..."
echo "   Esto puede tardar un minuto..."
git push -u origin main --force

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ ¡Proyecto completo subido a GitHub!"
  echo ""
  echo "🌐 Repositorio: https://github.com/itayalasas/auth-apis-pets"
  echo ""
  echo "📋 Próximos pasos:"
  echo "   1. Ve a Netlify: https://app.netlify.com"
  echo "   2. Ve a tu sitio: auth-apis-pets"
  echo "   3. Netlify detectará los cambios y desplegará automáticamente"
  echo "   4. Espera ~2-3 minutos para que termine el build"
  echo "   5. Visita: https://auth-apis-pets.netlify.app"
  echo ""
else
  echo ""
  echo "❌ Error al subir a GitHub"
  echo "   Puede que necesites autenticarte:"
  echo "   git config --global user.email 'tu@email.com'"
  echo "   git config --global user.name 'Tu Nombre'"
  echo ""
  echo "   O usar un token de acceso personal"
  exit 1
fi
