# Multi-Environment Authentication Platform

Sistema completo de autenticación multi-ambiente con API REST estándar por ambiente.

## 🚀 Características

- **API REST por Ambiente**: Endpoints `/api/auth/*` específicos por ambiente
- **Multi-ambiente**: Desarrollo, Testing, Producción con URLs y API Keys independientes
- **Seguridad Avanzada**: JWT, bcrypt, rate limiting, CORS
- **API Keys por Ambiente**: Autenticación mediante X-API-Key header
- **Formularios Públicos**: Login, registro y recuperación de contraseña
- **Dashboard Administrativo**: Gestión completa de aplicaciones y usuarios
- **Documentación API**: Ejemplos y guías de integración

## 📚 Documentación recomendada

- [Arquitectura y negocio](docs/arquitectura-y-negocio.md)
- [Flujo de autenticación del cliente](FLUJO_AUTENTICACION_CLIENTE.md)
- [Guía de integración para clientes](docs/client-integration-guide.md)
- [README de la app móvil Authenticator](mobile-authenticator/README.md)

## 🛠️ Instalación y Configuración

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env` con los valores de respaldo para el bootstrap y desarrollo local:
```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
JWT_SECRET=tu_jwt_secret_super_seguro
PORT=3001
VITE_ENV_CONFIG_URL=https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
VITE_ENV_CONFIG_ACCESS_KEY=tu_access_key_de_get_env

# Variables para edge functions del backend
EMAIL_API_URL=https://tu-servicio-email/functions/v1/send-email
EMAIL_API_KEY=tu_api_key_de_email
VALIDATION_API_URL=https://tu-servicio-validacion/functions/v1/validation-api
SUBSCRIPTION_SYNC_API_URL=https://tu-servicio-suscripciones/functions/v1/admin-api
```

> La aplicación carga primero la configuración remota desde `/get-env`. Si esa API no está disponible, usa las variables `VITE_*` del build como respaldo.
> Las edge functions también toman configuración desde variables de entorno para evitar URLs y secretos hardcodeados en el código.

## 🌍 Configuración por Ambientes

Cada ambiente tiene su propia configuración:

### Development

### Testing  
- **Base URL**: `https://auth-test.tudominio.com`

### Production
- **Base URL**: `https://auth.tudominio.com`

### 3. Ejecutar en Desarrollo
```bash
# Solo frontend
npm run dev

# Frontend + API juntos
npm run dev:full
```

## 🚀 Despliegue en Netlify

### Configuración Automática

Este proyecto está configurado para desplegarse automáticamente en Netlify con:
- **Frontend**: Build estático servido desde `/dist`
- **API**: Funciones serverless en `/.netlify/functions/api`
- **Redirects**: Configurados automáticamente para SPA y API

### Pasos para Desplegar

1. **Conectar Repositorio**:
   - Ve a [Netlify](https://netlify.com)
   - Conecta tu repositorio de GitHub/GitLab
   - Netlify detectará automáticamente la configuración

2. **Variables de Entorno**:
   Configura estas variables en Netlify Dashboard > Site Settings > Environment Variables:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   JWT_SECRET=tu_jwt_secret_super_seguro
   ```

3. **Deploy**:
   - Netlify construirá automáticamente el frontend y las funciones
   - El frontend estará disponible en tu dominio de Netlify
   - La API estará disponible en `tu-sitio.netlify.app/api/*`

### URLs Después del Deploy

```
Frontend: https://tu-sitio.netlify.app
API Base: https://tu-sitio.netlify.app/api

Endpoints:
- POST /api/auth/login
- POST /api/auth/register  
- POST /api/auth/verify
- GET  /api/users
- GET  /api/health
```

### Configuración de Dominios Personalizados

1. En Netlify Dashboard > Domain Settings
2. Agrega tu dominio personalizado
3. Configura DNS según las instrucciones
4. Actualiza las URLs en tu aplicación:
   ```
   Frontend: https://auth.tudominio.com
   API: https://auth.tudominio.com/api
   ```

## 📚 API Endpoints

### URLs por Ambiente
```
Development: https://auth-dev.tudominio.com/api
Testing:     https://auth-test.tudominio.com/api  
Production:  https://auth.tudominio.com/api
Local:       http://localhost:3001/api
```

### Headers Requeridos
Todas las peticiones deben incluir:
```http
Content-Type: application/json
X-API-Key: tu_api_key_del_ambiente
```

### Autenticación

#### Login
```http
POST https://auth-dev.tudominio.com/api/auth/login
Content-Type: application/json
X-API-Key: ak_dev_1234567890abcdef1234567890abcdef

{
  "email": "usuario@ejemplo.com",
  "password": "micontraseña123",
  "application_id": "app_mk2k3j4h5k6l",
  "redirect_uri": "https://miapp.com/callback" // opcional
}
```

#### Registro
```http
POST https://auth-dev.tudominio.com/api/auth/register
Content-Type: application/json
X-API-Key: ak_dev_1234567890abcdef1234567890abcdef

{
  "email": "nuevo@ejemplo.com",
  "password": "contraseña123",
  "name": "Nuevo Usuario",
  "application_id": "app_mk2k3j4h5k6l",
  "redirect_uri": "https://miapp.com/callback", // opcional
  "metadata": {} // opcional
}
```

#### Recuperar Contraseña
```http
POST https://auth-dev.tudominio.com/api/auth/reset-password
Content-Type: application/json
X-API-Key: ak_dev_1234567890abcdef1234567890abcdef

{
  "email": "usuario@ejemplo.com",
  "application_id": "app_mk2k3j4h5k6l",
  "redirect_uri": "https://miapp.com/callback" // opcional
}
```

#### Verificar Token
```http
POST https://auth-dev.tudominio.com/api/auth/verify
Content-Type: application/json
X-API-Key: ak_dev_1234567890abcdef1234567890abcdef

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "application_id": "app_mk2k3j4h5k6l"
}
```

### Gestión de Usuarios

#### Listar Usuarios
```http
GET https://auth-dev.tudominio.com/api/users?application_id=app_mk2k3j4h5k6l&page=1&limit=50&search=juan
X-API-Key: tu_api_key
```

## 🔧 Integración con Terceros

### Configuración para Postman (Desarrollo Local)

**⚠️ IMPORTANTE**: Si estás probando con Postman en desarrollo local, usa:

```
URL: http://localhost:3001/api/auth/login
Headers:
  Content-Type: application/json
  X-API-Key: tu_api_key_real_generada_en_dashboard
```

**NO uses las URLs de WebContainer** como:
- `https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3-6prh5986--3001--96435430.local-credentialless.webcontainer-api.io`

Estas URLs son internas de WebContainer y no funcionan desde Postman externo.

### JavaScript/Node.js
```javascript
const response = await fetch('https://auth-dev.tudominio.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'ak_dev_1234567890abcdef1234567890abcdef'
  },
  body: JSON.stringify({
    email: 'usuario@ejemplo.com',
    password: 'micontraseña123',
    application_id: 'app_mk2k3j4h5k6l'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Token:', data.data.access_token);
  console.log('Usuario:', data.data.user);
}
```

### Python
```python
import requests

headers = {'X-API-Key': 'ak_dev_1234567890abcdef1234567890abcdef'}
response = requests.post('http://localhost:3001/api/auth/login', json={
    'email': 'usuario@ejemplo.com',
    'password': 'micontraseña123',
    'application_id': 'app_mk2k3j4h5k6l'
}, headers=headers)

data = response.json()
if data['success']:
    print('Token:', data['data']['access_token'])
```

### cURL
```bash
curl -X POST https://auth-dev.tudominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_dev_1234567890abcdef1234567890abcdef" \
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "micontraseña123",
    "application_id": "app_mk2k3j4h5k6l"
  }'
```

## 🎨 Formularios Públicos

Los formularios públicos están disponibles en:

- `redirect_uri`: URL de redirección después del éxito. `callback_url` sigue como alias compatible.
- `form`: Tipo de formulario (login, register, reset-password)

## 🔒 Seguridad

- **API Keys**: Autenticación mediante header X-API-Key por ambiente
- **JWT**: Tokens firmados con HS256
- **Passwords**: Hasheados con bcrypt (12 rounds)
- **Rate Limiting**: 10 intentos por 15 minutos por IP
- **CORS**: Configurado para permitir orígenes específicos
- **Headers de Seguridad**: Helmet.js para protección adicional

## 📊 Respuestas de la API

### Éxito
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "user_123",
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "roles": ["user"],
      "permissions": ["read"]
    }
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email o contraseña incorrectos"
  }
}
```

## 🚀 Despliegue en Producción

### Por Ambiente

1. **Development**: 
   - URL: `https://auth-dev.tudominio.com`
   - API Key: Generar desde el dashboard

2. **Testing**:
   - URL: `https://auth-test.tudominio.com` 
   - API Key: Generar desde el dashboard

3. **Production**:
   - URL: `https://auth.tudominio.com`
   - API Key: Generar desde el dashboard

### Configuración General
1. **Variables de Entorno**: Configura todas las variables en tu servidor
2. **Base de Datos**: Asegúrate de que Supabase esté configurado
3. **HTTPS**: Usa HTTPS en producción
4. **Rate Limiting**: Ajusta los límites según tu necesidad
5. **Logs**: Configura logging apropiado
6. **Monitoreo**: Implementa monitoreo de salud

## 🔑 Gestión de API Keys

- Cada ambiente tiene API Keys independientes
- Se generan desde el dashboard administrativo
- Formato: `ak_{env}_{32_caracteres_aleatorios}`
- Se envían en el header `X-API-Key`

## 📝 Códigos de Error

- `MISSING_FIELDS`: Campos requeridos faltantes
- `APPLICATION_NOT_FOUND`: Aplicación no encontrada
- `INVALID_CREDENTIALS`: Credenciales incorrectas
- `EMAIL_ALREADY_EXISTS`: Email ya registrado
- `EMAIL_NOT_VERIFIED`: Email no verificado
- `USER_INACTIVE`: Usuario inactivo
- `RATE_LIMIT_EXCEEDED`: Límite de intentos excedido
- `INVALID_TOKEN`: Token inválido o expirado
- `INTERNAL_ERROR`: Error interno del servidor

## 🤝 Soporte

Para soporte técnico o preguntas sobre la integración, consulta la documentación en el dashboard administrativo o contacta al equipo de desarrollo.
