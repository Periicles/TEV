-- Sets a new password for an account and signs it out of every device.
-- Edit the two values in `params`, then run the whole statement (Neon console → SQL Editor).
-- The password must be 12 to 72 characters long.
WITH params AS (
  SELECT
    'you@example.com'::text AS email,
    'change-me-please'::text AS password
),
updated AS (
  UPDATE account
  SET password = crypt(params.password, gen_salt('bf', 12)), updated_at = now()
  FROM "user", params
  WHERE account.user_id = "user".id
    AND account.provider_id = 'credential'
    AND "user".email = lower(trim(params.email))
  RETURNING account.user_id
)
DELETE FROM session
WHERE user_id IN (SELECT user_id FROM updated);
