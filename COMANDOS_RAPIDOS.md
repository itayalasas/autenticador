# 🚀 Comandos Rápidos - Copia y Pega

## 📦 Instalación de Supabase CLI

```bash
# npm
npm install -g supabase

# Homebrew (macOS)
brew install supabase/tap/supabase
```

## 🔑 Autenticación

```bash
supabase login
```

## 📋 Ver Proyectos

```bash
supabase projects list
```

## 🔗 Conectar al Proyecto

```bash
# Reemplaza YOUR_PROJECT_REF con tu Project Ref
supabase link --project-ref YOUR_PROJECT_REF
```

## 🚀 Desplegar Edge Functions (UNA POR UNA)

### Opción A: Todas las funciones críticas

```bash
# 1. Recolector de archivos (LA MÁS IMPORTANTE)
supabase functions deploy collect-source-files --no-verify-jwt

# 2. GitHub commit y push
supabase functions deploy github-commit-push --no-verify-jwt

# 3. Deploy a Netlify
supabase functions deploy deploy-to-netlify --no-verify-jwt
```

### Opción B: Solo la función crítica

Si solo quieres actualizar la función más importante:

```bash
supabase functions deploy collect-source-files --no-verify-jwt
```

## ✅ Verificar Despliegue

```bash
# Listar funciones desplegadas
supabase functions list

# Ver logs de una función específica
supabase functions logs collect-source-files
```

## 🔍 Debug (Si algo falla)

```bash
# Ver logs en tiempo real
supabase functions logs collect-source-files --follow

# Verificar configuración del proyecto
supabase projects list
supabase status
```

## 📝 Ejemplo Completo (Copia Todo)

```bash
# 1. Instalar CLI (si no lo tienes)
npm install -g supabase

# 2. Login
supabase login

# 3. Ver tus proyectos y copiar el Project Ref
supabase projects list

# 4. Conectar (reemplaza con tu Project Ref)
supabase link --project-ref abcdefghijklmno

# 5. Desplegar la función más importante
supabase functions deploy collect-source-files --no-verify-jwt

# 6. Desplegar las otras dos (opcional)
supabase functions deploy github-commit-push --no-verify-jwt
supabase functions deploy deploy-to-netlify --no-verify-jwt

# 7. Verificar que se desplegaron
supabase functions list
```

## 🎯 Después del Despliegue

1. Ve a tu dashboard de AuthSystem
2. Navega a "Ambientes"
3. Selecciona tu aplicación
4. Haz clic en "Desplegar" en production

---

## 💡 Notas Importantes

- **Project Ref**: Es el ID corto que ves en `supabase projects list`
- **No verificar JWT**: `--no-verify-jwt` es necesario porque estas funciones se llaman desde el frontend
- **Tiempo de despliegue**: Cada función tarda ~10-30 segundos

## ❓ ¿Cuál es mi Project Ref?

Después de ejecutar `supabase projects list` verás algo como:

```
┌─────────────────┬────────────────┬────────────┐
│   NAME          │   PROJECT REF  │  STATUS    │
├─────────────────┼────────────────┼────────────┤
│   My Project    │   abcdefghijk  │  ACTIVE    │
└─────────────────┴────────────────┴────────────┘
```

Tu **Project Ref** es: `abcdefghijk`
