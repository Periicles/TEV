import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { exchangeRate } from "@/db/schema";
import { officialRate } from "./exchange-rates";

// A past date unique to this run, so cached rows of other runs never interfere.
const day = `19${String(10 + Math.floor(Math.random() * 89))}-0${1 + Math.floor(Math.random() * 9)}-15`;
const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EXCHANGE_RATES_URL", "https://rates.test/v2");
  fetchMock.mockReset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (process.env.DATABASE_URL) {
    await db.delete(exchangeRate).where(eq(exchangeRate.requestedDate, day));
  }
});

describe.skipIf(!process.env.DATABASE_URL)("officialRate", () => {
  it("fetches a rate once, then serves it from the database", async () => {
    fetchMock.mockImplementation(() =>
      respond(200, { date: day, base: "EUR", quote: "JPY", rate: 161.56 }),
    );

    expect(await officialRate("EUR", "JPY", day)).toEqual({ rate: 161.56, date: day });
    expect(await officialRate("EUR", "JPY", day)).toEqual({ rate: 161.56, date: day });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://rates.test/v2/rate/EUR/JPY?date=${day}`,
    );
  });

  it("keeps the publication date when it differs from the date asked for", async () => {
    fetchMock.mockImplementation(() =>
      respond(200, { date: "1900-01-12", base: "EUR", quote: "USD", rate: 1.08 }),
    );
    expect(await officialRate("EUR", "USD", day)).toEqual({ rate: 1.08, date: "1900-01-12" });
    const [row] = await db
      .select()
      .from(exchangeRate)
      .where(and(eq(exchangeRate.requestedDate, day), eq(exchangeRate.quote, "USD")));
    expect(row.rateDate).toBe("1900-01-12");
  });

  it("returns null for an unknown pair, a server error or an unreachable server", async () => {
    fetchMock.mockImplementationOnce(() => respond(404, { message: "not found" }));
    expect(await officialRate("EUR", "VND", day)).toBeNull();

    fetchMock.mockImplementationOnce(() => respond(503, { message: "down" }));
    expect(await officialRate("EUR", "THB", day)).toBeNull();

    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("fetch failed")));
    expect(await officialRate("EUR", "GBP", day)).toBeNull();

    fetchMock.mockImplementationOnce(() => respond(200, { unexpected: true }));
    expect(await officialRate("EUR", "CHF", day)).toBeNull();

    // A response for another pair is not trusted.
    fetchMock.mockImplementationOnce(() =>
      respond(200, { date: day, base: "EUR", quote: "USD", rate: 1.08 }),
    );
    expect(await officialRate("EUR", "CAD", day)).toBeNull();
  });

  it("does not cache today's rate, which may still change", async () => {
    const today = new Date().toISOString().slice(0, 10);
    fetchMock.mockImplementation(() =>
      respond(200, { date: today, base: "EUR", quote: "SEK", rate: 11.2 }),
    );
    await officialRate("EUR", "SEK", today);
    await officialRate("EUR", "SEK", today);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("needs no request for the same currency or invalid input", async () => {
    expect(await officialRate("EUR", "EUR", day)).toEqual({ rate: 1, date: day });
    expect(await officialRate("EUR", "XYZ", day)).toBeNull();
    expect(await officialRate("EUR", "JPY", "not-a-date")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can be switched off", async () => {
    vi.stubEnv("EXCHANGE_RATES_URL", "off");
    expect(await officialRate("EUR", "NOK", day)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
