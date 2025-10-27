/*
  # Fix Auth Logs Insert Policy
  
  ## Summary
  Agrega política INSERT para permitir que el sistema registre eventos de autenticación en auth_logs.
  
  ## Changes
  1. Agrega política INSERT para permitir inserts en auth_logs
     - Permite a usuarios autenticados insertar logs
     - Permite inserts anónimos para eventos de registro/login fallidos
  
  ## Security
  - Los logs son de solo escritura para tracking
  - No se permite modificar logs existentes
  - Solo lectura para usuarios autenticados
*/

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Allow insert auth logs for authenticated and anon" ON auth_logs;

-- Allow authenticated users and service role to insert auth logs
CREATE POLICY "Allow insert auth logs for authenticated and anon"
  ON auth_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Ensure the SELECT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auth_logs' 
    AND policyname = 'Authenticated users can read all auth logs'
  ) THEN
    CREATE POLICY "Authenticated users can read all auth logs"
      ON auth_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;