/*
  # Billing feature catalog and plan feature assignments

  Agrega un catalogo global de funcionalidades/limites reutilizable entre planes
  y una tabla relacional por plan para conservar la forma legacy de
  entitlements.features sin depender de texto libre.
*/

CREATE TABLE IF NOT EXISTS application_billing_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  value_type text NOT NULL CHECK (value_type IN ('boolean', 'number', 'text')),
  default_value text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'features',
  unit text,
  active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_billing_features_active
  ON application_billing_features(active, category, name);

CREATE TABLE IF NOT EXISTS application_billing_plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_plan_id uuid NOT NULL REFERENCES application_billing_plans(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES application_billing_features(id) ON DELETE RESTRICT,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_plan_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_application_billing_plan_features_plan
  ON application_billing_plan_features(application_plan_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_application_billing_plan_features_feature
  ON application_billing_plan_features(feature_id);

DROP TRIGGER IF EXISTS application_billing_features_updated_at ON application_billing_features;
CREATE TRIGGER application_billing_features_updated_at
  BEFORE UPDATE ON application_billing_features
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

DROP TRIGGER IF EXISTS application_billing_plan_features_updated_at ON application_billing_plan_features;
CREATE TRIGGER application_billing_plan_features_updated_at
  BEFORE UPDATE ON application_billing_plan_features
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

ALTER TABLE application_billing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_billing_plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view billing feature catalog" ON application_billing_features;
CREATE POLICY "Authenticated can view billing feature catalog"
  ON application_billing_features
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert custom billing features" ON application_billing_features;
CREATE POLICY "Authenticated can insert custom billing features"
  ON application_billing_features
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(created_by, auth.uid()) = auth.uid()
    AND is_system = false
  );

DROP POLICY IF EXISTS "Creators can update custom billing features" ON application_billing_features;
CREATE POLICY "Creators can update custom billing features"
  ON application_billing_features
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND is_system = false
  )
  WITH CHECK (
    created_by = auth.uid()
    AND is_system = false
  );

DROP POLICY IF EXISTS "Creators can delete custom billing features" ON application_billing_features;
CREATE POLICY "Creators can delete custom billing features"
  ON application_billing_features
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND is_system = false
  );

DROP POLICY IF EXISTS "Owners can view plan feature assignments of own applications" ON application_billing_plan_features;
CREATE POLICY "Owners can view plan feature assignments of own applications"
  ON application_billing_plan_features
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM application_billing_plans
      JOIN applications ON applications.id = application_billing_plans.application_id
      WHERE application_billing_plans.id = application_billing_plan_features.application_plan_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can insert plan feature assignments of own applications" ON application_billing_plan_features;
CREATE POLICY "Owners can insert plan feature assignments of own applications"
  ON application_billing_plan_features
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM application_billing_plans
      JOIN applications ON applications.id = application_billing_plans.application_id
      WHERE application_billing_plans.id = application_billing_plan_features.application_plan_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update plan feature assignments of own applications" ON application_billing_plan_features;
CREATE POLICY "Owners can update plan feature assignments of own applications"
  ON application_billing_plan_features
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM application_billing_plans
      JOIN applications ON applications.id = application_billing_plans.application_id
      WHERE application_billing_plans.id = application_billing_plan_features.application_plan_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM application_billing_plans
      JOIN applications ON applications.id = application_billing_plans.application_id
      WHERE application_billing_plans.id = application_billing_plan_features.application_plan_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete plan feature assignments of own applications" ON application_billing_plan_features;
CREATE POLICY "Owners can delete plan feature assignments of own applications"
  ON application_billing_plan_features
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM application_billing_plans
      JOIN applications ON applications.id = application_billing_plans.application_id
      WHERE application_billing_plans.id = application_billing_plan_features.application_plan_id
      AND applications.owner_id = auth.uid()
    )
  );

INSERT INTO application_billing_features
  (id, code, name, description, value_type, default_value, category, unit, active, is_system)
VALUES
  ('27696052-fed3-48fc-a8a0-179bea072552', 'api_calls_per_month', 'Llamadas API Mensuales', 'Número máximo de llamadas a la API por mes', 'number', '30000', 'limits', 'llamadas/mes', true, true),
  ('2e86eb12-7489-4cb9-8c43-aee5fe4c0d6b', 'max_projects', 'Máximo de Proyectos', 'Número máximo de proyectos que se pueden crear', 'number', '10', 'limits', 'proyectos', true, true),
  ('35e76bc6-d2b8-456e-8a07-92c1a7002165', 'max_environments', 'Máximo de Entornos', 'Número máximo de entornos por proyecto', 'number', '3', 'limits', 'entornos', true, true),
  ('380f411c-1e3a-4901-9dd9-0c7aba4de228', 'max_admin_users', 'Máximo de Administradores', 'Número máximo de usuarios con rol de administrador', 'number', '5', 'limits', 'usuarios', true, true),
  ('383ab5c9-dddd-45e3-b76a-b7dfb2e9fd92', 'priority_support', 'Soporte Prioritario', 'Soporte técnico con respuesta prioritaria', 'boolean', 'false', 'features', null, true, true),
  ('401cd2c2-ee44-4d1f-bf21-db65e9a9c48f', 'acceso_api_resend', 'acceso_api_resend', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true),
  ('40c8b8a8-fe18-4ead-b080-4d00ce58d376', 'ip_whitelist', 'Lista Blanca de IPs', 'Permite restringir acceso por IP', 'boolean', 'false', 'security', null, true, true),
  ('431f2c76-2a63-499b-b73d-c8f561e6678c', 'default_email', 'default_email', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true),
  ('43ac0455-ebd0-48a8-9c52-e873b7ce223f', 'max_users', 'Máximo de Usuarios', 'Número máximo de usuarios que pueden registrarse en la aplicación', 'number', '50', 'limits', 'usuarios', true, true),
  ('48e49b6f-4c57-4f98-976c-423a3dbd0144', 'audit_logs', 'Registros de Auditoría', 'Logs detallados de todas las acciones del sistema', 'boolean', 'false', 'features', null, true, true),
  ('4955f1c7-6e2b-42ef-802b-64b0aff36269', 'templates', 'templates', 'Funcionalidad personalizada', 'number', '10', 'limits', null, true, true),
  ('55b55b3c-c9a2-4747-bad0-c017881eed36', 'custom_domain', 'Dominio Personalizado', 'Permite configurar un dominio personalizado', 'boolean', 'false', 'features', null, true, true),
  ('5d545bcd-ac68-44d3-bd33-594ce931969e', 'max_bandwidth_gb', 'Ancho de Banda Mensual', 'Transferencia de datos máxima por mes', 'number', '500', 'limits', 'GB', true, true),
  ('5dbb2234-1280-434a-9b52-a29f21bb9e23', 'max_integrations', 'Integraciones', 'Número máximo de integraciones con servicios externos', 'number', '10', 'features', 'integraciones', true, true),
  ('5fea0bd7-fb15-4215-baaa-251f8bc488f6', 'max_file_size_mb', 'Tamaño Máximo de Archivo', 'Tamaño máximo permitido por archivo individual', 'number', '50', 'limits', 'MB', true, true),
  ('61b8e993-7486-4d41-81fb-eb1670bbade3', 'max_team_members', 'Máximo de Miembros del Equipo', 'Número máximo de miembros en un equipo', 'number', '10', 'limits', 'usuarios', true, true),
  ('71e8902e-0848-4fa7-80a4-e742b64430c9', 'cantidad_cuenta_correo', 'cantidad_cuenta_correo', 'Cantidad de cuentas de correo a configurar para enviar mail', 'number', '-23', 'limits', null, true, true),
  ('77e55410-a59f-4f6e-94df-d15bc26e0dd2', 'real_time_collaboration', 'Colaboración en Tiempo Real', 'Permite edición colaborativa en tiempo real', 'boolean', 'false', 'features', null, true, true),
  ('7ff14a1b-49ea-49a1-9370-868c9628e089', 'max_concurrent_users', 'Usuarios Concurrentes', 'Número máximo de usuarios conectados simultáneamente', 'number', '20', 'limits', 'usuarios', true, true),
  ('8a68ca13-cda2-4c91-8bd4-b04075de32ef', 'api_calls_per_day', 'Llamadas API Diarias', 'Número máximo de llamadas a la API por día', 'number', '1000', 'limits', 'llamadas/día', true, true),
  ('8d6a6826-4766-4e6d-ba67-fc9a1e9d2a75', 'api_rate_limit', 'Límite de Tasa API', 'Número de peticiones por minuto permitidas', 'number', '60', 'limits', 'req/min', true, true),
  ('913a5fc0-e102-4d8d-b003-5a9fdabeb260', 'webhook_endpoints', 'Endpoints de Webhook', 'Número máximo de webhooks configurables', 'number', '10', 'limits', 'endpoints', true, true),
  ('97287b76-f41c-48c6-bf48-6f8b1647ee43', 'configuración_smtp', 'Configuración_SMTP', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true),
  ('9909250e-b84b-432d-a0cd-f02076f18f56', 'total_de_correos_mensuales', 'Total de correos mensuales', 'Cantidad de correos enviados mensual', 'number', '1000', 'limits', 'correos', true, true),
  ('a032f51d-6b12-41ca-8190-ea9292da1154', 'pdf_generations_monthly', 'pdf_generations_monthly', 'Funcionalidad personalizada', 'number', '200', 'limits', null, true, true),
  ('ac1bd4ea-3d43-46f2-a907-5a093cc36d60', 'sso_integration', 'Integración SSO', 'Single Sign-On con proveedores externos', 'boolean', 'false', 'features', null, true, true),
  ('adc30eb3-a330-468c-909f-1ac67df607f9', 'transacciones', 'Transacciones', 'Funcionalidad personalizada', 'number', '10000', 'limits', null, true, true),
  ('b528255b-bc23-418d-9634-facc24fe6be4', 'advanced_analytics', 'Analítica Avanzada', 'Acceso a reportes y analíticas avanzadas', 'boolean', 'false', 'features', null, true, true),
  ('b8f6ed0b-1a2c-4b27-96fd-732816364fc6', 'max_workflows', 'Flujos de Trabajo', 'Número máximo de workflows automatizados', 'number', '5', 'features', 'workflows', true, true),
  ('b9e4c764-b408-48bc-96a7-9da8a8153761', 'export_data', 'Exportación de Datos', 'Permite exportar datos en múltiples formatos', 'boolean', 'true', 'features', null, true, true),
  ('bdc66693-3df2-487f-a75a-aeb2e9dafc9b', 'advanced_reports', 'advanced_reports', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true),
  ('cc1d6aef-94ac-4ed1-9493-bb7454252947', 'dominio_propio', 'dominio_propio', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true),
  ('d52e91f9-d8fc-4208-80eb-2ef51f482308', 'support_channels', 'Canales de Soporte', 'Canales disponibles para soporte (email, chat, phone)', 'text', 'email', 'support', null, true, true),
  ('dc6adf27-79f4-4cb9-8d7c-8a549885ae04', 'max_custom_fields', 'Campos Personalizados', 'Número máximo de campos personalizados', 'number', '20', 'features', 'campos', true, true),
  ('dfcaa300-fc2d-4117-9864-d47a6524fa35', 'white_label', 'Marca Blanca', 'Permite personalización completa de marca', 'boolean', 'false', 'features', null, true, true),
  ('e12463b7-0ccf-43f5-9fba-fc4795aa8a45', 'max_storage_gb', 'Almacenamiento Máximo', 'Capacidad máxima de almacenamiento disponible', 'number', '100', 'limits', 'GB', true, true),
  ('e1892af5-9eb7-4ab8-8952-f84bd4ed7c19', 'support_response_time', 'Tiempo de Respuesta', 'Tiempo máximo de respuesta del soporte (en horas)', 'number', '24', 'support', 'horas', true, true),
  ('e649bc83-f0c0-4c60-9ea0-665c4a4a3ae9', 'max_applications', 'Máximo de Aplicaciones', 'Número máximo de aplicaciones que se pueden registrar', 'number', '5', 'limits', 'aplicaciones', true, true),
  ('ee8e6a96-e48b-4382-9abe-7628a90ae2f1', 'custom_reports', 'Reportes Personalizados', 'Creación de reportes personalizados', 'boolean', 'false', 'features', null, true, true),
  ('f14f764c-52ce-459d-b594-1a1626be7bd2', 'two_factor_auth', 'Autenticación de Dos Factores', 'Requiere 2FA para todos los usuarios', 'boolean', 'false', 'security', null, true, true),
  ('f341ccbd-dbcd-4f8d-b9e9-56295bad5b84', 'api_access', 'Acceso a API', 'Habilita acceso completo a la API REST', 'boolean', 'true', 'features', null, true, true),
  ('f5e79fd2-dc95-4c6c-981f-fe4d37bac569', 'backup_restore', 'Respaldo y Restauración', 'Copias de seguridad automáticas y restauración', 'boolean', 'true', 'features', null, true, true),
  ('f7a739bb-59a3-4983-9a97-3beae0daed41', 'encryption_at_rest', 'Encriptación en Reposo', 'Datos encriptados en el almacenamiento', 'boolean', 'true', 'security', null, true, true),
  ('fe6214db-64ca-4b12-a35a-9cf1a572da38', 'marketplace', 'marketplace', 'Funcionalidad personalizada', 'boolean', 'false', 'features', null, true, true)
ON CONFLICT (code) DO NOTHING;
