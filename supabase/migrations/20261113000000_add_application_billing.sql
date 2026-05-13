/*
  # Application billing

  Separa los planes comerciales de cada aplicacion del sistema de suscripciones
  interno de AuthSystem. Esta capa permite:

  - Configurar Mercado Pago por aplicacion
  - Crear planes propios por aplicacion
  - Sincronizar esos planes con Mercado Pago
  - Registrar suscripciones por tenant o por usuario final
*/

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS billing_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS application_billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  price decimal(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UYU',
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('day', 'week', 'month', 'year')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  repetitions integer,
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  billing_day integer,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  entitlements jsonb NOT NULL DEFAULT '{"features":[]}'::jsonb,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_plan_id text,
  provider_status text,
  provider_init_point text,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_application_billing_plans_app_slug
  ON application_billing_plans(application_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_application_billing_plans_provider_plan
  ON application_billing_plans(application_id, provider, provider_plan_id)
  WHERE provider_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_billing_plans_app_active
  ON application_billing_plans(application_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS application_plan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  application_plan_id uuid NOT NULL REFERENCES application_billing_plans(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  payer_email text,
  external_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'authorized', 'active', 'trialing', 'paused', 'cancelled', 'expired', 'payment_failed')
  ),
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_subscription_id text,
  provider_plan_id text,
  next_payment_date timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_application_plan_subscriptions_provider_subscription
  ON application_plan_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_plan_subscriptions_app_status
  ON application_plan_subscriptions(application_id, status);

CREATE INDEX IF NOT EXISTS idx_application_plan_subscriptions_tenant
  ON application_plan_subscriptions(tenant_id, status)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_plan_subscriptions_user
  ON application_plan_subscriptions(app_user_id, status)
  WHERE app_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_application_billing_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS application_billing_plans_updated_at ON application_billing_plans;
CREATE TRIGGER application_billing_plans_updated_at
  BEFORE UPDATE ON application_billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

DROP TRIGGER IF EXISTS application_plan_subscriptions_updated_at ON application_plan_subscriptions;
CREATE TRIGGER application_plan_subscriptions_updated_at
  BEFORE UPDATE ON application_plan_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

ALTER TABLE application_billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view billing plans of own applications" ON application_billing_plans;
CREATE POLICY "Owners can view billing plans of own applications"
  ON application_billing_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_billing_plans.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can insert billing plans of own applications" ON application_billing_plans;
CREATE POLICY "Owners can insert billing plans of own applications"
  ON application_billing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_billing_plans.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update billing plans of own applications" ON application_billing_plans;
CREATE POLICY "Owners can update billing plans of own applications"
  ON application_billing_plans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_billing_plans.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_billing_plans.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete billing plans of own applications" ON application_billing_plans;
CREATE POLICY "Owners can delete billing plans of own applications"
  ON application_billing_plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_billing_plans.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can view plan subscriptions of own applications" ON application_plan_subscriptions;
CREATE POLICY "Owners can view plan subscriptions of own applications"
  ON application_plan_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_plan_subscriptions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can insert plan subscriptions of own applications" ON application_plan_subscriptions;
CREATE POLICY "Owners can insert plan subscriptions of own applications"
  ON application_plan_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_plan_subscriptions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update plan subscriptions of own applications" ON application_plan_subscriptions;
CREATE POLICY "Owners can update plan subscriptions of own applications"
  ON application_plan_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_plan_subscriptions.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = application_plan_subscriptions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

