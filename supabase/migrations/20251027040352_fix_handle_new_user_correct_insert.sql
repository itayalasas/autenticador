/*
  # Fix handle_new_user - Correct Insert Strategy
  
  ## Summary
  Corrige el trigger handle_new_user para dejar que profiles.id se auto-genere
  y solo establecer user_id, name, y email.
  
  ## Changes
  1. Modifica handle_new_user() para NO especificar profiles.id
  2. Deja que profiles.id se auto-genere con gen_random_uuid()
  3. Solo establece user_id (FK a auth.users), name, y email
  
  ## Security
  - Mantiene SECURITY DEFINER
  - No cambia políticas RLS
*/

-- Fix handle_new_user with correct insert strategy
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Insert profile letting id auto-generate, only set user_id, name, email
  BEGIN
    INSERT INTO public.profiles (user_id, name, email)
    VALUES (
      NEW.id,      -- profiles.user_id = auth.users.id
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
