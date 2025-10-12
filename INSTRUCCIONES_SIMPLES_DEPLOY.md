# 🚀 INSTRUCCIONES SUPER SIMPLES - DEPLOY DEL DASHBOARD

## ❗ IMPORTANTE

El error que ves (`getBranding is not a function`) es porque el **Dashboard desplegado tiene código viejo**.

Necesitas **actualizar el Dashboard UNA VEZ** para que todos los deployments futuros funcionen correctamente.

---

## 📋 PASO A PASO (5 MINUTOS)

### **Opción 1: Deploy Manual en Netlify (MÁS FÁCIL)** ⚡

1. **Ve a Netlify**: https://app.netlify.com/
2. **Selecciona tu site** del Dashboard (el admin panel donde entras a gestionar aplicaciones)
3. **Clic en** "Deploys" → "Deploy manually"
4. **Arrastra esta carpeta**: `dist/` (que está en este proyecto)
5. **Espera 1-2 minutos** ✅

**¡LISTO!** Una vez hecho esto, el botón "Desplegar" en tu dashboard YA generará formularios con:
- ✅ Branding correcto
- ✅ Selector de roles
- ✅ Campo tipo de documento
- ✅ Campo número de documento

---

### **Opción 2: Deploy via Git** 📚

Si tienes el dashboard conectado a GitHub:

```bash
# En este directorio:
cd /tmp/cc-agent/58424341/project

# Iniciar git si no existe
git init
git branch -M main

# Agregar remote (reemplaza con tu URL real)
git remote add origin https://github.com/TU_USUARIO/TU_REPO_DASHBOARD.git

# Commit y push
git add .
git commit -m "feat: add document type field and fix branding/roles"
git push -u origin main
```

Netlify detectará el cambio y deployará automáticamente.

---

## 🎯 ¿Qué cambia después del deploy?

### ANTES (Dashboard viejo):
- ❌ `getBranding is not a function`
- ❌ `getAvailableRolesForRegistration is not a function`
- ❌ Formularios sin branding
- ❌ Sin selector de roles

### DESPUÉS (Dashboard nuevo):
- ✅ Branding funciona perfecto (logo, colores, fuentes)
- ✅ Selector de roles funciona
- ✅ Campo "Tipo de Documento" (DNI, RUT, CC, CE, Pasaporte)
- ✅ Campo "Número de Documento"
- ✅ Todo generado automáticamente desde el botón "Desplegar"

---

## 📁 Archivos Actualizados

Los archivos que se actualizaron (ya están compilados en `dist/`):

- `src/utils/publicAuthFormsTemplate.ts` - Agregado campos de documento
- `src/utils/netlifyReactProjectHelper.ts` - Genera `PublicAuthRouter` correctamente
- `src/services/applicationService.ts` - Método `getBranding()` funcional
- `src/services/rolesService.ts` - Método `getAvailableRolesForRegistration()` funcional
- `src/components/environments/EnvironmentsManager.tsx` - Deployment mejorado

---

## 🧪 Cómo Probar que Funciona

1. **Después de deployar el dashboard**, abre el dashboard actualizado
2. **Crea o edita una aplicación**
3. **Configura branding**:
   - Sube un logo
   - Elige colores
   - Personaliza textos
4. **Configura roles**:
   - Ve a "Roles & Permisos"
   - Crea roles (Estudiante, Profesor, etc.)
   - Marca "Disponible para Registro" ✅
5. **Haz clic en "Desplegar"** en el ambiente
6. **Abre el formulario desplegado**
7. **Verifica que muestra**:
   - ✅ Tu logo
   - ✅ Tus colores
   - ✅ Selector de tipo de usuario (roles)
   - ✅ Tipo de documento (DNI, RUT, CC, CE, Pasaporte)
   - ✅ Número de documento

---

## 🆘 Si Sigues Viendo el Error

1. **Limpia caché del navegador**: Ctrl+Shift+R o Cmd+Shift+R
2. **Verifica que hiciste deploy del DASHBOARD**, no de la aplicación
3. **Espera 2-3 minutos** después del deploy
4. **Verifica en Netlify** que el deploy fue exitoso
5. **Revisa la fecha del último deploy** - debe ser reciente

---

## ✅ Resumen

```
Dashboard viejo → Deploy manual (dist/) → Dashboard actualizado → Botón "Desplegar" funciona ✅
```

Una vez que actualices el dashboard, **NUNCA más necesitarás hacer esto**. Todos los deployments futuros desde el botón "Desplegar" funcionarán automáticamente con branding, roles y campos de documento.

---

**Última actualización**: ${new Date().toISOString()}
**Build incluye**: Documento type field + Branding fix + Roles fix
