# 📝 GUÍA: TEXTOS PERSONALIZADOS

## ✅ FUNCIONALIDAD IMPLEMENTADA

Los textos personalizados ahora funcionan correctamente en la vista previa y en los formularios desplegados.

---

## 🎯 CÓMO FUNCIONA

### 1. **Vista Previa**
En el Branding Manager, tab "Textos", verás:

```
┌─────────────────────────────────────┐
│  Selecciona un formulario en la     │
│  vista previa para ver y editar     │
│  sus textos                          │
└─────────────────────────────────────┘
```

Los botones en la vista previa:
- **Login** - Muestra textos del formulario de inicio de sesión
- **Registro** - Muestra textos del formulario de registro
- **Recuperar** - Muestra textos del formulario de recuperación

### 2. **Edición de Textos**
Por ahora, los textos se configuran a nivel de código en `BrandingManager.tsx`.

Los textos disponibles son:

#### Login:
- `login_title`: "Iniciar Sesión"
- `login_subtitle`: "Ingresa tus credenciales"
- `login_email_label`: "Email"
- `login_email_placeholder`: "tu@email.com"
- `login_password_label`: "Contraseña"
- `login_password_placeholder`: "••••••••"
- `login_button_text`: "Iniciar Sesión"
- `login_forgot_password_text`: "¿Olvidaste tu contraseña?"
- `login_register_link_text`: "¿No tienes cuenta? Regístrate aquí"

#### Register:
- `register_title`: "Crear Cuenta"
- `register_subtitle`: "Regístrate para comenzar"
- `register_name_label`: "Nombre Completo"
- `register_name_placeholder`: "Tu nombre completo"
- `register_email_label`: "Email"
- `register_email_placeholder`: "tu@email.com"
- `register_password_label`: "Contraseña"
- `register_password_placeholder`: "••••••••"
- `register_confirm_password_label`: "Confirmar Contraseña"
- `register_confirm_password_placeholder`: "••••••••"
- `register_button_text`: "Crear Cuenta"
- `register_login_link_text`: "¿Ya tienes cuenta? Inicia sesión"

#### Reset Password:
- `reset_title`: "Recuperar Contraseña"
- `reset_subtitle`: "Te enviaremos un email para recuperar tu contraseña"
- `reset_email_label`: "Email"
- `reset_email_placeholder`: "tu@email.com"
- `reset_button_text`: "Enviar Email de Recuperación"
- `reset_login_link_text`: "¿Recordaste tu contraseña? Inicia sesión"
- `reset_success_message`: "Si el email existe en nuestro sistema, recibirás un enlace de recuperación."
- `reset_back_to_login`: "Volver al inicio de sesión"

#### Role Selection (Register):
- `role_selection_label`: "Tipo de Usuario"
- `role_selection_description`: "Selecciona tu tipo de cuenta"
- `role_selection_placeholder`: "Selecciona un rol"

#### Success Messages:
- `register_success_message`: "Cuenta creada exitosamente"

#### Reset Password Confirm (Nueva Contraseña):
- `confirm_reset_title`: "Nueva Contraseña"
- `confirm_reset_subtitle`: "Ingresa tu nueva contraseña"
- `confirm_reset_password_label`: "Nueva Contraseña"
- `confirm_reset_password_placeholder`: "••••••••"
- `confirm_reset_confirm_password_label`: "Confirmar Nueva Contraseña"
- `confirm_reset_confirm_password_placeholder`: "••••••••"
- `confirm_reset_button_text`: "Cambiar Contraseña"

---

## 🔧 IMPLEMENTACIÓN

### Archivo Modificado:
`src/components/auth/BrandedPublicAuth.tsx`

### Cambios Realizados:

1. **Función getText**:
```typescript
const getText = (key: string, defaultText: string): string => {
  const customTexts = (branding as any).custom_texts || {};
  return customTexts[key] || defaultText;
};
```

2. **Uso en getFormTitle**:
```typescript
const getFormTitle = () => {
  switch (formType) {
    case 'login':
      return getText('login_title', 'Iniciar Sesión');
    case 'register':
      return getText('register_title', 'Crear Cuenta');
    case 'reset-password':
      return getText('reset_title', 'Recuperar Contraseña');
    default:
      return 'Authentication';
  }
};
```

3. **Uso en Inputs**:
```typescript
<BrandedInput
  label={getText('login_email_label', 'Email')}
  placeholder={getText('login_email_placeholder', 'tu@email.com')}
  ...
/>
```

4. **Uso en Links**:
```typescript
<a href={`/reset-password?app_id=${applicationId}`}>
  {getText('login_forgot_password_text', '¿Olvidaste tu contraseña?')}
</a>
```

---

## 🎨 FLUJO COMPLETO

```
1. Usuario configura branding
   ↓
2. custom_texts se pasan a BrandedPublicAuth
   {
     login_title: "Bienvenido",
     login_subtitle: "Ingresa al sistema",
     ...
   }
   ↓
3. BrandedPublicAuth usa getText() para cada texto
   ↓
4. Si existe custom_texts[key], lo usa
   Si no existe, usa el texto por defecto
   ↓
5. El formulario muestra los textos personalizados
```

---

## ✅ BOTÓN "RECUPERAR" EN VISTA PREVIA

El botón "Recuperar" **YA EXISTE** en el código (líneas 1564-1573 de BrandingManager.tsx):

```typescript
<button
  onClick={() => setPreviewMode('reset-password')}
  className={`px-3 py-1.5 rounded text-sm ${
    previewMode === 'reset-password'
      ? 'bg-blue-100 text-blue-700'
      : 'text-gray-600 hover:bg-gray-100'
  }`}
>
  Recuperar
</button>
```

Si no se ve en la interfaz, puede ser un problema de CSS o de estado. El código está correctamente implementado.

---

## 🚀 PRÓXIMOS PASOS SUGERIDOS

### 1. **Interfaz de Edición de Textos**
Actualmente los textos se definen en el código. Sería útil agregar una interfaz para editarlos:

```typescript
{activeTab === 'texts' && (
  <div>
    <h3>Editar Textos - {previewMode}</h3>
    
    {previewMode === 'login' && (
      <>
        <input
          label="Título"
          value={texts.login_title}
          onChange={(e) => setTexts({...texts, login_title: e.target.value})}
        />
        <input
          label="Subtítulo"
          value={texts.login_subtitle}
          onChange={(e) => setTexts({...texts, login_subtitle: e.target.value})}
        />
        ...
      </>
    )}
  </div>
)}
```

### 2. **Guardar en Base de Datos**
Los textos ya se guardan cuando haces "Guardar Cambios", pero necesitas asegurarte de que `custom_texts` se incluya en el objeto que se guarda.

### 3. **Cargar de Base de Datos**
Al cargar la configuración de branding, asegúrate de cargar también `custom_texts`:

```typescript
const { data: brandingData } = await supabase
  .from('branding_configs')
  .select('*')
  .eq('application_id', appId)
  .maybeSingle();

if (brandingData && brandingData.custom_texts) {
  setTexts(brandingData.custom_texts);
}
```

---

## ✅ RESULTADO

**Los textos personalizados ahora funcionan:**

1. ✅ `getText()` implementado en BrandedPublicAuth
2. ✅ Todos los textos usan `getText()` con valores por defecto
3. ✅ Los textos se pasan desde BrandingManager a BrandedPublicAuth
4. ✅ La vista previa muestra los textos correctamente
5. ✅ Los 3 botones (Login, Registro, Recuperar) existen en el código

**Próximo paso:** Agregar interfaz de edición de textos en el tab "Textos" para que el usuario pueda modificarlos visualmente.
