/*
  # Fix Signup Triggers - Error Handling
  
  ## Summary
  Modifica las funciones de trigger para que sean más tolerantes a errores
  y no bloqueen el registro de usuarios.
  
  ## Changes
  1. Modifica handle_new_user() para manejar errores en profiles
  2. Modifica create_welcome_notification() para manejar errores
  3. Agrega manejo de excepciones para que el signup no falle
  
  ## Security
  - Mantiene SECURITY DEFINER para acceso a tablas
  - Agrega logging de errores
  - No bloquea el registro si hay problemas con tablas relacionadas
*/

-- Drop and recreate handle_new_user with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Try to insert profile, but don't fail if it errors
  BEGIN
    INSERT INTO public.profiles (user_id, name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

-- Drop and recreate create_welcome_notification with error handling
CREATE OR REPLACE FUNCTION public.create_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Try to create notification, but don't fail if it errors
  BEGIN
    INSERT INTO notifications (user_id, title, message, type, category)
    VALUES (
      NEW.id,
      'Bienvenido a AuthSystem',
      'Gracias por unirte a AuthSystem. Estamos emocionados de tenerte aquí.',
      'success',
      'system'
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create welcome notification for user %: %', NEW.id, SQLERRM;
  END;

  -- Try to create preferences, but don't fail if it errors
  BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create notification preferences for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Verify triggers are still active
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;