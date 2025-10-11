# 🚀 SOLUCIÓN AL ERROR: useMemo en GitHub

## ⚠️ PROBLEMA IDENTIFICADO

El código en GitHub todavía tiene `useMemo` en PublicAuthRouter.tsx línea 60 porque:
- ✅ La Edge Function local está correcta
- ❌ NO está desplegada en Supabase producción
- ❌ Por eso GitHub recibe código viejo

---

## 🎯 SOLUCIÓN EN 3 PASOS

### PASO 1️⃣: Desplegar Edge Function

```bash
supabase functions deploy collect-source-files --no-verify-jwt
```

### PASO 2️⃣: Hacer Deploy Nuevo

1. Dashboard de AuthSystem
2. Ir a "Ambientes" o "Deployments"
3. Hacer clic en "Deploy" en tu aplicación
4. Esperar que termine

### PASO 3️⃣: Verificar en GitHub

1. Abrir repositorio en GitHub
2. Ir a `src/components/auth/PublicAuthRouter.tsx`
3. Línea 60 debe decir:
   ```typescript
   const defaultBranding = (() => ({
   ```
4. NO debe tener `useMemo`

---

## 📦 Si No Tienes Supabase CLI

### Instalación Rápida:

```bash
# npm
npm install -g supabase

# Homebrew (macOS)
brew install supabase/tap/supabase
```

### Autenticación y Conexión:

```bash
# 1. Login
supabase login

# 2. Ver proyectos
supabase projects list

# 3. Conectar (usa tu Project Ref)
supabase link --project-ref TU_PROJECT_REF
```

---

## 🚀 Comando Completo (Copia Todo)

```bash
# Instalar (si no lo tienes)
npm install -g supabase

# Login
supabase login

# Ver proyectos
supabase projects list

# Conectar (reemplaza con tu Project Ref)
supabase link --project-ref abcdefghijk

# DESPLEGAR LA FUNCIÓN CRÍTICA
supabase functions deploy collect-source-files --no-verify-jwt

# Verificar
supabase functions list
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
