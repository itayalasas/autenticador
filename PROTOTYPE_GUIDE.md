# 🎨 Guía del Prototipo de Formularios - AuthSystem

## 📍 Cómo Acceder al Prototipo

Para ver el prototipo visual de los nuevos estilos de formularios, simplemente accede a:

```
http://localhost:5173/prototype
```

## 🎭 Estilos Disponibles

El prototipo incluye **5 estilos profesionales** diferentes que puedes cambiar con los botones en la parte superior:

### 1. **Modern Glass** (Glassmorphism)
**Descripción:** Efecto glassmorphism con blur y transparencias

**Características:**
- ✨ Fondo con gradiente animado (azul, púrpura, rosa)
- 🔮 Blobs animados con efectos de mezcla
- 🪟 Tarjeta con efecto de vidrio (backdrop-blur)
- 🎨 Transparencias y bordes semi-transparentes
- 💫 Inputs con fondo translúcido y efectos hover
- 🔘 Botón sólido blanco que contrasta con el fondo

**Ideal para:**
- Aplicaciones modernas y creativas
- Startups tecnológicas
- Apps de diseño o creatividad
- Productos dirigidos a audiencias jóvenes

---

### 2. **Minimal Clean** (Minimalista)
**Descripción:** Diseño minimalista con líneas limpias

**Características:**
- ⚪ Fondo blanco limpio con espacio negativo
- 📝 Inputs estilo "underlined" (solo línea inferior)
- 🏷️ Labels flotantes animadas
- ⚫ Botón negro con gradiente hover
- 🎯 Tipografía ligera y espaciado amplio
- 🔗 Enlaces con efecto de subrayado al hover

**Ideal para:**
- Productos premium/lujo
- Portafolios profesionales
- Aplicaciones B2B minimalistas
- Servicios de consultoría

---

### 3. **Corporate Professional** (Corporativo)
**Descripción:** Estilo corporativo con sombras pronunciadas

**Características:**
- 🏢 Fondo con gradiente sutil gris
- 📦 Tarjeta elevada con sombra pronunciada
- 📋 Inputs estilo "filled" (fondo gris claro)
- 🔵 Color azul corporativo
- ✅ Checkbox "Remember me"
- 🔒 Badge de seguridad "256-bit SSL"
- 📊 Texto en mayúsculas para labels

**Ideal para:**
- Empresas corporativas
- Bancos y finanzas
- Plataformas B2B
- Portales gubernamentales
- Sistemas enterprise

---

### 4. **Gradient Bold** (Gradientes Audaces)
**Descripción:** Gradientes vibrantes con efectos modernos

**Características:**
- 🌈 Fondo oscuro con gradientes cyan-azul-púrpura
- 🎨 Tarjeta semi-transparente sobre fondo oscuro
- 💎 Inputs oscuros con bordes que cambian a cyan en focus
- 🌟 Botón con gradiente multi-color
- 🔆 Efecto de brillo en focus de inputs
- 🚀 Logo con gradiente y sombra colorida

**Ideal para:**
- Apps de gaming
- Plataformas de entretenimiento
- Productos tech innovadores
- Comunidades creativas
- Eventos y conferencias

---

### 5. **Neumorphic Soft** (Neumorfismo)
**Descripción:** Diseño soft UI con sombras suaves

**Características:**
- 🎨 Fondo gradiente gris claro
- 🔘 Efecto neumórfico (sombras internas/externas)
- 💿 Inputs "hundidos" en la superficie
- 🎯 Apariencia táctil y física
- 🌓 Sombras que simulan profundidad
- 🔲 Estilo suave y orgánico

**Ideal para:**
- Apps de bienestar y salud
- Productos de diseño UI/UX
- Apps de productividad
- Herramientas creativas
- Experiencias relajantes

---

## 🎨 Elementos Comunes en Todos los Estilos

Cada formulario incluye:

1. **Logo/Icono**: Personalizable según la aplicación
2. **Título y Subtítulo**: Textos configurables
3. **Input de Email**: Con icono y validación
4. **Input de Password**: Con toggle show/hide
5. **Mensajes de Estado**: Loading, Success y Error con animaciones únicas
6. **Botones de Test**: Para probar estados de éxito y error
7. **Enlaces**: Recuperar contraseña y crear cuenta
8. **Badge de Seguridad**: "Protected by AuthSystem"

---

## 📨 Sistema de Mensajes de Estado Modernos

### 🎯 Cómo Probar los Mensajes

Cada formulario incluye **dos botones de prueba** para demostrar los diferentes estados:

- **"Test Success"** (botón verde/izquierdo): Simula autenticación exitosa
- **"Test Error"** (botón rojo/derecho): Simula error de autenticación

### Estados Disponibles

#### 1️⃣ **Loading (Cargando)**
**Comportamiento:**
- Se muestra inmediatamente al hacer clic
- Mensaje: "Authenticating..." / "Processing..." / "Verifying..."
- Animación: Spinner girando + pulse
- Duración: 1.5 segundos (simulado)

**Visual por estilo:**
- **Modern Glass**: Fondo azul translúcido con blur, spinner blanco animado
- **Minimal Clean**: Borde azul izquierdo, spinner azul con pulse
- **Corporate**: Caja azul claro con título "Authenticating" y spinner en cuadro
- **Gradient Bold**: Gradiente cyan-azul con borde brillante y efecto glow
- **Neumorphic**: Sombra interna neumórfica con icono azul

#### 2️⃣ **Success (Éxito)**
**Comportamiento:**
- Aparece después del loading si la operación fue exitosa
- Mensaje: "Welcome back! Redirecting to your dashboard..."
- Animación: **Slide-in** desde arriba (suave)
- Icono: CheckCircle verde en círculo
- Auto-redirect: Después de 2 segundos (visible en consola)

**Visual por estilo:**
- **Modern Glass**: Fondo verde translúcido con blur, checkmark en círculo glassmorphic
- **Minimal Clean**: Borde verde izquierdo, mensaje limpio y directo
- **Corporate**: Tarjeta verde con progress bar animado al final
- **Gradient Bold**: Gradiente verde-esmeralda con borde brillante
- **Neumorphic**: Sombra neumórfica con icono verde elevado

**Callback URL Integration:**
```javascript
// En producción se ejecutaría:
window.location.href = callbackUrl;
// O con parámetros:
window.location.href = `${callbackUrl}?token=${accessToken}&user_id=${userId}`;
```

#### 3️⃣ **Error (Error)**
**Comportamiento:**
- Aparece después del loading si hubo un error
- Mensaje: "Invalid credentials. Please check your email and password."
- Animación: **Shake** horizontal (sacudir)
- Icono: XCircle rojo
- Mensaje de ayuda adicional según el estilo

**Visual por estilo:**
- **Modern Glass**: Fondo rojo translúcido con blur y X en círculo
- **Minimal Clean**: Borde rojo con mensaje de ayuda abajo
- **Corporate**: Tarjeta roja con título "Authentication Failed"
- **Gradient Bold**: Gradiente rojo-naranja con efecto de advertencia
- **Neumorphic**: Sombra neumórfica con icono rojo prominente

**Mensajes de ayuda incluidos:**
- "Please try again or reset your password"
- "Double-check your credentials and try again"
- "Verify your information and try again"

### 🎬 Características de las Animaciones

**Animaciones por Estado:**

| Estado | Animación | Duración | Efecto |
|--------|-----------|----------|--------|
| **Loading** | Pulse + Spin | Continuo | El mensaje "respira" mientras el spinner gira |
| **Success** | Slide-in | 0.5s | Entrada suave desde arriba |
| **Error** | Shake | 0.5s | Sacudida horizontal para llamar atención |

**Progress Bar (solo Corporate):**
- Aparece en mensajes de éxito
- Animación de 0% a 100% en 2 segundos
- Indica visualmente el tiempo hasta el redirect

### ✨ Personalización Total

Cada aspecto de los mensajes es personalizable desde el Branding Manager:

**Colores:**
```typescript
message_colors: {
  loading: {
    background: '#3B82F6',
    text: '#1E3A8A',
    icon: '#2563EB'
  },
  success: {
    background: '#10B981',
    text: '#065F46',
    icon: '#059669'
  },
  error: {
    background: '#EF4444',
    text: '#7F1D1D',
    icon: '#DC2626'
  }
}
```

**Textos:**
```typescript
message_texts: {
  loading: 'Verificando credenciales...',
  success: '¡Bienvenido! Redirigiendo a tu panel...',
  success_redirect: 'Serás redirigido en {seconds} segundos',
  error: 'Credenciales inválidas. Por favor intenta nuevamente.',
  error_help: 'Verifica tu email y contraseña o restablece tu contraseña',
  error_retry: 'Reintentar',
  error_reset: 'Olvidé mi contraseña'
}
```

**Animaciones:**
```typescript
message_animations: {
  loading_duration: 'infinite',
  success_duration: '0.5s',
  error_duration: '0.5s',
  auto_dismiss: false,  // No se oculta automáticamente
  redirect_delay: 2000  // 2 segundos antes de redirect
}
```

### 🔄 Flujo Completo con Callback

```typescript
// 1. Usuario hace submit
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // 2. Mostrar loading
  setMessageStatus('loading');
  setMessageText('Authenticating...');

  try {
    // 3. Llamar al API de autenticación
    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        application_id: appId,
        callback_url: callbackUrl
      })
    });

    const data = await response.json();

    // 4. Manejar respuesta exitosa
    if (data.success) {
      setMessageStatus('success');
      setMessageText('Welcome back! Redirecting to your dashboard...');

      // 5. Redirect después de mostrar mensaje
      setTimeout(() => {
        // Construir URL de callback con parámetros
        const params = new URLSearchParams({
          token: data.access_token,
          refresh_token: data.refresh_token,
          user_id: data.user.id,
          state: 'authenticated'
        });

        window.location.href = `${data.callback_url}?${params.toString()}`;
      }, 2000);
    }
    // 6. Manejar respuesta con error
    else {
      setMessageStatus('error');
      setMessageText(data.error?.message || 'Authentication failed');

      // El usuario puede intentar nuevamente
      // No hay auto-dismiss en error para que puedan leer el mensaje
    }
  } catch (error) {
    // 7. Manejar errores de red
    setMessageStatus('error');
    setMessageText('Network error. Please check your connection and try again.');
  }
}
```

### 🎨 Variantes de Estilo de Mensajes

Cada estilo tiene su propia personalidad en los mensajes:

**Modern Glass:**
- Fondo translúcido con blur
- Bordes semi-transparentes
- Iconos en círculos con backdrop-blur
- Perfecto para: Apps modernas

**Minimal Clean:**
- Borde de color a la izquierda
- Sin bordes en otros lados
- Tipografía limpia
- Perfecto para: Apps minimalistas

**Corporate:**
- Caja con bordes y sombras
- Título + mensaje
- Progress bar en success
- Perfecto para: Empresas

**Gradient Bold:**
- Gradientes vibrantes de fondo
- Bordes con glow
- Iconos en cuadros con gradiente
- Perfecto para: Apps tech/gaming

**Neumorphic:**
- Sombras internas y externas
- Iconos elevados
- Efecto táctil
- Perfecto para: Apps de diseño

## 🔧 Características Técnicas

### Animaciones Incluidas
- ✅ Transiciones suaves en todos los elementos
- ✅ Efectos hover en botones y enlaces
- ✅ Focus states visuales
- ✅ Animaciones de entrada (fade-in, slide-in)
- ✅ Efectos de pulsación en fondos
- ✅ Transformaciones 3D sutiles

### Responsive Design
- ✅ Diseños adaptables a móvil, tablet y desktop
- ✅ Padding y márgenes responsivos
- ✅ Tamaños de fuente escalables
- ✅ Layouts que se ajustan al viewport

### Accesibilidad
- ✅ Alto contraste en textos
- ✅ Labels descriptivos
- ✅ Focus visible en todos los elementos interactivos
- ✅ Placeholder text accesible
- ✅ Estados de error claros

---

## 📊 Comparación de Estilos

| Estilo | Complejidad Visual | Formalidad | Modernidad | Mejor Para |
|--------|-------------------|------------|------------|------------|
| **Modern Glass** | Alta | Baja | Muy Alta | Startups, Creative |
| **Minimal Clean** | Baja | Media | Alta | Premium, Professional |
| **Corporate** | Media | Muy Alta | Media | Enterprise, B2B |
| **Gradient Bold** | Muy Alta | Baja | Muy Alta | Gaming, Entertainment |
| **Neumorphic** | Alta | Media | Alta | Design Tools, Wellness |

---

## 🚀 Próximos Pasos

Una vez que elijas el(los) estilo(s) que más te gusten, procederemos a:

1. **Integrar el sistema de configuración** en el BrandingManager
2. **Agregar las opciones de personalización** (colores, tipografía, etc.)
3. **Implementar el sistema de temas predefinidos**
4. **Crear variantes adicionales** según necesidad
5. **Agregar más formularios** (registro, recuperar password, etc.)

---

## 💡 Notas de Implementación

- ✅ **Sin Breaking Changes**: Los formularios actuales seguirán funcionando exactamente igual
- ✅ **Retrocompatibilidad**: Valores por defecto mantienen el comportamiento actual
- ✅ **Progresivo**: Se puede implementar gradualmente
- ✅ **Flexible**: Cada cliente elige su nivel de personalización
- ✅ **Escalable**: Fácil agregar nuevos estilos y opciones

---

## 🎯 Recomendaciones

### Para Empezar
Si no estás seguro qué estilo usar, te recomendamos:

1. **Corporate** para aplicaciones empresariales tradicionales
2. **Modern Glass** para productos tech modernos
3. **Minimal Clean** para servicios premium

### Para Personalizar
Los elementos más importantes a personalizar son:

1. **Colores primarios** (el que más impacto tiene)
2. **Logo** (identidad de marca)
3. **Tipografía** (personalidad del producto)
4. **Textos** (tono de comunicación)

---

## 📞 ¿Preguntas?

Este es solo un prototipo visual. Una vez que decidas qué estilo(s) implementar, procederemos con:

1. Desarrollo completo del sistema de branding extendido
2. Integración con el BrandingManager actual
3. Testing en todos los formularios (login, register, reset, confirm)
4. Documentación para clientes

**¡Explora los estilos y dime cuál te gusta más para empezar el desarrollo!** 🎨
