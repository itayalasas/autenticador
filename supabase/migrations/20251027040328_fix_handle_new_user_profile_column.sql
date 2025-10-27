/*
  # Fix handle_new_user - Correct Profile Column
  
  ## Summary
  Corrige el trigger handle_new_user para usar la columna correcta (id) 
  en lugar de user_id al crear el perfil.
  
  ## Changes
  1. Modifica handle_new_user() para insertar en profiles.id en lugar de profiles.user_id
  2. Mantiene el manejo de errores existente
  
  ## Security
  - Mantiene SECURITY DEFINER
  - No cambia políticas RLS
*/

-- Fix handle_new_user to use correct column (id instead of user_id)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Try to insert profile with correct column mapping
  BEGIN
    INSERT INTO public.profiles (id, user_id, name, email)
    VALUES (
      NEW.id,      -- profiles.id (PRIMARY KEY)
      NEW.id,      -- profiles.user_id (FOREIGN KEY to auth.users)
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

-- Verify the function was updated
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';