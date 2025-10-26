# Cómo Copiar la Edge Function al Dashboard de Supabase

## El Problema que Tuviste

Al intentar desplegar `collect-source-files-complete` manualmente, obtuviste este error:

```
Failed to deploy edge function: failed to create the graph
Expected unicode escape at file:///tmp/user_fn_sfqtmnncglqkveaoqckt_b2a8d432-1578-45aa-847c-4280ee0bc924_3/source/index.ts:2508:58
files['src/components/auth/BrandedPublicAuth.tsx'] = \`import React from 'react'; ~
```

**Causa**: El script de sincronización insertó los templates correctos, pero NO eliminó el código viejo duplicado que quedó después. Esto causó backticks sin cerrar y código duplicado.

**Solución**: He actualizado el script para que elimine automáticamente el código viejo y el archivo está ahora limpio.

## Método 1: Copiar desde Terminal (RECOMENDADO)

El archivo tiene 2545 líneas, así que copiarlo manualmente es tedioso. Usa este método:

### En tu máquina local:

```bash
# 1. Copia el contenido del archivo al portapapeles (Mac)
cat supabase/functions/collect-source-files-complete/index.ts | pbcopy

# O en Linux:
cat supabase/functions/collect-source-files-complete/index.ts | xclip -selection clipboard

# O en Windows (PowerShell):
Get-Content supabase\functions\collect-source-files-complete\index.ts | Set-Clipboard
```

### En Supabase Dashboard:

1. Ve a https://supabase.com/dashboard/project/[tu-proyecto]/functions
2. Click en `collect-source-files-complete`
3. Click en "Edit"
4. Selecciona TODO el contenido (Ctrl+A o Cmd+A)
5. Pega el nuevo contenido (Ctrl+V o Cmd+V)
6. Click en "Deploy updates"

## Método 2: Usar Supabase CLI (Más Rápido)

Si tienes el CLI instalado:

```bash
# Asegúrate de estar logueado
supabase login

# Despliega la función
supabase functions deploy collect-source-files-complete
```

## Método 3: Copiar en Partes (Si el Dashboard no Acepta Todo)

Si el dashboard de Supabase tiene un límite de caracteres:

```bash
# Divide el archivo en partes
split -l 500 supabase/functions/collect-source-files-complete/index.ts part-

# Copia parte por parte:
cat part-aa  # Primera parte
cat part-ab  # Segunda parte
# etc...
```

Y pega cada parte en orden en el editor de Supabase.

## Verificación

Una vez desplegada la función, verifica:

1. **No hay errores de sintaxis**: El dashboard te mostrará si hay errores
2. **La función está activa**: Debe aparecer con un punto verde
3. **Los logs funcionan**: Intenta hacer un deployment desde Ambientes

## ¿Qué Hace Esta Función?

`collect-source-files-complete` genera TODOS los archivos del proyecto React incluyendo:

- ✅ Formularios de autenticación (PublicAuthForms.tsx)
- ✅ Componentes branded (BrandedPublicAuth.tsx, BrandedComponents.tsx)
- ✅ Sistema de temas (themePresets.ts)
- ✅ Configuración (package.json, vite.config.ts, etc.)
- ✅ Servicios (rolesService, applicationService, ipService)
- ✅ Hooks (useAuth)
- ✅ Router (PublicAuthRouter)
- ✅ Variables de entorno personalizadas

Todos estos archivos son generados con:
- URLs de Supabase correctas
- API Keys de la aplicación
- Branding personalizado
- Roles del sistema

## Archivo Corregido

El archivo ahora tiene:
- **2545 líneas** (antes 2719)
- **Sin código duplicado**
- **Backticks correctamente escapados**
- **Templates sincronizados** desde los archivos TypeScript fuente

## Próximos Pasos

1. Despliega esta función actualizada
2. Ve al dashboard → Ambientes
3. Haz click en "Deploy to Netlify" para el ambiente Pet Breed Data
4. El sitio se desplegará con el código correcto usando URLs de Edge Functions

## Script de Sincronización Actualizado

El script `sync-templates-to-edge-function.cjs` ahora:
- ✅ Lee los templates desde `src/utils/`
- ✅ Los inserta en la Edge Function
- ✅ **ELIMINA automáticamente el código viejo duplicado**
- ✅ Verifica la sintaxis

Úsalo así:
```bash
node sync-templates-to-edge-function.cjs
```

## Troubleshooting

### Error: "Failed to parse"
- El archivo tiene backticks sin escapar
- Re-ejecuta: `node sync-templates-to-edge-function.cjs`
- Copia de nuevo el archivo

### Error: "File too large"
- Usa el método de Supabase CLI
- O divide el archivo en partes

### La función se despliega pero no hace nada
- Verifica los logs en Supabase Dashboard → Functions → Logs
- Asegúrate de que `deploy-to-netlify` también esté actualizada
