CREATE TABLE "exchange_rate" (
	"requested_date" date NOT NULL,
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"rate_date" date NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rate_requested_date_base_quote_pk" PRIMARY KEY("requested_date","base","quote")
);
