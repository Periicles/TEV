# TEV — Travel Expenses

A personal web app to track travel expenses in multiple currencies, replacing a spreadsheet.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS, themes with [next-themes](https://github.com/pacocoursey/next-themes) (system, light, dark)
- [next-intl](https://next-intl.dev) for translations (French by default, English)
- PostgreSQL ([Neon](https://neon.tech)) with [Drizzle ORM](https://orm.drizzle.team) — _coming soon_
- [Better Auth](https://www.better-auth.com) (email + password, no public sign-up) — _coming soon_
- Hosted on [Vercel](https://vercel.com)

## Getting started

Requirements: Node.js 24+ and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000.

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start the development server     |
| `pnpm build`        | Production build                 |
| `pnpm lint`         | Lint with ESLint                 |
| `pnpm typecheck`    | Generate route types and run tsc |
| `pnpm test`         | Run unit tests with Vitest       |
| `pnpm format`       | Format with Prettier             |
| `pnpm format:check` | Check formatting                 |

## Internationalization

UI strings live in `messages/<language>.json`; French (`fr.json`) is the reference catalog and a test
checks that every catalog has the same keys. Never hard-code user-facing text.

The language is resolved per request: the user's explicit choice (cookie), then the device languages
(`Accept-Language`), then French. Dates and numbers use the device locale and time zone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.
