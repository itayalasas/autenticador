# ⚡ COMANDOS RÁPIDOS - DEPLOY COMPLETO

## 🎯 PROBLEMA ACTUAL:
- ✅ Login funciona parcialmente pero muestra "API Key inválida"
- ✅ Register crea usuarios pero con rol incorrecto
- ✅ Reset password no probado

## 📝 LO QUE SE CORRIGIÓ:

### 1. Frontend (Dashboard):
- ✅ Extrae `api_key` de la URL
- ✅ Envía `api_key` en payload de login, register, reset-password
- ✅ Envía `role` seleccionado en el registro

### 2. Backend (Edge Functions):
- ⚠️ auth-register: Corregida para usar el rol seleccionado
- ✅ auth-login: Ya tiene validación de API key
- ✅ auth-reset-password: Ya tiene validación de API key  
- ✅ auth-reset-password-confirm: Ya tiene validación de API key

---

## 🚀 DESPLEGAR TODO (3 PASOS):

### PASO 1: Desplegar Dashboard (Frontend)
```bash
# Ir a: https://app.netlify.com/
# Seleccionar: celadon-begonia-d7eb0e
# Click: Deploys → Deploy manually
# Arrastrar: dist/
# Esperar: 1-2 minutos
```

### PASO 2: Desplegar Edge Function (Backend)
```bash
# Opción A - CLI (más rápido):
supabase functions deploy auth-register --project-ref sfqtmnncgiqkveaoqckt

# Opción B - Dashboard:
# 1. https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/functions
# 2. Click en "auth-register" → "Edit"
# 3. Copiar código de: supabase/functions/auth-register/index.ts
# 4. Pegar y "Deploy"
```

### PASO 3: Probar Flujo Completo
```bash
# 1. Ir al dashboard actualizado
# 2. Ir a Aplicaciones → Ambientes
# 3. Click en "Desplegar"
# 4. Esperar que genere la URL
# 5. Click en "Ver Formularios" → "Registro"
# 6. Completar datos y seleccionar "Cliente"
# 7. Verificar en Dashboard → Usuarios que tiene rol "cliente"
```

---

## ✅ CHECKLIST FINAL:

- [x] Código frontend actualizado (api_key + role)
- [x] Código backend actualizado (auth-register con roles)
- [x] Build ejecutado (dist/ generado)
- [ ] **Dashboard desplegado en Netlify** ← PENDIENTE
- [ ] **Edge Function desplegada en Supabase** ← PENDIENTE
- [ ] **Prueba de registro completa** ← PENDIENTE
- [ ] **Prueba de login completa** ← PENDIENTE

---

## 📋 ARCHIVOS MODIFICADOS:

```
src/utils/
├── publicAuthFormsTemplate.ts      ← Agregado api_key a payloads
└── netlifyReactProjectHelper.ts    ← Extrae api_key de URL

supabase/functions/
└── auth-register/
    └── index.ts                    ← Usa rol del payload
```

---

## 🐛 SI ALGO FALLA:

### "API Key inválida" después de desplegar:
```bash
# 1. Verifica que desplegaste el dist/ actualizado
# 2. Limpia caché del navegador (Ctrl+Shift+R)
# 3. Verifica en DevTools → Network que el payload incluye api_key
# 4. Verifica que el api_key en la URL es el correcto
```

### "Usuario creado con rol incorrecto":
```bash
# 1. Verifica que desplegaste la Edge Function actualizada
# 2. Ve a Supabase → Functions → auth-register
# 3. Ve a Logs y verifica el mensaje "🎭 Role from request:"
# 4. Verifica que el rol existe en application_roles
```

### "Email no llega":
```bash
# 1. Ve a Dashboard → Configuración → Email
# 2. Verifica configuración SMTP/Resend/SendGrid
# 3. Ve a Supabase → Email Logs para ver el estado
```

---

## 🎉 RESULTADO ESPERADO:

```
┌──────────────────────────────────────────────────┐
│  ✅ REGISTRO                                     │
│  - Selecciona "Cliente"                          │
│  - Crea usuario con rol "cliente"                │
│  - Redirige al callback                          │
├──────────────────────────────────────────────────┤
│  ✅ LOGIN                                        │
│  - Valida API key correctamente                  │
│  - Retorna tokens de acceso                      │
│  - Redirige al callback                          │
├──────────────────────────────────────────────────┤
│  ✅ RECUPERAR CONTRASEÑA                         │
│  - Valida API key correctamente                  │
│  - Envía email con token                         │
│  - Permite resetear contraseña                   │
└──────────────────────────────────────────────────┘
```

---

**¡SOLO FALTA DESPLEGAR! 🚀**
