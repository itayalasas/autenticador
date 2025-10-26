# Solución: Error en Formularios Públicos Desplegados

## Problema
Los formularios públicos desplegados muestran error: "Unexpected token '<', '<!DOCTYPE '... is not valid JSON"

Esto ocurre porque los archivos desplegados están incompletos. Faltan los servicios que necesita `PublicAuthForms.tsx`.

## Causa Raíz
La Edge Function `collect-source-files-complete` genera solo ALGUNOS archivos, pero **NO incluye los servicios** que se importan en los componentes:

```typescript
// En PublicAuthForms.tsx se importan estos servicios:
import { rolesService } from '../../services/rolesService';
import { applicationService } from '../../services/applicationService';
import { ipService } from '../../services/ipService';
```

Pero estos archivos **NO se generan** en el deploy, causando que el build falle o genere archivos incorrectos.

## Solución

Debemos actualizar la Edge Function `collect-source-files-complete` para que genere TODOS los archivos necesarios:

### Archivos que deben agregarse:

1. **src/lib/supabase.ts** - Versión simplificada sin `envConfigService`
2. **src/types/index.ts** - Definiciones de tipos
3. **src/services/rolesService.ts** - Manejo de roles
4. **src/services/applicationService.ts** - Solo función `getBranding()`
5. **src/services/ipService.ts** - Detección de IP del cliente

### Cambios Necesarios en collect-source-files-complete/index.ts

Después de la línea que genera `src/utils/themePresets.ts`, agregar:

```javascript
  // ============================================
  // LIB FILES
  // ============================================

  files['src/lib/supabase.ts'] = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
`;

  // ============================================
  // TYPES
  // ============================================

  files['src/types/index.ts'] = `export interface Application {
  id: string;
  application_id: string;
  name: string;
  description: string;
  domain: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRole {
  id: string;
  application_id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
  available_for_registration: boolean;
  is_active: boolean;
  created_at: string;
}

export interface BrandingConfig {
  id?: string;
  application_id: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  font_family?: string;
  logo_url?: string;
  border_radius?: number;
  button_style?: string;
  theme_style?: string;
  card_style?: string;
  card_background?: string;
  card_blur?: number;
  input_style?: string;
  input_background?: string;
  input_border_color?: string;
  input_focus_color?: string;
  button_variant?: string;
  button_size?: string;
  button_hover_transform?: boolean;
  color_success?: string;
  color_error?: string;
  color_warning?: string;
  use_gradient?: boolean;
  gradient_start?: string;
  gradient_end?: string;
  shadow_intensity?: string;
  glassmorphism_enabled?: boolean;
  background_blur_enabled?: boolean;
  animations_enabled?: boolean;
  animation_speed?: string;
  form_width?: string;
  spacing?: string;
  custom_texts?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export interface Environment {
  id: string;
  application_id: string;
  name: 'development' | 'testing' | 'production';
  domain: string;
  auth_url: string;
  callback_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
`;

  // ============================================
  // SERVICES
  // ============================================

  files['src/services/rolesService.ts'] = `import { supabase } from '../lib/supabase';
import { ApplicationRole } from '../types';

export const rolesService = {
  async getAvailableRolesForRegistration(applicationId: string): Promise<ApplicationRole[]> {
    const { data, error } = await supabase
      .from('application_roles')
      .select('*')
      .eq('application_id', applicationId)
      .eq('available_for_registration', true)
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('Error loading roles:', error);
      return [];
    }
    return data || [];
  }
};
`;

  files['src/services/applicationService.ts'] = `import { supabase } from '../lib/supabase';
import { BrandingConfig } from '../types';

export const applicationService = {
  async getBranding(applicationId: string): Promise<BrandingConfig | null> {
    const { data, error } = await supabase
      .from('branding_configs')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) {
      console.error('Error loading branding:', error);
      return null;
    }
    return data;
  }
};
`;

  files['src/services/ipService.ts'] = `export const ipService = {
  async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Detected client IP:', data.ip);
        return data.ip;
      }
    } catch (error) {
      console.error('Error detecting client IP:', error);
    }

    return '0.0.0.0';
  },

  async checkIPStatus(clientIp?: string): Promise<{
    is_blocked: boolean;
    blocked_info: any;
    ip_address: string;
  }> {
    try {
      const ipToCheck = clientIp || await this.getClientIP();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const apiUrl = \`\${supabaseUrl}/functions/v1/check-ip-status\`;

      console.log('🔍 Checking IP status for:', ipToCheck);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${supabaseAnonKey}\`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ client_ip: ipToCheck })
      });

      console.log('📡 Response status:', response.status);

      const result = await response.json();
      console.log('📦 Response data:', result);

      if (result.success) {
        return {
          is_blocked: result.data.is_blocked,
          blocked_info: result.data.blocked_info,
          ip_address: result.data.ip_address
        };
      }

      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: ipToCheck
      };
    } catch (error) {
      console.error('❌ Error checking IP status:', error);
      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: '0.0.0.0'
      };
    }
  }
};
`;
```

## Cómo Aplicar la Solución

### Opción 1: Actualizar manualmente la Edge Function

1. Abrir `supabase/functions/collect-source-files-complete/index.ts`
2. Buscar la línea: `files['src/utils/themePresets.ts'] = ...`
3. Después de esa línea, pegar el código de arriba
4. Guardar el archivo
5. Redeploy la Edge Function con el MCP tool: `mcp__supabase__deploy_edge_function`

### Opción 2: Automatizar con script

Ejecutar el script de actualización automática (cuando esté listo).

## Verificación

Después de aplicar la solución:

1. Deploy una aplicación desde el dashboard
2. Ir a la URL de login del deploy
3. Verificar que NO aparece el error "Unexpected token"
4. Verificar que los formularios funcionan correctamente
5. Probar login, registro y reset password

## Archivos Afectados

- ✅ `supabase/functions/collect-source-files-complete/index.ts` (actualizado)
- ✅ Todos los deploys nuevos incluirán los servicios necesarios

## Resultado Esperado

Los formularios desplegados funcionarán correctamente porque tendrán TODOS los archivos que necesitan para compilar y ejecutarse.
