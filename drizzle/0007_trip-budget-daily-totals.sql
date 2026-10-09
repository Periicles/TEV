ALTER TABLE "trip" ADD COLUMN "budget_minor" bigint;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "show_daily_totals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_budget_positive" CHECK ("trip"."budget_minor" > 0);