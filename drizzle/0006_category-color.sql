ALTER TABLE "category" ADD COLUMN "color" integer;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_color_range" CHECK ("category"."color" BETWEEN 1 AND 8);