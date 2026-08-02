/*
  # Recarga de billetera (pago unico) + RPC de aplicacion de movimientos

  - wallet_topup_sessions: sesiones de checkout de recarga, mismo patron que
    subscription_checkout_sessions pero para un pago unico (Checkout Pro)
    en vez de una suscripcion recurrente (preapproval).
  - apply_wallet_transaction(): funcion unica y atomica para acreditar o
    debitar la billetera. La usa el webhook de recarga (Fase 2) y la va a
    reusar el endpoint de debito por excedente (Fase 4) para no duplicar la
    logica de concurrencia/idempotencia en dos lugares.
*/

CREATE TABLE IF NOT EXISTS wallet_topup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  payer_email text,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UYU',
  provider text NOT NULL DEFAULT 'mercadopago',
  external_reference text NOT NULL UNIQUE,
  return_url text NOT NULL,
  provider_preference_id text,
  provider_payment_id text,
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_id IS NOT NULL OR app_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topup_sessions_external_reference
  ON wallet_topup_sessions(external_reference);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_topup_sessions_provider_payment
  ON wallet_topup_sessions(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_topup_sessions_app_status
  ON wallet_topup_sessions(application_id, status, created_at DESC);

DROP TRIGGER IF EXISTS wallet_topup_sessions_updated_at ON wallet_topup_sessions;
CREATE TRIGGER wallet_topup_sessions_updated_at
  BEFORE UPDATE ON wallet_topup_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_application_billing_updated_at();

ALTER TABLE wallet_topup_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view wallet topup sessions of own applications" ON wallet_topup_sessions;
CREATE POLICY "Owners can view wallet topup sessions of own applications"
  ON wallet_topup_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications
      WHERE applications.id = wallet_topup_sessions.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Acredita o debita la billetera de forma atomica. Crea la fila de saldo si
-- no existe (arranca en 0). Es idempotente por (provider, provider_payment_id):
-- si ya se aplico ese pago, devuelve la transaccion existente sin repetir el
-- movimiento. Falla con insufficient_wallet_balance si un debito dejaria el
-- saldo negativo.
CREATE OR REPLACE FUNCTION apply_wallet_transaction(
  p_application_id uuid,
  p_tenant_id uuid,
  p_app_user_id uuid,
  p_type text,
  p_amount decimal,
  p_currency text DEFAULT 'UYU',
  p_reference text DEFAULT NULL,
  p_feature_code text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS wallet_transactions
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet wallet_balances;
  v_delta decimal;
  v_new_balance decimal;
  v_transaction wallet_transactions;
  v_existing wallet_transactions;
BEGIN
  IF p_type NOT IN ('topup', 'debit', 'refund', 'adjustment') THEN
    RAISE EXCEPTION 'invalid wallet transaction type: %', p_type;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet transaction amount must be positive';
  END IF;

  IF p_tenant_id IS NULL AND p_app_user_id IS NULL THEN
    RAISE EXCEPTION 'wallet transaction requires tenant_id or app_user_id';
  END IF;

  IF p_provider_payment_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM wallet_transactions
    WHERE provider = p_provider AND provider_payment_id = p_provider_payment_id;

    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    INSERT INTO wallet_balances (application_id, tenant_id, currency)
    VALUES (p_application_id, p_tenant_id, p_currency)
    ON CONFLICT (application_id, tenant_id) WHERE tenant_id IS NOT NULL
    DO NOTHING;

    SELECT * INTO v_wallet
    FROM wallet_balances
    WHERE application_id = p_application_id AND tenant_id = p_tenant_id
    FOR UPDATE;
  ELSE
    INSERT INTO wallet_balances (application_id, app_user_id, currency)
    VALUES (p_application_id, p_app_user_id, p_currency)
    ON CONFLICT (application_id, app_user_id) WHERE app_user_id IS NOT NULL AND tenant_id IS NULL
    DO NOTHING;

    SELECT * INTO v_wallet
    FROM wallet_balances
    WHERE application_id = p_application_id AND app_user_id = p_app_user_id AND tenant_id IS NULL
    FOR UPDATE;
  END IF;

  v_delta := CASE WHEN p_type IN ('topup', 'refund', 'adjustment') THEN p_amount ELSE -p_amount END;
  v_new_balance := v_wallet.balance + v_delta;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_wallet_balance';
  END IF;

  UPDATE wallet_balances
  SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (
    application_id, wallet_balance_id, tenant_id, app_user_id, type, amount, currency,
    balance_after, reference, feature_code, provider, provider_payment_id, status, metadata
  ) VALUES (
    p_application_id, v_wallet.id, p_tenant_id, p_app_user_id, p_type, p_amount, p_currency,
    v_new_balance, p_reference, p_feature_code, p_provider, p_provider_payment_id, 'completed', p_metadata
  )
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$;
