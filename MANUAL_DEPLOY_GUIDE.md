# Guía de Despliegue Manual de Edge Functions

Esta guía te ayudará a actualizar manualmente las Edge Functions en Supabase.

## 📋 Requisitos Previos

1. **Instalar Supabase CLI**
   ```bash
   # Con npm
   npm install -g supabase

   # Con Homebrew (macOS)
   brew install supabase/tap/supabase

   # Con Scoop (Windows)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

2. **Autenticarse en Supabase**
   ```bash
   supabase login
   ```

## 🚀 Método 1: Usar el Script Automático

```bash
# Ejecutar el script desde el directorio raíz del proyecto
./manual-deploy-functions.sh
```

El script te guiará paso a paso:
1. Verificará que Supabase CLI esté instalado
2. Verificará que estés autenticado
3. Te mostrará tus proyectos disponibles
4. Te pedirá el Project ID
5. Desplegará las 3 funciones críticas

## 🔧 Método 2: Despliegue Manual Paso a Paso

### Paso 1: Obtener tu Project ID

```bash
# Listar tus proyectos
supabase projects list
```

Copia el **Project Ref** (es un código como `abcdefghijklmno`)

### Paso 2: Conectar al Proyecto

```bash
# Reemplaza YOUR_PROJECT_ID con tu Project Ref
supabase link --project-ref YOUR_PROJECT_ID
```

### Paso 3: Desplegar las Funciones

Despliega cada función una por una:

```bash
# Función 1: Recolección de archivos fuente (LA MÁS IMPORTANTE)
supabase functions deploy collect-source-files --no-verify-jwt

# Función 2: Commit y push a GitHub
supabase functions deploy github-commit-push --no-verify-jwt

# Función 3: Deploy a Netlify
supabase functions deploy deploy-to-netlify --no-verify-jwt
```

### Paso 4: Verificar el Despliegue

```bash
# Listar todas las funciones desplegadas
supabase functions list
```

## 📝 Funciones Críticas

### 1. `collect-source-files` ⭐ MÁS IMPORTANTE
- **Propósito**: Recolecta todos los archivos React del proyecto
- **Por qué es importante**: Lee los archivos corregidos sin `useMemo`/`useCallback`
- **Ubicación**: `supabase/functions/collect-source-files/index.ts`

### 2. `github-commit-push`
- **Propósito**: Hace commit y push de los archivos a GitHub
- **Ubicación**: `supabase/functions/github-commit-push/index.ts`

### 3. `deploy-to-netlify`
- **Propósito**: Despliega la aplicación en Netlify
- **Ubicación**: `supabase/functions/deploy-to-netlify/index.ts`

## ✅ Verificación Post-Despliegue

Después de desplegar las funciones:

1. Ve a tu **dashboard de Supabase**
2. Navega a **Edge Functions**
3. Verifica que las 3 funciones aparezcan actualizadas

## 🎯 Siguiente Paso: Deploy de Producción

Una vez actualizadas las funciones:

1. Ve a tu **dashboard de AuthSystem**
2. Navega a **"Ambientes"**
3. Selecciona tu aplicación
4. Haz clic en **"Desplegar"** en production

Ahora el sistema:
- Leerá los archivos corregidos (sin `useMemo`/`useCallback`)
- Los subirá a GitHub en la carpeta `src/`
- Netlify hará el build de React
- El error React #310 desaparecerá ✨

## 🆘 Solución de Problemas

### Error: "command not found: supabase"
Instala Supabase CLI (ver Requisitos Previos)

### Error: "You are not logged in"
Ejecuta `supabase login` y sigue las instrucciones

### Error: "Project not found"
Verifica que el Project ID sea correcto con `supabase projects list`

### Error: "Permission denied"
Verifica que tengas permisos en el proyecto de Supabase

## 📚 Documentación Adicional

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/introduction)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)

---

**Nota**: Este despliegue manual es necesario solo si el sistema automático falló. Normalmente las funciones se actualizan automáticamente.
