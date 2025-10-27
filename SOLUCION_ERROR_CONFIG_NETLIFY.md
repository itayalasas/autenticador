# ✅ SOLUCIÓN - Error "Could not resolve ./lib/config" en Netlify

## 🔴 Error Original

```
error during build:
Could not resolve "./lib/config" from "src/App.tsx"
Build failed with exit code 1
```

---

## ✅ Solución

Se creó el archivo faltante **`src/lib/config.ts`** con toda la configuración de la aplicación.

---

## 📦 Archivo Creado

**Ubicación:** `src/lib/config.ts`

**Contenido:** Configuración centralizada que incluye:
- ✅ Supabase config
- ✅ App config
- ✅ API config
- ✅ DLocal config (pagos)
- ✅ Netlify config
- ✅ Feature flags
- ✅ UI config
- ✅ Security config

---

## 🚀 Pasos para Deployar

### 1. Verifica que el archivo existe
```bash
ls -la src/lib/config.ts
# Debe mostrar el archivo
```

### 2. Commit y Push
```bash
git add src/lib/config.ts
git commit -m "Add missing config file"
git push origin main
```

### 3. Netlify Auto-Deploy
Netlify detectará el push y re-desplegará automáticamente.

**O trigger manual:**
- Ve a Netlify Dashboard → Deploys → Trigger deploy

---

## 🔧 Variables de Entorno en Netlify

Configura estas variables en **Netlify Dashboard → Site settings → Environment variables:**

### Obligatorias (Supabase)
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### Opcionales (Solo si las usas)
```
VITE_DLOCAL_API_URL=...
VITE_DLOCAL_API_KEY=...
VITE_NETLIFY_ACCESS_TOKEN=...
```

---

## ✅ Build Local

Para verificar antes de deployar:

```bash
npm install
npm run build
# ✓ built in X.XXs  <-- Debe completar sin errores
```

---

## 📝 Uso del Config

### En tu código:
```typescript
// Importación default
import config from './lib/config';
console.log(config.app.name); // 'AuthSystem'

// Importación nombrada
import { supabaseConfig } from './lib/config';
console.log(supabaseConfig.url);
```

---

## 🐛 Si el Error Persiste

1. **Limpia cache de Netlify:**
   - Dashboard → Deploys → Options → Clear cache and retry

2. **Verifica Git:**
   ```bash
   git ls-files src/lib/config.ts
   ```

3. **Rebuild local:**
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

---

## ✅ Estado

- ✅ Archivo `src/lib/config.ts` creado
- ✅ Build local exitoso
- ✅ Listo para deploy

**Próximo paso:** Push a Git y Netlify auto-deployará! 🚀
