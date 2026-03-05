/*
  # Environment Deploy Bindings

  Vincula un ambiente específico con su repositorio Git y sitio Netlify.
  Esto evita reconectar/manual seleccionar en cada deploy.
*/

CREATE TABLE IF NOT EXISTS environment_deploy_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE NOT NULL,
  git_repository_id uuid REFERENCES git_repositories(id) ON DELETE SET NULL,
  repo_full_name text,
  branch text DEFAULT 'main',
  netlify_site_id text,
  netlify_site_name text,
  netlify_site_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(environment_id)
);

ALTER TABLE environment_deploy_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own environment deploy bindings"
  ON environment_deploy_bindings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own environment deploy bindings"
  ON environment_deploy_bindings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own environment deploy bindings"
  ON environment_deploy_bindings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own environment deploy bindings"
  ON environment_deploy_bindings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_env_deploy_bindings_env_id
  ON environment_deploy_bindings(environment_id);

CREATE INDEX IF NOT EXISTS idx_env_deploy_bindings_app_id
  ON environment_deploy_bindings(application_id);

CREATE INDEX IF NOT EXISTS idx_env_deploy_bindings_repo_id
  ON environment_deploy_bindings(git_repository_id)
  WHERE git_repository_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_env_deploy_bindings_user_active
  ON environment_deploy_bindings(user_id, is_active)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_environment_deploy_bindings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_environment_deploy_bindings_updated_at_trigger ON environment_deploy_bindings;
CREATE TRIGGER update_environment_deploy_bindings_updated_at_trigger
  BEFORE UPDATE ON environment_deploy_bindings
  FOR EACH ROW
  EXECUTE FUNCTION update_environment_deploy_bindings_updated_at();
