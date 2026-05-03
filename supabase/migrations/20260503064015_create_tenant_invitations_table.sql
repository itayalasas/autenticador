/*
  # Create tenant invitations system

  1. New Tables
    - `tenant_invitations`
      - `id` (uuid, primary key)
      - `application_id` (uuid, fk applications)
      - `tenant_id` (uuid, fk tenants)
      - `email` (text) — invitee email
      - `role_id` (uuid, fk application_roles)
      - `invited_by_user_id` (uuid, fk app_users) — admin who created invite
      - `token` (text, unique) — secure random token for invite link
      - `status` (text) — pending | accepted | revoked | expired
      - `expires_at` (timestamptz) — default +7 days
      - `accepted_at` (timestamptz, nullable)
      - `accepted_user_id` (uuid, nullable) — resulting app_user
      - `redirect_url` (text, nullable) — optional override for accept link
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Unique on `token`
    - Partial unique on `(application_id, lower(email))` WHERE status='pending' to prevent duplicates
    - Index on `(tenant_id, status)` for listing

  3. Security
    - Enable RLS
    - No public policies: all access happens through edge functions using service_role
*/

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES application_roles(id) ON DELETE RESTRICT,
  invited_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  redirect_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_token_key
  ON tenant_invitations(token);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_unique_pending
  ON tenant_invitations(application_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_status_idx
  ON tenant_invitations(tenant_id, status);

CREATE INDEX IF NOT EXISTS tenant_invitations_application_idx
  ON tenant_invitations(application_id);

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
