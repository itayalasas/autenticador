# 🎯 AGREGAR CAMPO "TIPO DE USUARIO" AL REGISTRO

## ✅ Lo que ya está listo:

1. ✅ Branding funcionando correctamente
2. ✅ Código actualizado para cargar roles desde la BD
3. ✅ Campo "Tipo de Usuario" agregado al template
4. ✅ Dashboard compilado y listo para deploy

---

## 🚀 PASO 1: Ejecutar SQL en Supabase (1 MINUTO)

Ve a tu dashboard de Supabase y ejecuta este SQL:

1. Abre: https://supabase.com/dashboard/project/sfqtmnncgiqkveaoqckt/sql/new
2. **Copia y pega este SQL**:

```sql
-- Agregar columnas para controlar qué roles se muestran en registro
ALTER TABLE application_roles
ADD COLUMN IF NOT EXISTS available_for_registration boolean DEFAULT false;

ALTER TABLE application_roles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Hacer que todos los roles existentes estén activos
UPDATE application_roles
SET is_active = true;

-- Hacer que los roles por defecto estén disponibles para registro
UPDATE application_roles
SET available_for_registration = true
WHERE is_default = true;
```

3. **Haz clic en "RUN"**
4. ✅ ¡Listo! Las columnas están agregadas

---

## 🚀 PASO 2: Deploy del Dashboard (2 MINUTOS)

### **Opción A: Deploy Manual (MÁS RÁPIDO)** ⚡

1. Ve a https://app.netlify.com/
2. Selecciona tu site del **Dashboard** (AuthSystem admin - el panel donde gestionas apps)
3. Clic en **"Deploys"** → **"Deploy manually"**
4. **Arrastra la carpeta** `dist/`
5. ✅ Espera 1-2 minutos

---

## 🎯 PASO 3: Configurar Roles en el Dashboard

Una vez desplegado el dashboard actualizado:

1. **Abre el dashboard** (tu admin panel)
2. **Selecciona una aplicación**
3. **Ve a "Roles & Permisos"**
4. **Para CADA rol que quieras mostrar en registro**:
   - Marca ✅ **"Disponible para Registro"**
   - Marca ✅ **"Activo"**
5. **Guarda los cambios**

---

## 🧪 PASO 4: Hacer Deploy de la Aplicación

1. **En el dashboard**, ve a **"Ambientes"**
2. **Haz clic en "Desplegar"**
3. ✅ Espera que termine el deployment

---

## 🎉 RESULTADO FINAL

El formulario de registro ahora tendrá:

```
┌─────────────────────────────────────┐
│  Crear Cuenta                       │
│  Regístrate para comenzar           │
├─────────────────────────────────────┤
│  👤 Nombre Completo                 │
│  ✉️  Email                          │
│  🔒 Contraseña                      │
│  🔒 Confirmar Contraseña            │
│  👥 Tipo de Usuario                 │  ← NUEVO
│     [Selecciona un rol ▼]           │
│     - Usuario                       │
│     - Estudiante                    │
│     - Profesor                      │
│     - etc.                          │
├─────────────────────────────────────┤
│  [Crear Cuenta]                     │
└─────────────────────────────────────┘
```

---

## 📝 Notas Importantes:

1. **El campo "Tipo de Usuario" solo aparece si hay roles disponibles**
2. **Los roles deben tener** `available_for_registration = true`
3. **Puedes crear roles personalizados** en "Roles & Permisos"
4. **Ejemplos de roles comunes**:
   - Usuario / Customer / Cliente
   - Estudiante / Student
   - Profesor / Teacher
   - Vendedor / Seller
   - Comprador / Buyer
   - etc.

---

## 🆘 Si no ves el campo "Tipo de Usuario":

1. ✅ Verifica que ejecutaste el SQL en Supabase
2. ✅ Verifica que desplegaste el dashboard actualizado
3. ✅ Verifica que marcaste roles como "Disponible para Registro"
4. ✅ Verifica que la aplicación tiene roles creados
5. ✅ Limpia caché del navegador (Ctrl+Shift+R)

---

## 📍 Archivos Listos:

```
/tmp/cc-agent/58424341/project/
├── dist/                           ← Arrastra a Netlify
├── ADD_ROLE_FIELDS.sql            ← SQL a ejecutar en Supabase
└── INSTRUCCIONES_TIPO_USUARIO.md  ← Este archivo
```

---

**¡TODO LISTO! Solo ejecuta el SQL, deploya el dashboard y configura los roles.** 🎉
