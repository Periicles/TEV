-- Creates an account that can sign in to TEV.
-- Edit the three values in `params`, then run the whole statement (Neon console → SQL Editor).
-- The password must be 12 to 72 characters long.
WITH params AS (
  SELECT
    'you@example.com'::text AS email,
    'Your Name'::text AS name,
    'change-me-please'::text AS password
),
new_user AS (
  INSERT INTO "user" (id, name, email, email_verified)
  SELECT gen_random_uuid()::text, trim(name), lower(trim(email)), true
  FROM params
  RETURNING id
)
INSERT INTO account (id, account_id, provider_id, user_id, password, updated_at)
SELECT gen_random_uuid()::text, new_user.id, 'credential', new_user.id,
  crypt(params.password, gen_salt('bf', 12)), now()
FROM new_user, params;
