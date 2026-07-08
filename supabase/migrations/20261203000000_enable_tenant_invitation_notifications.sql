/*
  # Enable tenant invitation notifications by default

  Backfills existing applications so the tenant invitation flow is active
  unless an application explicitly reconfigures it afterwards.
*/

UPDATE applications
SET email_config = jsonb_set(
  COALESCE(email_config, '{}'::jsonb),
  '{notifications}',
  COALESCE(email_config->'notifications', '{}'::jsonb) || jsonb_build_object(
    'tenant_invitation',
    COALESCE(email_config->'notifications'->'tenant_invitation', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'template_name',
        COALESCE(
          NULLIF(email_config->'notifications'->'tenant_invitation'->>'template_name', ''),
          'invitacion_usuario'
        )
    )
  ),
  true
);
