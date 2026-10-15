ALTER TABLE "participant" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_user_idx" ON "participant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_trip_user_idx" ON "participant" USING btree ("trip_id","user_id");--> statement-breakpoint
-- Members become participants with an account: linked to the trip's first participant with their
-- name and no account yet, else added at the end of the list (without any share of past expenses).
UPDATE "participant" AS p SET "user_id" = m."user_id"
FROM "trip_member" AS m
JOIN "user" AS u ON u."id" = m."user_id"
WHERE p."id" = (
  SELECT p2."id" FROM "participant" AS p2
  WHERE p2."trip_id" = m."trip_id" AND p2."user_id" IS NULL AND lower(p2."name") = lower(u."name")
  ORDER BY p2."position"
  LIMIT 1
);--> statement-breakpoint
INSERT INTO "participant" ("trip_id", "name", "position", "user_id")
SELECT m."trip_id", u."name",
  (SELECT coalesce(max(p."position"), -1) FROM "participant" AS p WHERE p."trip_id" = m."trip_id")
    + row_number() OVER (PARTITION BY m."trip_id" ORDER BY m."created_at"),
  m."user_id"
FROM "trip_member" AS m
JOIN "user" AS u ON u."id" = m."user_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "participant" AS p WHERE p."trip_id" = m."trip_id" AND p."user_id" = m."user_id"
);--> statement-breakpoint
DROP TABLE "trip_member" CASCADE;
