# Guía: Conectar Repositorio a Netlify

## 🎯 Problema: "Este sitio no tiene un repositorio conectado"

Cuando intentas hacer deploy y ves este error, significa que el sitio en Netlify existe pero no está conectado a ningún repositorio de código (GitHub, GitLab, o Bitbucket).

---

## ✅ Solución Recomendada: Conectar tu Repositorio

### Paso 1: Preparar tu Repositorio

Asegúrate de que tu código esté en un repositorio Git:

**Si ya tienes un repositorio:**
- Haz push de tus cambios más recientes
- Verifica que el repositorio esté accesible

**Si NO tienes un repositorio:**

1. Crea un repositorio en GitHub/GitLab/Bitbucket
2. Inicializa Git en tu proyecto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Conecta con el repositorio remoto:
   ```bash
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```

### Paso 2: Conectar el Repositorio en Netlify

1. **Abre tu sitio en Netlify:**
   - El sistema te mostrará la URL en la consola
   - Formato: `https://app.netlify.com/sites/[SITE_ID]/settings`

2. **Ve a la sección de Build:**
   - En el menú lateral, haz clic en **"Site settings"**
   - Luego ve a **"Build & deploy"**
   - Haz clic en **"Continuous deployment"**

3. **Conecta tu repositorio:**
   - Haz clic en **"Link site to Git"** o **"Link repository"**
   - Selecciona tu proveedor (GitHub, GitLab, o Bitbucket)
   - Autoriza a Netlify si es necesario
   - Selecciona tu repositorio de la lista

4. **Configura el build:**
   ```
   Branch to deploy: main (o master)
   Build command: npm run build
   Publish directory: dist
   ```

5. **Guarda la configuración**

### Paso 3: Hacer Deploy desde AuthSystem

1. Regresa a AuthSystem
2. Ve a **Ambientes**
3. Haz clic en **"Deploy to Netlify"** nuevamente
4. ✅ Ahora debería funcionar correctamente

---

## 🔄 Alternativa: Usar un Sitio Diferente

Si prefieres usar otro sitio o crear uno nuevo:

### Opción A: Crear un Nuevo Sitio

1. Haz clic en **"Configurar Netlify"**
2. Haz clic en **"Crear Nuevo Sitio"**
3. El nuevo sitio se creará automáticamente
4. Luego conecta tu repositorio siguiendo los pasos anteriores

### Opción B: Seleccionar Otro Sitio Existente

1. Haz clic en **"Configurar Netlify"**
2. En la lista de sitios, selecciona uno diferente
3. Verifica que ese sitio tenga un repositorio conectado
4. Intenta hacer deploy

---

## 📋 Verificar si un Sitio Tiene Repositorio

Para verificar si un sitio ya tiene repositorio conectado:

1. Ve a [Netlify Sites](https://app.netlify.com/teams/tu-team/sites)
2. Haz clic en tu sitio
3. Si ves información del repositorio en la página principal, está conectado
4. Si dice "Site not connected to Git", necesitas conectarlo

---

## 🚀 Configuración Recomendada de Build

Para este proyecto, usa estos settings en Netlify:

### Build Settings
```
Base directory: (dejar vacío)
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

### Environment Variables (Opcional)

Si necesitas variables de entorno adicionales en Netlify:

1. Ve a **Site settings** → **Environment variables**
2. Agrega las variables necesarias:
   ```
   VITE_SUPABASE_URL=tu_url_aqui
   VITE_SUPABASE_ANON_KEY=tu_key_aqui
   ```

---

## 🎯 Flujo Completo Recomendado

### Para Primer Deploy (Sitio Nuevo)

```
1. Crea repositorio en GitHub/GitLab/Bitbucket
2. Push tu código al repositorio
3. En AuthSystem: "Configurar Netlify"
4. Ingresa tu Access Token
5. Crea un nuevo sitio
6. Ve a Netlify Dashboard
7. Conecta el repositorio al sitio
8. Configura build settings
9. Regresa a AuthSystem
10. Haz deploy desde "Deploy to Netlify"
```

### Para Sitios Existentes

```
1. Ve a Netlify Dashboard
2. Abre tu sitio
3. Conecta tu repositorio si no está conectado
4. Configura build settings
5. En AuthSystem: Selecciona el sitio
6. Haz deploy desde "Deploy to Netlify"
```

---

## 💡 Tips y Mejores Prácticas

### 1. Branch Protection
- Usa `main` o `master` para producción
- Usa `develop` o `staging` para testing
- Netlify puede auto-deployar cada branch

### 2. Deploy Previews
- Netlify crea previews automáticos para cada PR
- Perfecto para revisar cambios antes de mergear

### 3. Build Notifications
- Configura notificaciones en Netlify
- Email, Slack, Discord, etc.

### 4. Custom Domains
- Después del primer deploy exitoso
- Configura tu dominio personalizado en Netlify

### 5. SSL/HTTPS
- Netlify proporciona SSL gratuito automáticamente
- No necesitas configurar nada

---

## 🔧 Troubleshooting

### Build Falla en Netlify

**Problema:** El build funciona localmente pero falla en Netlify

**Soluciones:**
1. Verifica que todos los archivos estén en el repo
2. Revisa las dependencias en `package.json`
3. Verifica que el Node version sea compatible
4. Revisa los logs de build en Netlify

### Site ID Incorrecto

**Problema:** El sitio no se encuentra

**Soluciones:**
1. Verifica el Site ID en Netlify Dashboard
2. Reconfigura Netlify en AuthSystem
3. Selecciona el sitio correcto

### Permisos Insuficientes

**Problema:** No puedes conectar el repositorio

**Soluciones:**
1. Verifica que tu Access Token tenga permisos
2. Re-autoriza Netlify en GitHub/GitLab/Bitbucket
3. Verifica que seas admin del repositorio

---

## 📚 Recursos Adicionales

- [Netlify Build Settings](https://docs.netlify.com/configure-builds/overview/)
- [Continuous Deployment](https://docs.netlify.com/site-deploys/create-deploys/#deploy-with-git)
- [Build Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Deploy Notifications](https://docs.netlify.com/site-deploys/notifications/)

---

## ✅ Checklist de Verificación

Antes de hacer deploy, verifica:

- [ ] Código está en un repositorio Git
- [ ] Repositorio está conectado al sitio de Netlify
- [ ] Build command configurado: `npm run build`
- [ ] Publish directory configurado: `dist`
- [ ] Environment variables configuradas (si es necesario)
- [ ] Access Token guardado en AuthSystem
- [ ] Site ID seleccionado en AuthSystem
- [ ] Build local funciona correctamente: `npm run build`

---

**🎉 Una vez completados estos pasos, podrás hacer deploy con un solo clic desde AuthSystem!**
