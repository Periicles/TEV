# TEV — Travel Expenses

A personal web app to track travel expenses in multiple currencies, replacing a spreadsheet.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS with [shadcn/ui](https://ui.shadcn.com) components (`new-york` style, Radix), themes with [next-themes](https://github.com/pacocoursey/next-themes) (system, light, dark)
- [next-intl](https://next-intl.dev) for translations (French by default, English)
- PostgreSQL ([Neon](https://neon.tech) in production) with [Drizzle ORM](https://orm.drizzle.team)
- [Better Auth](https://www.better-auth.com): email + password login, accounts created in SQL
- Hosted on [Vercel](https://vercel.com)

## Getting started

Requirements: Node.js 24+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:migrate              # needs a local PostgreSQL, see DATABASE_URL in .env.local
pnpm user:create you@example.com "Your Name"
pnpm dev
```

Then open http://localhost:3000 and sign in.

## Scripts

| Command                           | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                        | Start the development server                            |
| `pnpm build`                      | Production build                                        |
| `pnpm lint`                       | Lint with ESLint                                        |
| `pnpm typecheck`                  | Generate route types and run tsc                        |
| `pnpm test`                       | Unit and integration tests (Vitest)                     |
| `pnpm test:e2e`                   | End-to-end tests (Playwright, on the production build)  |
| `pnpm format`                     | Format with Prettier                                    |
| `pnpm format:check`               | Check formatting                                        |
| `pnpm db:generate`                | Generate a migration from the schema in `src/db/schema` |
| `pnpm db:migrate`                 | Apply pending migrations                                |
| `pnpm db:studio`                  | Browse the database                                     |
| `pnpm user:create <email> <name>` | Create an account (password prompted)                   |
| `pnpm user:password <email>`      | Change a password and sign the user out everywhere      |

## Tests

- **Unit** (`*.test.ts`, Vitest): pure logic such as locale resolution and translation catalogs.
- **Integration** (`*.int.test.ts`, Vitest): code that talks to PostgreSQL, against `DATABASE_URL`.
- **End-to-end** (`e2e/`, Playwright): real user flows on the production build (`pnpm build` first),
  on a mobile and a desktop viewport. They sign in with a dedicated `e2e@test.local` account that
  the setup creates through `scripts/user.ts`.

CI runs all three on every pull request.

## Trips and expenses

- A trip has a **base currency** (EUR by default) and **participants**. Each expense is split evenly
  between the participants it is shared with (all of them by default). A rounding cent goes to
  whoever has received the fewest so far, so shares always add up to the total and nobody pays more
  than a cent of rounding over another on a trip.
- **Who paid** is optional, per trip, and off by default: expenses are then simply shared. With
  _Track who paid_ on, each expense records its payer (by default whoever paid last, else the first
  participant) and the trip page turns what everyone paid minus their share into the few transfers
  that settle the trip ("Léa owes Paul 412,30 €"). Expenses without a payer are shared but left out
  of these balances. Turning tracking off hides payers without deleting them.
- Amounts are stored as **integers in the currency's minor unit** (cents for EUR, yen for JPY,
  thousandths for KWD), never as floating-point numbers.
- An expense keeps its original amount and currency, plus its amount in the base currency and the
  **exchange rate used** (`1 EUR = 161.56 JPY`), fixed when it is saved.
- **Official rates** come from [Frankfurter](https://frankfurter.dev), which blends the daily rates
  of central banks: the expense form fills in the rate for the expense's date (a weekend gets the
  last published rate) unless a rate was typed by hand, which can always be done and is kept. When
  saving, the server fetches the official rate itself instead of trusting the browser. Past rates
  are cached in the `exchange_rate` table; a currency without official rate falls back to the last
  rate typed in the trip. `EXCHANGE_RATES_URL` overrides the API (end-to-end tests use a stub with
  fixed rates) and `EXCHANGE_RATES_URL=off` disables it.
- **Categories** are shared by all of a user's trips and managed on `/categories` (from the
  preferences menu): add, rename (a renamed built-in category stops being translated), reorder,
  delete (expenses become uncategorized; the last category stays) and pick one of the eight neon
  palette colors. A category without a chosen color follows its position in the palette; moving one
  pins the colors so charts never repaint.
- Every query is scoped to the signed-in user (`src/server/trips.ts`); someone else's trip behaves
  as if it did not exist.
- Next.js keeps visited pages in the DOM (hidden): form field ids derive from the record they edit,
  and end-to-end tests look fields up inside the visible `<main>`.

## Spreadsheet import

`/trips/import` creates a trip from an `.xlsx` file, one row per expense. The file is read in the
browser ([read-excel-file](https://www.npmjs.com/package/read-excel-file)) and converted by
`src/lib/spreadsheet.ts`, so nothing is sent before the preview is confirmed:

- Columns are guessed from their titles (French or English: _Date_, _Libellé_/_Expense_,
  _Montant_/_Total cost_, _Catégorie_, _Notes_); an untitled column repeating a few values is taken
  as the category. Every guess can be changed.
- A _per person_ column gives the number of travellers (amount ÷ share). Each imported expense is
  split between all of them.
- Dates can be real dates, Excel serial numbers or text in the device's order (`20/03/2025`). Rows
  without one (`-`) get a date chosen in the form, the latest date of the file by default.
- Rows without a label or a positive amount, such as a totals row, are listed and skipped.
- Spreadsheet categories are matched to existing ones by name or meaning (_Logement_ → lodging);
  the others are created, unless mapped by hand.
- Amounts are in the trip's base currency. The server saves the trip and all its expenses in one
  transaction (`src/server/import.ts`).

`e2e/fixtures/budget.xlsx` is a small fictional file with the same layout as the original
spreadsheet (formulas, `-` dates, a totals row, a side table); unit and end-to-end tests use it.

## Accounts and database

The app only has a login page: there is no sign-up. Accounts are created by the owner, directly in
the database. Passwords are hashed with bcrypt, which PostgreSQL can compute itself (`pgcrypto`,
enabled by a migration), so no tool is needed besides an SQL editor:

- **Create an account**: run [`docs/sql/create-account.sql`](docs/sql/create-account.sql) after
  editing the email, name and password at its top.
- **Reset a password** (also signs the account out everywhere): run
  [`docs/sql/reset-password.sql`](docs/sql/reset-password.sql).

Passwords must be 12 to 72 characters long. Sign-in attempts are limited to 5 per minute per IP
address. These two files are executed as-is by the integration tests, so they stay correct.

From a machine with the repository, `pnpm user:create` and `pnpm user:password` do the same with a
hidden password prompt.

Schema changes go through migrations: edit `src/db/schema`, run `pnpm db:generate`, commit the SQL
file in `drizzle/`. Integration tests (`*.int.test.ts`) run against the database in `DATABASE_URL`
and clean up after themselves; CI runs them against its own PostgreSQL service.

### Production (Vercel + Neon)

- The Neon integration provides `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Set `BETTER_AUTH_SECRET`
  yourself in the project settings, for Production and Preview.
- Vercel runs `vercel-build`, which applies the migrations before building. Each preview deployment
  gets its own Neon branch, so previews never touch production data.
- Neon's free plan allows 10 branches per project and the integration never deletes the ones it
  creates. The `Neon preview cleanup` workflow deletes `preview/<branch>` when its pull request is
  merged or closed, with the `NEON_API_KEY` repository secret (a Neon API key). Branches left over
  from before can be deleted in the Neon console (_Branches_); never delete `main`.
- To create your account in production, open the Neon console (Vercel → Storage → tev-db →
  _Open in Neon_), pick the production branch in the **SQL Editor** and run
  [`docs/sql/create-account.sql`](docs/sql/create-account.sql). The query, password included, may be
  kept in the editor's history: delete it from there afterwards.

## UI components

Components from shadcn/ui live in `src/components/ui` and are owned by this repo: edit them freely.
Add a new one with `pnpm dlx shadcn@latest add <component>` (configuration in `components.json`).

## Internationalization

UI strings live in `messages/<language>.json`; French (`fr.json`) is the reference catalog and a test
checks that every catalog has the same keys. Never hard-code user-facing text.

The language is resolved per request: the user's explicit choice (cookie), then the device languages
(`Accept-Language`), then French. Dates and numbers use the device locale and time zone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.
