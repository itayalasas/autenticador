# Instrucciones para Subir Cambios a GitHub

## Cambios Realizados

Se han corregido los errores de CORS en el sistema de autenticación:

### Archivos Modificados:
1. **src/components/auth/PublicAuthForms.tsx** (línea 241)
   - Cambió URL hardcodeada por URL relativa: `/.netlify/functions/api`
   - Esto elimina problemas de CORS entre dominios

2. **netlify/functions/api.js** (líneas 3-10)
   - Actualizó headers CORS para aceptar todos los headers necesarios
   - Agregó `Access-Control-Allow-Credentials: true`

## Pasos para Subir a GitHub

### 1. Conectar con tu repositorio remoto
Si aún no lo has hecho, conecta este repositorio local con GitHub:

```bash
git remote add origin https://github.com/itayalasas/auth-apis-pets.git
```

### 2. Verificar la conexión
```bash
git remote -v
```

### 3. Subir los cambios
```bash
git push -u origin master
```

O si tu rama principal se llama "main":
```bash
git branch -M main
git push -u origin main
```

### 4. Verificar en Netlify
Una vez que los cambios estén en GitHub:
1. Netlify detectará automáticamente el push
2. Iniciará un nuevo deploy
3. En 2-3 minutos, el sitio estará actualizado con los cambios

## Estado del Commit

Commit ID: 557a800
Mensaje: "Fix CORS error: Use relative URLs for API calls and update CORS headers"
Archivos: 271 archivos, 86,258 inserciones

## Verificar después del Deploy

Después de que Netlify termine el deploy:
1. Visita: https://auth-apis-pets.netlify.app/login?app_id=app_8cc6bda9-120
2. Intenta iniciar sesión
3. El error de CORS debe estar resuelto
4. Las peticiones irán a `/.netlify/functions/api` (mismo dominio)

## ¿Por qué funciona ahora?

**ANTES:**
- `https://auth-apis-pets.netlify.app` → `https://authsystem-dashboard.netlify.app`
- ❌ Cross-origin request → CORS error

**AHORA:**
- `https://auth-apis-pets.netlify.app` → `https://auth-apis-pets.netlify.app/.netlify/functions/api`
- ✅ Same-origin request → Sin CORS issues

## Solución de Problemas

Si aún ves el error después del deploy:
1. Limpia la caché del navegador (Ctrl+Shift+Delete)
2. Verifica en Netlify que el deploy se completó
3. Revisa los logs en Netlify Functions
