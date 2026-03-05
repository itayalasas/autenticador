/*
  # Soporte de submenús en sistema de permisos

  1. Cambios
    - Agrega `parent_menu_id` a `application_menus` para modelar jerarquía menú/submenú.
    - Agrega índice para consultas por padre.
    - Valida que el menú padre pertenezca a la misma aplicación.

  2. Compatibilidad
    - Mantiene esquema de `role_permissions` sin cambios.
    - Menús existentes continúan como menús raíz (`parent_menu_id` null).
*/

ALTER TABLE application_menus
ADD COLUMN IF NOT EXISTS parent_menu_id uuid REFERENCES application_menus(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_application_menus_parent_menu_id
ON application_menus(parent_menu_id);

CREATE OR REPLACE FUNCTION validate_parent_menu_same_application()
RETURNS TRIGGER AS $$
DECLARE
  parent_app_id uuid;
BEGIN
  IF NEW.parent_menu_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT application_id INTO parent_app_id
  FROM application_menus
  WHERE id = NEW.parent_menu_id;

  IF parent_app_id IS NULL THEN
    RAISE EXCEPTION 'El menú padre no existe';
  END IF;

  IF parent_app_id <> NEW.application_id THEN
    RAISE EXCEPTION 'El menú padre debe pertenecer a la misma aplicación';
  END IF;

  IF NEW.parent_menu_id = NEW.id THEN
    RAISE EXCEPTION 'Un menú no puede ser padre de sí mismo';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_parent_menu_same_application ON application_menus;
CREATE TRIGGER trg_validate_parent_menu_same_application
  BEFORE INSERT OR UPDATE ON application_menus
  FOR EACH ROW
  EXECUTE FUNCTION validate_parent_menu_same_application();
