-- Lets accounts be created and passwords reset in plain SQL with bcrypt hashes:
-- crypt('the password', gen_salt('bf', 12)). See README, "Managing accounts in SQL".
CREATE EXTENSION IF NOT EXISTS pgcrypto;
