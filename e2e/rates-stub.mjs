// A stand-in for the Frankfurter API, so end-to-end tests get the same rates every day.
import { createServer } from "node:http";

const RATES = { "EUR/JPY": 160, "EUR/USD": 1.08 };
const port = Number(process.env.RATES_STUB_PORT ?? 3999);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const match = url.pathname.match(/^\/v2\/rate\/([A-Z]{3})\/([A-Z]{3})$/);
  const rate = match ? RATES[`${match[1]}/${match[2]}`] : undefined;
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/health") return response.end("{}");
  if (!match || rate === undefined) {
    response.statusCode = 404;
    return response.end(JSON.stringify({ message: "not found" }));
  }
  response.end(
    JSON.stringify({ date: url.searchParams.get("date"), base: match[1], quote: match[2], rate }),
  );
}).listen(port);
