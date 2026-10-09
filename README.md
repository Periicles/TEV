# TEV — Travel Expenses

A personal web app to track travel expenses in multiple currencies, replacing a spreadsheet.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS
- PostgreSQL ([Neon](https://neon.tech)) with [Drizzle ORM](https://orm.drizzle.team) — _coming soon_
- [Better Auth](https://www.better-auth.com) (email + password, no public sign-up) — _coming soon_
- Hosted on [Vercel](https://vercel.com)

## Getting started

Requirements: Node.js 22+ and pnpm (`corepack enable`).

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.
