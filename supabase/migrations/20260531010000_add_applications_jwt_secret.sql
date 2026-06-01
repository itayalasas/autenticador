ALTER TABLE applications
ADD COLUMN IF NOT EXISTS jwt_secret text;

UPDATE applications
SET jwt_secret = encode(gen_random_bytes(32), 'hex')
WHERE jwt_secret IS NULL OR btrim(jwt_secret) = '';

ALTER TABLE applications
ALTER COLUMN jwt_secret SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE applications
ALTER COLUMN jwt_secret SET NOT NULL;
