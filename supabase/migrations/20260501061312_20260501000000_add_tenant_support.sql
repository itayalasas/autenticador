/*
  # Soporte Multi-Tenant por Aplicación

  ## Resumen
  Agrega soporte opcional de tenants (empresas/organizaciones) por aplicación,
  permitiendo que cada aplicación elija entre autenticación clásica (1:1) o
  autenticación por tenant (empresa → usuarios).

  ## Cambios

  ### Tabla Nueva: tenants
  - Almacena las empresas/organizaciones registradas por aplicación
  - Cada tenant pertenece a una aplicación específica
  - Tiene un slug único por aplicación para identificación externa
  - Campos: id, application_id, name, slug, domain, status, metadata, created_at, updated_at

  ### Columna Nueva: applications.auth_mode
  - Tipo: text, default 'classic'
  - Valores: 'classic' | 'tenant'
  - Las apps existentes mantienen 'classic' sin cambios de comportamiento

  ### Columna Nueva: app_users.tenant_id
  - Tipo: uuid nullable, FK → tenants
  - Las apps clásicas tienen NULL (sin impacto)
  - Las apps en modo tenant auto-asignan tenant_id al registrar usuarios

  ## Seguridad
  - RLS habilitado en tabla tenants
  - Solo el dueño de la aplicación puede gestionar sus tenants
  - Los usuarios del sistema (auth.users) pueden leer tenants de sus propias apps
*/

-- 1. Agregar auth_mode a applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'auth_mode'
  ) THEN
    ALTER TABLE applications ADD COLUMN auth_mode text NOT NULL DEFAULT 'classic';
  END IF;
END $$;

-- 2. Crear tabla tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  domain text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(application_id, slug)
);

-- 3. Agregar tenant_id a app_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE app_users ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Indice para busqueda rapida de usuarios por tenant
CREATE INDEX IF NOT EXISTS idx_app_users_tenant_id ON app_users(tenant_id);

-- 5. Indice para busqueda de tenants por aplicacion
CREATE INDEX IF NOT EXISTS idx_tenants_application_id ON tenants(application_id);

-- 6. Trigger updated_at para tenants
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();

-- 7. RLS en tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Solo el dueño de la aplicacion puede ver sus tenants
CREATE POLICY "Owner can view tenants of their applications"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = tenants.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Solo el dueño puede insertar tenants
CREATE POLICY "Owner can insert tenants for their applications"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = tenants.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Solo el dueño puede actualizar tenants
CREATE POLICY "Owner can update tenants of their applications"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = tenants.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = tenants.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Solo el dueño puede eliminar tenants
CREATE POLICY "Owner can delete tenants of their applications"
  ON tenants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = tenants.application_id
      AND applications.owner_id = auth.uid()
    )
  );
