# 📧 Configuración de la API Externa de Emails

## Variables de Entorno en Supabase

Para que el sistema de recuperación de contraseña funcione con la API externa de emails, debes configurar las siguientes **secrets** en tu proyecto de Supabase.

### 1. Acceder a Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, selecciona **Project Settings** (⚙️)
3. Selecciona **Edge Functions**
4. Busca la sección **Secrets**

### 2. Variables Requeridas

#### `EMAIL_API_URL`
- **Descripción**: URL de la API externa que enviará los emails
- **Valor**: `https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email`
- **Tipo**: String (URL)

#### `EMAIL_API_KEY`
- **Descripción**: API Key para autenticación con la API externa
- **Valor**: `sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee`
- **Tipo**: String (Secret Key)
- **⚠️ Importante**: Esta key se envía en el header `x-api-key`

### 3. Cómo Agregar las Variables

#### Opción A: Desde el Dashboard (Recomendado)

1. En **Edge Functions > Secrets**, haz clic en **Add Secret**
2. Agrega la primera variable:
   - **Name**: `EMAIL_API_URL`
   - **Value**: `https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email`
3. Haz clic en **Save**
4. Repite para la segunda variable:
   - **Name**: `EMAIL_API_KEY`
   - **Value**: `sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee`

#### Opción B: Usando Supabase CLI

```bash
# Configurar EMAIL_API_URL
supabase secrets set EMAIL_API_URL=https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email

# Configurar EMAIL_API_KEY
supabase secrets set EMAIL_API_KEY=sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee
```

### 4. Verificar la Configuración

Después de configurar las variables, puedes verificarlas:

```bash
# Listar todas las secrets
supabase secrets list
```

Deberías ver:
```
EMAIL_API_URL
EMAIL_API_KEY
```

---

## 📋 Payload que se Envía a la API

La edge function `auth-reset-password` envía el siguiente payload a la API externa:

```json
{
  "template_name": "reset-password",
  "recipient_email": "usuario@ejemplo.com",
  "data": {
    "client_name": "Nombre del Usuario",
    "reset_url": "https://app-domain.com/reset-password-confirm?token=abc123&email=usuario@ejemplo.com"
  }
}
```

### Headers Enviados

```
Content-Type: application/json
x-api-key: sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee
```

---

## 🔄 Flujo Completo

```
1. Usuario solicita recuperación de contraseña
   ↓
2. Edge function genera token y URL
   URL: /reset-password-confirm?token=XXX&email=YYY
   ↓
3. Edge function llama a EMAIL_API_URL
   Header: x-api-key: EMAIL_API_KEY
   Body: { template_name, recipient_email, data }
   ↓
4. API externa envía el email
   ↓
5. Usuario recibe email con link
   ↓
6. Usuario hace clic en el link
   ↓
7. Se muestra formulario de "Nueva Contraseña"
```

---

## ⚠️ Notas Importantes

### 1. Valores por Defecto
Si no configuras las variables, se usarán estos valores por defecto (definidos en el código):
- `EMAIL_API_URL`: `https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email`
- `EMAIL_API_KEY`: `sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee`

### 2. Seguridad
- **NUNCA** expongas el `EMAIL_API_KEY` en el código del frontend
- Esta key solo debe estar en las secrets de Supabase
- La edge function la usa de forma segura en el backend

### 3. Manejo de Errores
Si la API externa falla:
- El flujo de reset password continúa
- El token se guarda en la base de datos
- Se registra el error en los logs
- El usuario puede usar el token manualmente si es necesario

### 4. Configuración de la Aplicación
La bandera `send_password_reset_email` en `applications.email_config` controla si se envían emails:

```json
{
  "send_password_reset_email": true
}
```

Si es `false`, no se llamará a la API externa.

---

## 🧪 Testing

### Probar la Configuración

Puedes probar que las variables están configuradas correctamente haciendo una llamada a la edge function:

```bash
curl -X POST \
  https://TU_PROYECTO.supabase.co/functions/v1/auth-reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "application_id": "tu-app-id",
    "api_key": "tu-api-key"
  }'
```

Revisa los logs en el Dashboard de Supabase para ver si la llamada a la API externa fue exitosa.

---

## 📝 Logs y Debugging

Los logs de la edge function mostrarán:

```
📧 Sending reset password email via external API...
📧 API URL: https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email
📧 Recipient: usuario@ejemplo.com
✅ Email sent successfully via external API
```

Si hay errores:
```
❌ Email API Error: { status: 401, statusText: 'Unauthorized', error: '...' }
⚠️ Email sending failed, but continuing with reset flow
```

---

## 🔧 Troubleshooting

### Error: "Email API error: 401"
- Verifica que `EMAIL_API_KEY` está configurada correctamente
- Verifica que el valor coincide exactamente con el esperado por la API

### Error: "Email API error: 404"
- Verifica que `EMAIL_API_URL` está configurada correctamente
- Verifica que la URL de la API externa es accesible

### Email no llega
- Revisa los logs de la edge function
- Revisa los logs de la API externa
- Verifica que `send_password_reset_email` es `true` en la configuración de la aplicación

### Token inválido
- El token expira en 24 horas
- Verifica que el token esté en la tabla `email_verification_tokens`
- Verifica que `expires_at` no ha pasado
