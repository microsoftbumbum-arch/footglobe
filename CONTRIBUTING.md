# Contributing to FootGlobe

Thanks for helping improve FootGlobe.

## Before you start

1. Open an issue for large changes so the direction can be discussed first.
2. Never commit `.env`, access tokens, API keys, webhook URLs or private credentials.
3. Keep changes focused. Avoid unrelated formatting or dependency churn.
4. Preserve mobile behavior, internationalization and both light/dark themes.

## Development

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build
npm test
```

Some integrations require environment variables and external services. Use `.env.example` as the reference and keep real values local.

## Pull requests

A good PR should include:

- a concise summary of the change;
- why the change is needed;
- screenshots for meaningful visual changes;
- notes about mobile behavior when UI was touched;
- tests or a clear manual verification path for logic changes;
- no generated caches, build output or local environment files.

## Project conventions

- TypeScript for application code.
- Reuse existing FootGlobe components and visual tokens before creating new patterns.
- Keep secrets server-side.
- Use locale keys for user-facing text that belongs in the translated product surface.
- Treat the 3D globe as a performance-sensitive component.
- Preserve public profile URL compatibility and reserved-route protections.

## Commit messages

Prefer short conventional-style messages, for example:

```text
feat: add profile achievement section
fix: sync shop reset to UTC
chore: refresh project docs
```
