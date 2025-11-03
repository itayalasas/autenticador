/*
  # Sistema de Permisos Granulares

  1. Nuevas Tablas
    - `application_menus`: Menús/recursos de cada aplicación
    - `menu_actions`: Acciones disponibles por menú  
    - `role_permissions`: Permisos asignados a cada rol

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indices
    - Índices para mejorar performance en consultas frecuentes
*/

-- Tabla de menús/recursos de aplicación
CREATE TABLE IF NOT EXISTS application_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  icon text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(application_id, slug)
);

-- Tabla de acciones disponibles
CREATE TABLE IF NOT EXISTS menu_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES application_menus(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(menu_id, slug)
);

-- Tabla de permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES application_roles(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES application_menus(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES menu_actions(id) ON DELETE CASCADE,
  granted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id, menu_id, action_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_application_menus_app_id ON application_menus(application_id);
CREATE INDEX IF NOT EXISTS idx_application_menus_slug ON application_menus(slug);
CREATE INDEX IF NOT EXISTS idx_menu_actions_menu_id ON menu_actions(menu_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_id ON role_permissions(menu_id);

-- Enable RLS
ALTER TABLE application_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies para application_menus
CREATE POLICY "Users can view menus of their applications"
  ON application_menus FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_menus.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create menus for their applications"
  ON application_menus FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_menus.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update menus of their applications"
  ON application_menus FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_menus.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_menus.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete menus of their applications"
  ON application_menus FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_menus.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Policies para menu_actions
CREATE POLICY "Users can view actions of their application menus"
  ON menu_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_menus
      JOIN applications ON applications.id = application_menus.application_id
      WHERE application_menus.id = menu_actions.menu_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create actions for their application menus"
  ON menu_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM application_menus
      JOIN applications ON applications.id = application_menus.application_id
      WHERE application_menus.id = menu_actions.menu_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update actions of their application menus"
  ON menu_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_menus
      JOIN applications ON applications.id = application_menus.application_id
      WHERE application_menus.id = menu_actions.menu_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM application_menus
      JOIN applications ON applications.id = application_menus.application_id
      WHERE application_menus.id = menu_actions.menu_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete actions of their application menus"
  ON menu_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_menus
      JOIN applications ON applications.id = application_menus.application_id
      WHERE application_menus.id = menu_actions.menu_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Policies para role_permissions
CREATE POLICY "Users can view permissions of their application roles"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_roles
      JOIN applications ON applications.id = application_roles.application_id
      WHERE application_roles.id = role_permissions.role_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create permissions for their application roles"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM application_roles
      JOIN applications ON applications.id = application_roles.application_id
      WHERE application_roles.id = role_permissions.role_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update permissions of their application roles"
  ON role_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_roles
      JOIN applications ON applications.id = application_roles.application_id
      WHERE application_roles.id = role_permissions.role_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM application_roles
      JOIN applications ON applications.id = application_roles.application_id
      WHERE application_roles.id = role_permissions.role_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete permissions of their application roles"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_roles
      JOIN applications ON applications.id = application_roles.application_id
      WHERE application_roles.id = role_permissions.role_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_application_menus_updated_at ON application_menus;
CREATE TRIGGER update_application_menus_updated_at
  BEFORE UPDATE ON application_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();