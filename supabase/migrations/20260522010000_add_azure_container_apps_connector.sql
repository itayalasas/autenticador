/*
  # Extend connectors and environment deploy bindings for Azure Container Apps

  Adds:
  - azure_container_apps connector type
  - deploy provider + Azure-specific binding fields per environment
*/

ALTER TABLE connectors_config
  DROP CONSTRAINT IF EXISTS connectors_config_connector_type_check;

ALTER TABLE connectors_config
  ADD CONSTRAINT connectors_config_connector_type_check
  CHECK (
    connector_type IN (
      'github',
      'netlify',
      'azure_container_apps',
      'gitlab',
      'bitbucket',
      'stripe',
      'dlocal'
    )
  );

ALTER TABLE environment_deploy_bindings
  ADD COLUMN IF NOT EXISTS deploy_provider text NOT NULL DEFAULT 'netlify'
    CHECK (deploy_provider IN ('netlify', 'azure_container_apps')),
  ADD COLUMN IF NOT EXISTS azure_container_app_name text,
  ADD COLUMN IF NOT EXISTS azure_resource_group text,
  ADD COLUMN IF NOT EXISTS azure_location text,
  ADD COLUMN IF NOT EXISTS azure_containerapps_environment text,
  ADD COLUMN IF NOT EXISTS azure_create_if_missing boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_env_deploy_bindings_provider
  ON environment_deploy_bindings(deploy_provider);
