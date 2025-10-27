/*
  # Reset Admin Password

  Este script resetea la contraseña del usuario administrador pedro86cu@gmail.com

  INSTRUCCIONES:
  1. Ve a Supabase Dashboard → SQL Editor
  2. Copia y pega este script
  3. MODIFICA la contraseña en la línea 22 (reemplaza 'Admin123!' con tu contraseña deseada)
  4. Ejecuta el script
  5. Haz login con la nueva contraseña
*/

-- ========================================
-- CONFIGURACIÓN: CAMBIA ESTA CONTRASEÑA
-- ========================================

-- Resetear contraseña para pedro86cu@gmail.com
UPDATE auth.users
SET
  encrypted_password = crypt('Admin123!', gen_salt('bf')),  -- ⚠️ CAMBIA 'Admin123!' por tu contraseña
  updated_at = now()
WHERE email = 'pedro86cu@gmail.com';

-- Verificar que el usuario existe y fue actualizado
SELECT
  email,
  created_at,
  updated_at,
  email_confirmed_at,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'role' as role,
  'Password updated successfully!' as status
FROM auth.users
WHERE email = 'pedro86cu@gmail.com';

-- ========================================
-- RESULTADO ESPERADO
-- ========================================
-- Deberías ver:
-- email: pedro86cu@gmail.com
-- name: Pedro Ayala Ortiz
-- role: admin
-- status: Password updated successfully!
-- ========================================

-- Ahora puedes hacer login con:
-- Email: pedro86cu@gmail.com
-- Password: Admin123! (o la que hayas puesto arriba)
