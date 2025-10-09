# Guía de Importación Manual de Edge Functions en Supabase

Esta guía te muestra cómo importar manualmente todas las Edge Functions en Supabase Dashboard.

## 📋 Archivo de Código

Abre el archivo: **`EDGE_FUNCTIONS_EXPORT.md`** (124 KB, 4,055 líneas)

Este archivo contiene el código completo de las 11 Edge Functions.

## 🚀 Proceso de Importación Manual

### Paso 1: Acceder al Editor de Edge Functions

1. Ve a tu proyecto en **Supabase Dashboard**
2. En el menú lateral, busca **Edge Functions**
3. Haz clic en **"Create a new function"**

### Paso 2: Crear Cada Función

Para cada una de las 11 funciones, repite estos pasos:

#### Función 1: auth-login

1. **Crear función en Supabase:**
   - Haz clic en **"New Function"**
   - Nombre: `auth-login`
   - Deja el template por defecto

2. **Copiar código:**
   - Abre `EDGE_FUNCTIONS_EXPORT.md`
   - Busca la sección: `## auth-login`
   - Copia TODO el código dentro del bloque ```typescript ... ```
   - Pega en el editor de Supabase

3. **Configurar:**
   - Verify JWT: **OFF** (desactivado)
   - Guarda y despliega

4. **Verificar URL:**
   ```
   https://TU_PROJECT.supabase.co/functions/v1/auth-login
   ```

#### Función 2: auth-register

1. **Crear función en Supabase:**
   - Nueva función con nombre: `auth-register`

2. **Copiar código:**
   - En `EDGE_FUNCTIONS_EXPORT.md`, busca: `## auth-register`
   - Copia el código completo del bloque typescript
   - Pega en el editor

3. **Configurar:**
   - Verify JWT: **OFF**
   - Guarda y despliega

#### Función 3: auth-reset-password

1. **Crear:** `auth-reset-password`
2. **Copiar código** de la sección `## auth-reset-password`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 4: auth-reset-password-confirm

1. **Crear:** `auth-reset-password-confirm`
2. **Copiar código** de la sección `## auth-reset-password-confirm`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 5: check-ip-status

1. **Crear:** `check-ip-status`
2. **Copiar código** de la sección `## check-ip-status`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 6: debug-email-config

1. **Crear:** `debug-email-config`
2. **Copiar código** de la sección `## debug-email-config`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 7: debug-env-vars

1. **Crear:** `debug-env-vars`
2. **Copiar código** de la sección `## debug-env-vars`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 8: send-email

1. **Crear:** `send-email`
2. **Copiar código** de la sección `## send-email`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 9: sync-dlocal-plans

1. **Crear:** `sync-dlocal-plans`
2. **Copiar código** de la sección `## sync-dlocal-plans`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 10: sync-dlocal-subscriptions

1. **Crear:** `sync-dlocal-subscriptions`
2. **Copiar código** de la sección `## sync-dlocal-subscriptions`
3. **Verify JWT:** OFF
4. **Desplegar**

#### Función 11: test-dlocal-auth

1. **Crear:** `test-dlocal-auth`
2. **Copiar código** de la sección `## test-dlocal-auth`
3. **Verify JWT:** OFF
4. **Desplegar**

## ⚙️ Configurar Variables de Ambiente

**IMPORTANTE:** Antes de probar las funciones, configura estas variables:

1. Ve a **Project Settings → Edge Functions → Manage secrets**
2. Agrega estos secrets:

```
DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
DLOCAL_API_URL=https://api-sbx.dlocalgo.com
```

## ✅ Verificar Instalación

### Prueba 1: Verificar Variables de Ambiente

```bash
curl -X POST "https://TU_PROJECT.supabase.co/functions/v1/debug-env-vars" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
```json
{
  "message": "Environment variables check",
  "available_vars": {
    "SUPABASE_URL": "SET",
    "SUPABASE_ANON_KEY": "SET",
    "SUPABASE_SERVICE_ROLE_KEY": "SET"
  }
}
```

### Prueba 2: Test de Autenticación dLocal

```bash
curl -X POST "https://TU_PROJECT.supabase.co/functions/v1/test-dlocal-auth" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Authentication tests completed",
  "results": [
    {
      "test": "DLOCAL_* variables",
      "status": 200,
      "success": true,
      "response": "SUCCESS"
    }
  ]
}
```

### Prueba 3: Registro de Usuario

```bash
curl -X POST "https://TU_PROJECT.supabase.co/functions/v1/auth-register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "application_id": "app_test123"
  }'
```

## 📊 Resumen de Funciones

| # | Nombre | Propósito | Verify JWT |
|---|--------|-----------|------------|
| 1 | auth-login | Login de usuarios | OFF |
| 2 | auth-register | Registro de usuarios | OFF |
| 3 | auth-reset-password | Solicitar reset de password | OFF |
| 4 | auth-reset-password-confirm | Confirmar reset de password | OFF |
| 5 | check-ip-status | Verificar IPs bloqueadas | OFF |
| 6 | debug-email-config | Debug configuración email | OFF |
| 7 | debug-env-vars | Debug variables ambiente | OFF |
| 8 | send-email | Enviar emails | OFF |
| 9 | sync-dlocal-plans | Sincronizar planes dLocal | OFF |
| 10 | sync-dlocal-subscriptions | Sincronizar suscripciones | OFF |
| 11 | test-dlocal-auth | Probar auth dLocal | OFF |

## 🔍 Estructura del Archivo EDGE_FUNCTIONS_EXPORT.md

El archivo está organizado así:

```
# Edge Functions Export

## Lista de Edge Functions
[Índice de todas las funciones]

---

## auth-login
```typescript
[Código completo de auth-login]
```
---

## auth-register
```typescript
[Código completo de auth-register]
```
---

[... y así para todas las funciones]
```

## 💡 Consejos

1. **Orden de importación:** No importa el orden, pero te recomiendo empezar con `debug-env-vars` para verificar configuración

2. **Copiar código:** Asegúrate de copiar TODO el código dentro de los bloques ```typescript

3. **Verify JWT:** Todas las funciones deben tener Verify JWT en **OFF**

4. **Variables:** Configura las variables ANTES de probar las funciones

5. **Logs:** Usa el panel de logs en Supabase para ver errores

## 🆘 Problemas Comunes

### Error: "Function not found"
**Solución:** Verifica que desplegaste la función después de crearla

### Error: "Invalid Credentials" en dLocal
**Solución:** Verifica que configuraste los secrets correctamente

### Error: "CORS"
**Solución:** El código ya incluye CORS headers, no necesitas configurar nada

### Error al copiar código
**Solución:** Asegúrate de copiar desde el inicio del `import` hasta el final del archivo

## 📝 Checklist de Importación

- [ ] Función 1: auth-login ✓
- [ ] Función 2: auth-register ✓
- [ ] Función 3: auth-reset-password ✓
- [ ] Función 4: auth-reset-password-confirm ✓
- [ ] Función 5: check-ip-status ✓
- [ ] Función 6: debug-email-config ✓
- [ ] Función 7: debug-env-vars ✓
- [ ] Función 8: send-email ✓
- [ ] Función 9: sync-dlocal-plans ✓
- [ ] Función 10: sync-dlocal-subscriptions ✓
- [ ] Función 11: test-dlocal-auth ✓
- [ ] Variables de ambiente configuradas ✓
- [ ] Test de debug-env-vars exitoso ✓
- [ ] Test de test-dlocal-auth exitoso ✓
- [ ] Test de registro de usuario exitoso ✓

## 🎯 Tiempo Estimado

- **Importación de 11 funciones:** 20-30 minutos
- **Configuración de variables:** 2-3 minutos
- **Testing:** 5-10 minutos
- **Total:** 30-45 minutos

---

**Última actualización:** 2025-10-09
**Archivo de código:** EDGE_FUNCTIONS_EXPORT.md (124 KB)
