# Guía Completa de Integración con GitHub

## 🎯 Visión General

Este sistema te permite **conectar tu cuenta de GitHub** directamente desde la aplicación y disfrutar de **deploys automáticos** sin necesidad de configuraciones manuales.

### ✨ Características Principales

- ✅ **OAuth con GitHub** - Autenticación segura desde la app
- ✅ **Crear repositorios** - Crea repos nuevos con un clic
- ✅ **Seleccionar repositorios existentes** - Usa tus repos actuales
- ✅ **Commits automáticos** - Push de código sin Git CLI
- ✅ **Integración con Netlify** - Conecta repo y sitio automáticamente
- ✅ **Deploys automáticos** - Deploy en cada push a main
- ✅ **Todo desde la UI** - Sin necesidad de terminal

---

## 📋 Requisitos Previos

### 1. Cuenta de GitHub
- Crea una cuenta en [github.com](https://github.com) si no tienes una

### 2. GitHub OAuth App
Para que la integración funcione, necesitas crear una OAuth App en GitHub:

1. Ve a https://github.com/settings/developers
2. Haz clic en **"New OAuth App"**
3. Llena el formulario:
   ```
   Application name: AuthSystem
   Homepage URL: https://tu-dominio.com
   Authorization callback URL: https://tu-dominio.com/github/callback
   ```
4. Haz clic en **"Register application"**
5. Copia el **Client ID** y genera un **Client Secret**

### 3. Configurar Variables de Entorno

**Frontend (.env):**
```env
VITE_GITHUB_CLIENT_ID=tu_client_id_aqui
VITE_GITHUB_REDIRECT_URI=https://tu-dominio.com/github/callback
```

**Backend (Supabase Secrets):**
```bash
# Estos se configuran automáticamente en Supabase
GITHUB_CLIENT_ID=tu_client_id_aqui
GITHUB_CLIENT_SECRET=tu_client_secret_aqui
```

---

## 🚀 Cómo Usar el Sistema

### Paso 1: Conectar GitHub

1. Ve a la sección de **Ambientes** en la aplicación
2. Verás un panel de **"Conectar con GitHub"**
3. Haz clic en **"Conectar con GitHub"**
4. Serás redirigido a GitHub para autorizar la aplicación
5. Acepta los permisos solicitados
6. Serás redirigido de vuelta a la aplicación
7. ✅ ¡GitHub conectado!

### Paso 2: Crear o Seleccionar Repositorio

#### Opción A: Crear Nuevo Repositorio

1. En el panel de GitHub, verás **"Crear Nuevo Repositorio"**
2. Ingresa un nombre para tu repo (ej: `mi-auth-system`)
3. Haz clic en **"Crear"**
4. El repositorio se creará automáticamente en tu cuenta de GitHub
5. Se inicializará con un README
6. Se guardará en la base de datos del sistema
7. ✅ Listo para usar!

#### Opción B: Seleccionar Repositorio Existente

1. Haz clic en **"Cargar Mis Repositorios"**
2. Verás una lista de todos tus repos en GitHub
3. Haz clic en el repo que quieres usar
4. Se guardará en la base de datos del sistema
5. ✅ Listo para usar!

### Paso 3: Subir Código al Repositorio

El sistema puede hacer commits y push automáticamente:

```typescript
// Ejemplo de uso del servicio
import { githubService } from './services/githubService';

// Preparar archivos para commit
const files = {
  'index.html': '<html>...</html>',
  'styles.css': 'body { margin: 0; }',
  'app.js': 'console.log("Hello!");'
};

// Hacer commit y push
await githubService.commitAndPush(
  'tu-usuario/tu-repo',
  files,
  'Deploy from AuthSystem'
);
```

### Paso 4: Conectar con Netlify

Una vez que tengas código en el repositorio:

1. Ve a **Ambientes** → Selecciona tu aplicación
2. Haz clic en **"Configurar Netlify"**
3. Ingresa tu Netlify Access Token
4. Selecciona o crea un sitio de Netlify
5. El sistema conectará automáticamente el repo con Netlify

**O manualmente:**

```typescript
import { netlifyService } from './services/netlifyService';

// Conectar repo con sitio de Netlify
await netlifyService.connectRepositoryToSite(
  'netlify-site-id',
  'tu-usuario/tu-repo',  // Formato: owner/repo
  'npm run build',        // Build command
  'dist'                  // Publish directory
);
```

### Paso 5: Deploy Automático

Una vez conectado:

1. Cada vez que hagas push al repositorio
2. Netlify detectará el cambio automáticamente
3. Ejecutará el build
4. Deployará a producción
5. ✅ Sitio actualizado!

---

## 🏗️ Arquitectura del Sistema

### Base de Datos

#### Tabla: `git_connections`
```sql
- id (uuid)
- user_id (uuid) → auth.users
- provider (text) - 'github', 'gitlab', 'bitbucket'
- access_token (text) - Token de OAuth
- username (text) - Usuario de GitHub
- email (text)
- avatar_url (text)
- is_active (boolean)
```

#### Tabla: `git_repositories`
```sql
- id (uuid)
- user_id (uuid) → auth.users
- git_connection_id (uuid) → git_connections
- repo_name (text)
- repo_full_name (text) - username/repo
- repo_url (text)
- clone_url (text)
- default_branch (text)
- netlify_site_id (text) - ID del sitio en Netlify
- auto_deploy (boolean)
```

### Edge Functions

#### 1. `github-oauth-callback`
**Propósito:** Intercambiar código de OAuth por access token

**Flujo:**
```
1. Usuario autoriza en GitHub
2. GitHub redirige con código
3. Edge Function intercambia código por token
4. Token se guarda en la base de datos
```

**Request:**
```json
{
  "code": "github_oauth_code_here"
}
```

**Response:**
```json
{
  "access_token": "gho_xxxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "repo,user:email"
}
```

#### 2. `github-commit-push`
**Propósito:** Hacer commit y push de archivos al repositorio

**Flujo:**
```
1. Recibe archivos y mensaje de commit
2. Obtiene el SHA del último commit
3. Crea blobs para cada archivo
4. Crea un nuevo tree
5. Crea un nuevo commit
6. Actualiza la referencia (push)
```

**Request:**
```json
{
  "accessToken": "gho_xxxxx",
  "repoFullName": "username/repo",
  "files": {
    "index.html": "<html>...</html>",
    "app.js": "console.log('Hello');"
  },
  "commitMessage": "Deploy from AuthSystem",
  "branch": "main"
}
```

**Response:**
```json
{
  "success": true,
  "commit": {
    "sha": "abc123...",
    "message": "Deploy from AuthSystem"
  }
}
```

### Servicios

#### `githubService.ts`
**Métodos principales:**

- `initiateOAuth()` - Inicia flujo OAuth
- `handleCallback()` - Maneja callback de OAuth
- `getActiveConnection()` - Obtiene conexión activa
- `listRepositories()` - Lista repos del usuario
- `createRepository()` - Crea nuevo repo
- `saveRepository()` - Guarda repo en BD
- `commitAndPush()` - Hace commit y push
- `disconnect()` - Desconecta GitHub

#### `netlifyService.ts`
**Métodos nuevos:**

- `connectRepositoryToSite()` - Conecta repo con sitio

---

## 🔒 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

```sql
-- Los usuarios solo pueden ver sus propias conexiones
CREATE POLICY "Users can read own git connections"
  ON git_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Los usuarios solo pueden ver sus propios repositorios
CREATE POLICY "Users can read own git repositories"
  ON git_repositories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### Tokens de Acceso

- Los tokens se almacenan en la base de datos de Supabase
- Protegidos con RLS
- Cada usuario solo puede acceder a sus propios tokens
- Los tokens nunca se exponen en el frontend
- Las Edge Functions usan los tokens de forma segura

### OAuth Best Practices

- State parameter para prevenir CSRF
- Scope mínimo necesario: `repo`, `user:email`
- Tokens con expiración (si GitHub lo soporta)
- Refresh tokens para renovar acceso

---

## 🔄 Flujo Completo de Deploy Automático

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                             │
└──────────────────────────────────────────────────────────────┘

1. CONECTAR GITHUB
   Usuario → Conectar con GitHub
            ↓
   GitHub OAuth → Autorizar
            ↓
   Edge Function → Intercambiar código por token
            ↓
   Base de Datos → Guardar token
            ↓
   ✅ GitHub Conectado

2. CREAR/SELECCIONAR REPO
   Usuario → Crear nuevo repo o seleccionar existente
            ↓
   GitHub API → Crear repo (si es nuevo)
            ↓
   Base de Datos → Guardar info del repo
            ↓
   ✅ Repositorio Listo

3. SUBIR CÓDIGO
   Sistema → Preparar archivos del proyecto
            ↓
   Edge Function (github-commit-push) → Hacer commit y push
            ↓
   GitHub → Código en el repositorio
            ↓
   ✅ Código en GitHub

4. CONECTAR CON NETLIFY
   Usuario → Seleccionar sitio de Netlify
            ↓
   Netlify API → Conectar repo con sitio
            ↓
   Netlify → Configurar build settings
            ↓
   Base de Datos → Guardar netlify_site_id
            ↓
   ✅ Netlify Conectado

5. DEPLOY AUTOMÁTICO
   GitHub → Push detectado
            ↓
   Netlify Webhook → Trigger build
            ↓
   Netlify → npm run build
            ↓
   Netlify → Deploy a producción
            ↓
   ✅ Sitio en Vivo!

6. DEPLOYS FUTUROS
   Cada push a main → Deploy automático ♻️
```

---

## 💡 Casos de Uso

### Caso 1: Primer Deploy (Sin Repositorio)

```
1. Conectar GitHub
2. Crear nuevo repositorio "mi-proyecto"
3. Sistema sube código inicial al repo
4. Conectar con Netlify
5. Netlify hace el primer build
6. ✅ Sitio en vivo!
```

### Caso 2: Usar Repositorio Existente

```
1. Conectar GitHub
2. Seleccionar repo existente
3. Conectar con Netlify
4. Netlify detecta el repo
5. Hace build automático
6. ✅ Sitio en vivo!
```

### Caso 3: Updates Continuos

```
1. Hacer cambios en el código
2. Sistema hace commit y push automático
3. Netlify detecta el push
4. Build y deploy automático
5. ✅ Sitio actualizado!
```

---

## 🐛 Troubleshooting

### Error: "GitHub OAuth not configured"

**Causa:** No se configuraron las variables de entorno

**Solución:**
1. Verifica que `VITE_GITHUB_CLIENT_ID` esté en el `.env`
2. Verifica que `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` estén en Supabase
3. Reinicia la aplicación

### Error: "Failed to exchange code for token"

**Causa:** El código de OAuth expiró o es inválido

**Solución:**
1. Intenta conectar GitHub nuevamente
2. Verifica que la URL de callback coincida con la configurada en GitHub
3. Verifica que el Client Secret sea correcto

### Error: "Repository not found"

**Causa:** El repositorio no existe o no tienes acceso

**Solución:**
1. Verifica que el repositorio exista en GitHub
2. Verifica que tu token tenga permisos de acceso al repo
3. Si el repo es privado, asegúrate de tener permisos `repo`

### Error: "Failed to connect repository to Netlify"

**Causa:** Netlify no puede acceder al repositorio

**Solución:**
1. Ve a Netlify Dashboard
2. Autoriza Netlify a acceder a GitHub
3. Intenta conectar nuevamente desde la app

---

## 📊 Comparación: Antes vs Ahora

| Característica | Sin Integración | Con Integración GitHub |
|---------------|-----------------|------------------------|
| **Deploy** | Manual (subir archivos) | Automático (push a GitHub) |
| **Configuración** | Compleja (muchos pasos) | Simple (conectar y listo) |
| **Repositorio** | No requerido | Incluido |
| **Historial** | No disponible | Git completo |
| **Colaboración** | Difícil | GitHub native |
| **CI/CD** | Manual | Automático |
| **Rollback** | Difícil | Un clic |

---

## ✅ Checklist de Configuración

- [ ] Crear OAuth App en GitHub
- [ ] Copiar Client ID y Client Secret
- [ ] Configurar variables de entorno en frontend
- [ ] Configurar secrets en Supabase
- [ ] Conectar GitHub desde la app
- [ ] Crear o seleccionar repositorio
- [ ] Subir código al repositorio
- [ ] Configurar Netlify
- [ ] Conectar repo con sitio de Netlify
- [ ] Hacer primer deploy
- [ ] Verificar deploys automáticos funcionan

---

## 🎉 Beneficios del Sistema

### Para Usuarios No Técnicos
- ✅ Todo desde la UI, sin terminal
- ✅ No necesitas saber Git
- ✅ Deploys con un clic
- ✅ Historial automático

### Para Desarrolladores
- ✅ Git workflow completo
- ✅ CI/CD automático
- ✅ Fácil rollback
- ✅ Colaboración en equipo

### Para el Negocio
- ✅ Menos tiempo de setup
- ✅ Menos errores humanos
- ✅ Mayor productividad
- ✅ Mejor calidad

---

**🚀 ¡El sistema está listo para usar! Conecta tu GitHub y disfruta de deploys automáticos.**
