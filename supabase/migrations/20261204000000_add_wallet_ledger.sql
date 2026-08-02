/*
  # Billetera de credito prepago

  Agrega el ledger de saldo prepago por aplicacion, usado para cubrir el
  excedente de uso cuando un tenant/usuario se pasa de lo incluido en su
  plan. Sigue el mismo patron de scoping (application_id + tenant_id o
  app_user_id) que application_plan_subscriptions.

  - wallet_balances: saldo corriente, una fila por (application_id, tenant_id)
    o (application_id, app_user_id).
  - wallet_transactions: ledger append-only de cada movimiento (recarga,
    debito por excedente, reembolso, ajuste manual).
  - Nuevos codigos en el catalogo de features (application_billing_features)
    para que cada plan pueda configurar su precio de excedente por unidad
    desde el editor de planes ya existente. Quedan en 0 (sin cobro) hasta que
    se les asigne un valor real por plan.
*/

CREATE TABLE IF NOT EXISTS wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  balance decimal(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'UYU',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_id IS NOT NULL OR app_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_balances_app_tenant
  ON wallet_balances(application_id, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_balances_app_user
  ON wallet_balances(application_id, app_user_id)
  WHERE app_user_id IS NOT NULL AND tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  wallet_balance_id uuid NOT NULL REFERENCES wallet_balances(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('topup', 'debit', 'refund', 'adjustment')),
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UYU',
  balance_after decimal(12,2) NOT NULL,
  reference text,
  feature_code text,
  provider text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_provider_payment
  ON wallet_transactions(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_balance
  ON wallet_transactions(wallet_balance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_app_status
  ON wallet_transactions(application_id, status);

DROP TRIGGER IF EXISTS wallet_balances_updated_at ON wallet_balances;
CREATE TRIGGER wallet_balances_updated_at
  BEFORE UPDATE ON wallet_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Solo lectura para el owner de la aplicacion. Toda escritura pasa por
-- edge functions con service role (topup webhook, debito server-a-server),
-- nunca directo desde el cliente.
DROP POLICY IF EXISTS "Owners can view wallet balances of own applications" ON wallet_balances;
CREATE POLICY "Owners can view wallet balances of own applications"
  ON wallet_balances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = wallet_balances.application_id
      AND applications.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can view wallet transactions of own applications" ON wallet_transactions;
CREATE POLICY "Owners can view wallet transactions of own applications"
  ON wallet_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = wallet_transactions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

INSERT INTO application_billing_features
  (id, code, name, description, value_type, default_value, category, unit, active, is_system)
VALUES
  ('c1c1a001-2e2d-4a3e-9f11-2f1f6a2a0001', 'email_overage_price', 'Precio email excedente', 'Precio a cobrar de la billetera por cada email enviado por encima del cupo del plan', 'number', '0', 'billing', 'por email', true, true),
  ('c1c1a001-2e2d-4a3e-9f11-2f1f6a2a0002', 'pdf_overage_price', 'Precio PDF excedente', 'Precio a cobrar de la billetera por cada PDF generado por encima del cupo del plan', 'number', '0', 'billing', 'por PDF', true, true)
ON CONFLICT (code) DO NOTHING;
