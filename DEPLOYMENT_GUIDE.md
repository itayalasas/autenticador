# 🚀 Guía para Actualizar Edge Function collect-source-files

## ⚠️ PROBLEMA ACTUAL

El código en GitHub tiene `useMemo` porque la Edge Function `collect-source-files` en Supabase producción está desactualizada.

## ✅ SOLUCIÓN: Actualizar la Edge Function

Esta guía te ayudará a actualizar la función para que envíe el código original sin `useMemo`.

## 🎯 MÉTODOS DE ACTUALIZACIÓN

### MÉTODO 1: Supabase CLI (Recomendado - Más Rápido)

```bash
# 1. Instalar CLI (si no lo tienes)
npm install -g supabase

# 2. Login
supabase login

# 3. Ver proyectos y copiar Project Ref
supabase projects list

# 4. Link proyecto
supabase link --project-ref TU_PROJECT_REF

# 5. Desplegar la función
cd /tmp/cc-agent/58424341/project
supabase functions deploy collect-source-files --no-verify-jwt

# 6. Verificar
supabase functions list
```

### MÉTODO 2: Dashboard de Supabase (Si no tienes CLI)

### Paso 1: Acceder al Dashboard

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Edge Functions** en el menú lateral izquierdo
4. Busca `collect-source-files`
5. Haz clic en la función

### Paso 2: Copiar el Código Actualizado

El código completo está en:
```
/tmp/cc-agent/58424341/project/supabase/functions/collect-source-files/index.ts
```

O búscalo en el archivo **EDGE_FUNCTION_CODE.md** en este proyecto.

### Paso 3: Reemplazar el Código

1. En el editor de la función, **selecciona TODO el código**
2. Bórralo completamente
3. Abre el archivo local: `/tmp/cc-agent/58424341/project/supabase/functions/collect-source-files/index.ts`
4. Copia TODO el contenido (359 líneas)
5. Pégalo en el editor de Supabase
6. Haz clic en **Deploy** o **Save and Deploy**

### Paso 4: Verificar el Deploy

1. Espera a que aparezca el mensaje "Deployed successfully" ✓
2. Verifica que el estado sea **Active**
3. Revisa los logs para asegurarte de que no haya errores

---

## 🔄 DESPUÉS DE ACTUALIZAR LA FUNCIÓN

### Paso 5: Hacer Deploy Nuevo

1. Ve a tu dashboard de **AuthSystem**
2. Navega a **Environments** (Ambientes) o **Deployments** (Despliegues)
3. Encuentra tu aplicación
4. Haz clic en **Deploy** o **Redeploy**
5. Espera a que el proceso complete

### Paso 6: Verificar en GitHub

1. Abre tu repositorio en GitHub
2. Navega a `src/components/auth/PublicAuthForms.tsx`
3. Busca alrededor de la línea 60-65
4. **Verifica que diga:**
   ```typescript
   const defaultBranding = {
     primary_color: branding?.primary_color || '#3B82F6',
     ...
   ```
5. **NO debe decir:**
   ```typescript
   const defaultBranding = useMemo(() => ({
   ```

---

## ✅ CHECKLIST FINAL

Después de completar los pasos:

- [ ] Edge Function `collect-source-files` actualizada en Supabase
- [ ] Estado de la función: **Active**
- [ ] Deploy nuevo desde AuthSystem completado
- [ ] GitHub muestra código **SIN** `useMemo`
- [ ] Sitio web funciona **SIN** error React #310

---

## 🎯 LO QUE CAMBIÓ EN LA FUNCIÓN

### Antes (Versión Vieja):
- Usaba templates hardcodeados
- Generaba código con `useMemo`

### Ahora (Versión Actualizada):
```typescript
// Línea 240 - Lee el archivo ORIGINAL
'src/components/auth/PublicAuthForms.tsx',

// Líneas 250-256 - Lee contenido real del archivo
const fullPath = `${projectRoot}/${filePath}`;
const content = await Deno.readTextFile(fullPath);  // ← Lee archivo REAL
files[filePath] = content;                          // ← Sin modificar
```

---

## 🔍 VERIFICACIÓN

### Test A: Logs de la Función

```bash
# Ver logs recientes
supabase functions logs collect-source-files --limit 20

# Deberías ver:
# ✅ Collected: src/components/auth/PublicAuthForms.tsx (XXXXX bytes)
```

### Test B: Probar la Función

Usa el archivo **test-edge-function.html** incluido en este proyecto para verificar que la función retorna archivos sin `useMemo`.

---

## 📚 ARCHIVOS DE REFERENCIA

- **supabase/functions/collect-source-files/index.ts** - Código completo de la función
- **SOLUCION_FINAL.md** - Explicación detallada del problema
- **COMANDOS_RAPIDOS.md** - Comandos de una línea
- **test-edge-function.html** - Test interactivo

---

**Fecha**: 2025-10-11
**Problema**: Edge Function desactualizada enviando código con `useMemo`
**Solución**: Actualizar función para leer archivos originales del proyecto
