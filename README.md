# TEV — Travel Expenses

A personal web app to track travel expenses in multiple currencies, replacing a spreadsheet.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS with [shadcn/ui](https://ui.shadcn.com) components (`new-york` style, Radix), themes with [next-themes](https://github.com/pacocoursey/next-themes) (system, light, dark)
- [next-intl](https://next-intl.dev) for translations (French by default, English)
- PostgreSQL ([Neon](https://neon.tech) in production) with [Drizzle ORM](https://orm.drizzle.team)
- [Better Auth](https://www.better-auth.com): email + password, no public sign-up
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

## Accounts and database

There is no sign-up page: accounts are created with `pnpm user:create`, which prompts for the
password (at least 12 characters) without echoing it. `pnpm user:password` is the way back in if a
password is forgotten. Sign-in attempts are limited to 5 per minute per IP address.

Schema changes go through migrations: edit `src/db/schema`, run `pnpm db:generate`, commit the SQL
file in `drizzle/`. Integration tests (`*.int.test.ts`) run against the database in `DATABASE_URL`
and clean up after themselves; CI runs them against its own PostgreSQL service.

### Production (Vercel + Neon)

- The Neon integration provides `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Set `BETTER_AUTH_SECRET`
  yourself in the project settings, for Production and Preview.
- Vercel runs `vercel-build`, which applies the migrations before building. Each preview deployment
  gets its own Neon branch, so previews never touch production data.
- Neon's free plan allows 10 branches per project: delete old preview branches in the Neon console
  if a preview deployment fails to create one.
- To create your account (or reset a password) in production without a local machine, use the
  **Manage user** workflow:
  1. In _Settings → Secrets and variables → Actions_, add `PROD_DATABASE_URL` (Neon's
     `DATABASE_URL_UNPOOLED` for production) and `TEV_USER_PASSWORD` (the password to set).
  2. In _Actions → Manage user → Run workflow_, pick `create` (email + name) or `password` (email).
  3. Delete the `TEV_USER_PASSWORD` secret once the run succeeded.

  From a machine with the repository, the scripts work too (environment variables take precedence
  over `.env.local`):

  ```bash
  DATABASE_URL="<production DATABASE_URL_UNPOOLED>" pnpm user:create you@example.com "Your Name"
  ```

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
