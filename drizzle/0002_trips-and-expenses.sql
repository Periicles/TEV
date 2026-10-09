CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text,
	"name" text,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_key_or_name" CHECK (("category"."key" IS NULL) <> ("category"."name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"date" date NOT NULL,
	"label" text NOT NULL,
	"category_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"base_amount_minor" bigint NOT NULL,
	"exchange_rate" numeric(20, 10) NOT NULL,
	"rate_source" text NOT NULL,
	"payment_method" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount_minor" > 0),
	CONSTRAINT "expense_base_amount_positive" CHECK ("expense"."base_amount_minor" > 0),
	CONSTRAINT "expense_rate_positive" CHECK ("expense"."exchange_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_participant" (
	"expense_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "expense_participant_expense_id_participant_id_pk" PRIMARY KEY("expense_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"base_currency" char(3) DEFAULT 'EUR' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_key_idx" ON "category" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "expense_trip_date_idx" ON "expense" USING btree ("trip_id","date");--> statement-breakpoint
CREATE INDEX "expense_participant_participant_idx" ON "expense_participant" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "participant_trip_idx" ON "participant" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_user_id_idx" ON "trip" USING btree ("user_id");