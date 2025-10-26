# Guía de Pruebas de Seguridad

## 1. Prueba de Bloqueo por Intentos Fallidos

### Usando cURL:
```bash
# Intenta iniciar sesión 5 veces con credenciales incorrectas
for i in {1..5}; do
  curl -X POST https://tu-sitio.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrongpassword",
      "application_id": "tu-application-id"
    }'
  echo "Intento $i"
  sleep 1
done

# Verifica que tu IP fue bloqueada
curl -X POST https://tu-sitio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "correctpassword",
    "application_id": "tu-application-id"
  }'
```

### Usando el navegador:
1. Abre la consola del navegador (F12)
2. Copia y pega este código:

```javascript
const APPLICATION_ID = 'tu-application-id'; // Reemplaza con tu ID real
const API_URL = window.location.origin;

async function testFailedAttempts() {
  console.log('🔒 Iniciando prueba de bloqueo por intentos fallidos...');

  for (let i = 1; i <= 5; i++) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
          application_id: APPLICATION_ID
        })
      });

      const data = await response.json();
      console.log(`Intento ${i}:`, data);

      if (data.message && data.message.includes('bloqueada')) {
        console.log('✅ IP bloqueada correctamente después de', i, 'intentos');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error en intento', i, ':', error);
    }
  }

  console.log('⚠️ La IP no fue bloqueada después de 5 intentos');
}

testFailedAttempts();
```

## 2. Prueba de Rate Limiting

### Script para probar límites de requests:
```javascript
const APPLICATION_ID = 'tu-application-id';
const API_KEY = 'tu-api-key';
const API_URL = window.location.origin;

async function testRateLimit() {
  console.log('⏱️ Iniciando prueba de rate limiting...');

  const requests = [];

  // Intenta hacer 20 requests rápidamente
  for (let i = 1; i <= 20; i++) {
    requests.push(
      fetch(`${API_URL}/api/user-search?email=test@example.com`, {
        headers: {
          'X-API-Key': API_KEY,
          'X-Application-ID': APPLICATION_ID
        }
      })
      .then(res => res.json())
      .then(data => ({ attempt: i, status: 'success', data }))
      .catch(error => ({ attempt: i, status: 'error', error: error.message }))
    );
  }

  const results = await Promise.all(requests);

  const blocked = results.filter(r =>
    r.data?.error?.includes('rate limit') ||
    r.data?.message?.includes('rate limit')
  );

  console.log('Total requests:', results.length);
  console.log('Requests bloqueados por rate limit:', blocked.length);
  console.log('Resultados:', results);

  if (blocked.length > 0) {
    console.log('✅ Rate limiting funcionando correctamente');
  } else {
    console.log('⚠️ No se detectó rate limiting');
  }
}

testRateLimit();
```

## 3. Prueba de Inyección SQL

### Test básico de SQL Injection:
```javascript
async function testSQLInjection() {
  console.log('💉 Iniciando prueba de SQL Injection...');

  const maliciousInputs = [
    "' OR '1'='1",
    "admin'--",
    "' OR 1=1--",
    "'; DROP TABLE users;--",
    "1' UNION SELECT * FROM users--"
  ];

  for (const input of maliciousInputs) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input,
          password: 'test',
          application_id: APPLICATION_ID
        })
      });

      const data = await response.json();
      console.log('Input:', input);
      console.log('Response:', data);

      // Si obtenemos un token o acceso, hay una vulnerabilidad
      if (data.token || data.session) {
        console.error('❌ VULNERABILIDAD DETECTADA con input:', input);
      } else {
        console.log('✅ Input bloqueado correctamente');
      }
    } catch (error) {
      console.log('✅ Error esperado:', error.message);
    }
  }
}

testSQLInjection();
```

## 4. Prueba de XSS (Cross-Site Scripting)

```javascript
async function testXSS() {
  console.log('🎭 Iniciando prueba de XSS...');

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>'
  ];

  for (const payload of xssPayloads) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test123!',
          full_name: payload,
          application_id: APPLICATION_ID
        })
      });

      const data = await response.json();
      console.log('Payload:', payload);
      console.log('Response:', data);

      // Verifica si el payload fue sanitizado
      if (data.user?.full_name === payload) {
        console.warn('⚠️ Payload no sanitizado:', payload);
      } else {
        console.log('✅ Payload sanitizado correctamente');
      }
    } catch (error) {
      console.log('Response:', error.message);
    }
  }
}

testXSS();
```

## 5. Verificar Estado de Seguridad en el Dashboard

1. **Ve a la sección de Seguridad** en tu dashboard
2. **Revisa el Security Monitoring** para ver:
   - IPs bloqueadas
   - Intentos de autenticación fallidos
   - Alertas de seguridad

3. **Verifica en Supabase** ejecutando estas queries:

```sql
-- Ver IPs bloqueadas
SELECT * FROM blocked_ips
ORDER BY created_at DESC;

-- Ver intentos fallidos recientes
SELECT * FROM auth_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- Ver alertas de seguridad
SELECT * FROM security_alerts
ORDER BY created_at DESC
LIMIT 10;

-- Ver eventos de seguridad
SELECT * FROM security_events
ORDER BY created_at DESC
LIMIT 20;
```

## 6. Prueba de Acceso no Autorizado

```javascript
async function testUnauthorizedAccess() {
  console.log('🔐 Iniciando prueba de acceso no autorizado...');

  // Intenta acceder sin token
  try {
    const response = await fetch(`${API_URL}/api/protected-endpoint`, {
      headers: {
        'X-API-Key': 'invalid-key',
        'X-Application-ID': APPLICATION_ID
      }
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      console.log('✅ Acceso denegado correctamente:', data);
    } else {
      console.error('❌ VULNERABILIDAD: Acceso permitido sin autorización');
    }
  } catch (error) {
    console.log('✅ Error esperado:', error.message);
  }
}

testUnauthorizedAccess();
```

## 7. Herramientas Recomendadas

### OWASP ZAP (Gratis)
```bash
# Instalación en Linux/Mac
# Descarga desde: https://www.zaproxy.org/download/

# Uso básico para escaneo
zap-cli quick-scan https://tu-sitio.com
```

### Burp Suite Community (Gratis)
1. Descarga desde: https://portswigger.net/burp/communitydownload
2. Configura el proxy en tu navegador
3. Intercepta y modifica requests para probar vulnerabilidades

### Nikto (Gratis)
```bash
# Instalación en Linux
sudo apt-get install nikto

# Escaneo básico
nikto -h https://tu-sitio.com
```

## 8. Checklist de Seguridad

- [ ] Bloqueo automático después de 5 intentos fallidos
- [ ] Rate limiting funcionando (10 requests por minuto por defecto)
- [ ] SQL Injection bloqueado
- [ ] XSS sanitizado
- [ ] CORS configurado correctamente
- [ ] Headers de seguridad presentes (CSP, X-Frame-Options, etc.)
- [ ] Acceso no autorizado denegado
- [ ] Logs de seguridad registrando eventos
- [ ] Alertas de seguridad funcionando
- [ ] API keys validándose correctamente

## 9. Monitoreo Continuo

Después de las pruebas, revisa:

1. **Dashboard > Seguridad > Alertas**
2. **Dashboard > Logs > Eventos de Seguridad**
3. **Supabase > Table Editor > blocked_ips**
4. **Supabase > Table Editor > security_alerts**

## 10. Prueba Automatizada Completa

Script que ejecuta todas las pruebas:

```javascript
const SecurityTester = {
  APPLICATION_ID: 'tu-application-id',
  API_KEY: 'tu-api-key',
  API_URL: window.location.origin,

  async runAllTests() {
    console.log('🚀 Iniciando suite completa de pruebas de seguridad...\n');

    await this.testFailedLoginAttempts();
    await this.wait(2000);

    await this.testRateLimit();
    await this.wait(2000);

    await this.testSQLInjection();
    await this.wait(2000);

    await this.testXSS();
    await this.wait(2000);

    await this.testUnauthorizedAccess();

    console.log('\n✅ Suite de pruebas completada');
  },

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ... implementar los métodos de prueba aquí
};

// Ejecutar todas las pruebas
SecurityTester.runAllTests();
```

## Notas Importantes

⚠️ **ADVERTENCIAS:**
- NO ejecutes estas pruebas en producción sin autorización
- Algunas pruebas pueden bloquear tu IP temporalmente
- Usa un entorno de staging/pruebas cuando sea posible
- Documenta todos los resultados de las pruebas
- Las pruebas agresivas pueden activar alertas de seguridad del hosting

✅ **Mejores Prácticas:**
- Prueba desde diferentes IPs (usa VPN o proxy)
- Documenta cada vulnerabilidad encontrada
- Corrige vulnerabilidades antes de hacer públicas las pruebas
- Mantén un log de todas las pruebas realizadas
- Informa a tu equipo antes de realizar pruebas intensivas
