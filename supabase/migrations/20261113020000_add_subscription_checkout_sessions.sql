/*
  # Managed subscription checkout sessions

  Permite que AuthSystem inicie el checkout de Mercado Pago, reciba el
  retorno del comprador, sincronice la suscripcion y lo redirija nuevamente
  a la pagina exacta de origen sin perder contexto.
*/

CREATE TABLE IF NOT EXISTS subscription_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  application_plan_id uuid NOT NULL REFERENCES application_billing_plans(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  payer_email text,
  provider text NOT NULL DEFAULT 'mercadopago',
  external_reference text NOT NULL UNIQUE,
  return_url text NOT NULL,
  provider_plan_id text,
  provider_subscription_id text,
  provider_checkout_url text,
  provider_status text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'checkout_created', 'returned', 'completed', 'failed', 'cancelled', 'expired')
  ),
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_checkout_sessions_external_reference
  ON subscription_checkout_sessions(external_reference);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_checkout_sessions_provider_subscription
  ON subscription_checkout_sessions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_checkout_sessions_app_status
  ON subscription_checkout_sessions(application_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_checkout_sessions_tenant
  ON subscription_checkout_sessions(tenant_id, status)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_checkout_sessions_user
  ON subscription_checkout_sessions(app_user_id, status)
  WHERE app_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS subscription_checkout_sessions_updated_at ON subscription_checkout_sessions;
CREATE TRIGGER subscription_checkout_sessions_updated_at
  BEFORE UPDATE ON subscription_checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

ALTER TABLE subscription_checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view checkout sessions of own applications" ON subscription_checkout_sessions;
CREATE POLICY "Owners can view checkout sessions of own applications"
  ON subscription_checkout_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = subscription_checkout_sessions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can insert checkout sessions of own applications" ON subscription_checkout_sessions;
CREATE POLICY "Owners can insert checkout sessions of own applications"
  ON subscription_checkout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = subscription_checkout_sessions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update checkout sessions of own applications" ON subscription_checkout_sessions;
CREATE POLICY "Owners can update checkout sessions of own applications"
  ON subscription_checkout_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = subscription_checkout_sessions.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = subscription_checkout_sessions.application_id
      AND applications.owner_id = auth.uid()
    )
  );
