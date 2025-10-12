# 🎯 CORRECCIONES: Integración con APIs de Autenticación

## ✅ Problemas Corregidos:

### 1️⃣ **API Key no se extraía de la URL**
**Antes**: El código intentaba obtener el API key desde la base de datos
**Ahora**: Extrae el `api_key` directamente de los parámetros de la URL

```typescript
// Antes (INCORRECTO):
const { data: apiKeys } = await supabase
  .from('api_keys')
  .select('*')
  .eq('application_id', app.id)
  .limit(1);
setApiKey(apiKeys[0].key_hash);

// Ahora (CORRECTO):
const apiKeyFromUrl = searchParams.get('api_key');
setApiKey(apiKeyFromUrl);
```

### 2️⃣ **API Key no se enviaba en el payload**
**Antes**: Las llamadas a las Edge Functions NO incluían el `api_key` en el body
**Ahora**: Todas las funciones reciben el `api_key` en el payload

```typescript
// Login
payload = {
  email: formData.email,
  password: formData.password,
  application_id: applicationId,
  api_key: apiKey,  // ← AGREGADO
  callback_url: callbackUrl,
  client_ip: clientIp
};

// Register
payload = {
  email: formData.email,
  password: formData.password,
  name: formData.name,
  application_id: applicationId,
  api_key: apiKey,  // ← AGREGADO
  callback_url: callbackUrl,
  role: selectedRole || undefined,
  client_ip: clientIp
};

// Reset Password
payload = {
  email: formData.email,
  application_id: applicationId,
  api_key: apiKey,  // ← AGREGADO
  client_ip: clientIp
};
```

---

## 🔄 Flujo Completo de Autenticación

### **URL de Registro:**
```
https://tu-app.netlify.app/register?app_id=3acde27f...&api_key=ak_production_89319a...&redirect_uri=https://dashboard.authsystem.local/auth/callback
```

### **Parámetros Extraídos:**
1. ✅ `app_id` → Se usa como `application_id`
2. ✅ `api_key` → Se envía en el payload a las Edge Functions
3. ✅ `redirect_uri` → Se usa como `callback_url` para redirección post-auth
4. ✅ `client_ip` → Se detecta automáticamente (via ipify.org)

### **Payload Enviado a Edge Function:**
```json
{
  "email": "ale@gmail.com",
  "password": "********",
  "name": "Alejandra Londoño",
  "application_id": "3acde27f-7d43-465e-aaec-94ad46faa881",
  "api_key": "ak_production_89319a5b21fa2408fe7c0800215b19d7",
  "callback_url": "https://dashboard.authsystem.local/auth/callback",
  "role": "Cliente",
  "client_ip": "186.48.98.237"
}
```

### **Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "ale@gmail.com",
      "name": "Alejandra Londoño"
    },
    "access_token": "eyJhbGci...",
    "refresh_token": "refresh_token...",
    "callback_url": "https://dashboard.authsystem.local/auth/callback"
  }
}
```

---

## 🚀 Para Desplegar (2 MINUTOS):

### **Deploy del Dashboard:**
1. Ve a https://app.netlify.com/
2. Selecciona tu site del **Dashboard** (AuthSystem admin)
3. **Deploys** → **Deploy manually**
4. Arrastra la carpeta **`dist/`**
5. ✅ Espera 1-2 minutos

### **Probar el Flujo:**
1. Abre el dashboard actualizado
2. Selecciona una aplicación
3. Ve a **"Ambientes"** → **"Desplegar"**
4. Una vez desplegado, haz clic en **"Ver Formularios"**
5. Prueba **Registro**, **Login** y **Recuperar Contraseña**

---

## ✅ Resultado Esperado:

### **Registro:**
- ✅ Extrae `api_key` de la URL
- ✅ Envía `api_key` en el payload
- ✅ Crea usuario en `auth.users`
- ✅ Crea entrada en `app_users` con el rol seleccionado
- ✅ Registra el evento en `auth_logs`
- ✅ Redirige al `callback_url`

### **Login:**
- ✅ Extrae `api_key` de la URL
- ✅ Envía `api_key` en el payload
- ✅ Valida credenciales
- ✅ Retorna tokens de acceso
- ✅ Registra el evento en `auth_logs`
- ✅ Redirige al `callback_url`

### **Recuperar Contraseña:**
- ✅ Extrae `api_key` de la URL
- ✅ Envía `api_key` en el payload
- ✅ Genera token de recuperación
- ✅ Envía email con enlace de recuperación
- ✅ Registra el evento en `auth_logs`

---

## 📝 Edge Functions que Reciben el Payload:

1. ✅ `/functions/v1/auth-register` → Registro de usuarios
2. ✅ `/functions/v1/auth-login` → Inicio de sesión
3. ✅ `/functions/v1/auth-reset-password` → Recuperación de contraseña
4. ✅ `/functions/v1/check-ip-status` → Verificación de IPs bloqueadas

---

## 🆘 Si Algo Sale Mal:

### **"API key no disponible":**
- ✅ Verifica que la URL incluya `?api_key=ak_production_...`
- ✅ Verifica que desplegaste el dashboard actualizado
- ✅ Limpia caché del navegador (Ctrl+Shift+R)

### **"Application not found":**
- ✅ Verifica que el `app_id` en la URL es correcto
- ✅ Verifica que la aplicación existe en la BD

### **"Invalid credentials":**
- ✅ Verifica email y contraseña
- ✅ Revisa la tabla `auth_logs` para ver intentos fallidos

---

## 📁 Archivos Actualizados:

```
src/utils/
├── publicAuthFormsTemplate.ts  ← Agregado api_key al payload
└── netlifyReactProjectHelper.ts ← Extrae api_key de URL
```

---

**¡TODO LISTO! Solo deploya y prueba el flujo completo.** 🎉
