# Contributing

All code, documentation, commit messages and pull requests are written in **English**.
The app UI defaults to French and is translatable.

## Branches

`main` is the default and only long-lived branch. Nobody pushes to it directly: every change goes through a pull request
from a short-lived work branch created from `main`.

Work branches are named `<type>/<short-description>` in lowercase kebab-case, e.g. `feature/multi-currency`,
`fix/total-rounding`. Allowed types: `feature`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`, `style`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>)!: <description>

<optional body>

<optional footer(s)>
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Description in the imperative mood, lowercase, no trailing period: `feat(expenses): add category filter`.
- Breaking changes use `!` after the type/scope and/or a `BREAKING CHANGE:` footer.
- Header is at most 100 characters.

Pull requests are **merged with a merge commit — never squashed** — so every commit lands in history as is.
Keep each commit meaningful and clean; tidy up your own branch with an interactive rebase before asking for review
(`git rebase -i main`), and rebase on `main` when you need its latest changes.
Never rewrite history on `main`.

## Pull requests

- Title follows the same Conventional Commits format as commits.
- Target `main`.
- Fill in the pull request template.
- CI must be green before merging.

The **PR checks** workflow enforces the target branch, branch names, PR title and every commit message.
