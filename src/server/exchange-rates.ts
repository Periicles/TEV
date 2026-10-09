import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { exchangeRate } from "@/db/schema";
import { isCurrency } from "@/lib/money";

/**
 * Official exchange rates from Frankfurter (https://frankfurter.dev), which blends the daily rates
 * published by central banks. `EXCHANGE_RATES_URL` points to another server (tests) or, set to
 * `off`, disables fetching: the form then falls back to rates typed by hand.
 */
const DEFAULT_URL = "https://api.frankfurter.dev/v2";
const TIMEOUT_MS = 4000;

export interface OfficialRate {
  /** Units of `quote` for one unit of `base`, as stored on expenses. */
  rate: number;
  /** Date the rate was published for; earlier than the date asked for on weekends and holidays. */
  date: string;
}

const responseSchema = z.object({
  date: z.iso.date(),
  base: z.string(),
  quote: z.string(),
  rate: z.number().positive().finite(),
});

const isoDate = z.iso.date();

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The official rate between two currencies on a date, or `null` when there is none (unknown pair,
 * future date) or the rates server cannot be reached. Never throws: rates are a convenience.
 */
export async function officialRate(
  base: string,
  quote: string,
  date: string,
): Promise<OfficialRate | null> {
  if (!isCurrency(base) || !isCurrency(quote) || !isoDate.safeParse(date).success) return null;
  if (base === quote) return { rate: 1, date };

  const [cached] = await db
    .select()
    .from(exchangeRate)
    .where(
      and(
        eq(exchangeRate.requestedDate, date),
        eq(exchangeRate.base, base),
        eq(exchangeRate.quote, quote),
      ),
    );
  if (cached) return { rate: Number(cached.rate), date: cached.rateDate };

  const url = process.env.EXCHANGE_RATES_URL ?? DEFAULT_URL;
  if (url === "off") return null;

  let fetched: OfficialRate;
  try {
    const response = await fetch(`${url}/rate/${base}/${quote}?date=${date}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = responseSchema.parse(await response.json());
    if (body.base !== base || body.quote !== quote) return null;
    fetched = { rate: body.rate, date: body.date };
  } catch (error) {
    console.warn(`Exchange rate ${base}/${quote} on ${date} unavailable:`, error);
    return null;
  }

  // Today's rate may still be published or revised: only past dates are final.
  if (date < todayUtc()) {
    await db
      .insert(exchangeRate)
      .values({
        requestedDate: date,
        base,
        quote,
        rate: String(fetched.rate),
        rateDate: fetched.date,
      })
      .onConflictDoNothing();
  }
  return fetched;
}
