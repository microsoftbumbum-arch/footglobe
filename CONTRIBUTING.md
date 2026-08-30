# Contributing to FootGlobe

Thanks for helping improve FootGlobe.

## Before opening a pull request

1. Fork the repository and create a focused branch.
2. Keep changes scoped to one bug, feature, or cleanup.
3. Do not commit `.env` files, API keys, tokens, credentials or user data.
4. Run the repository checks when possible:

```bash
npm ci
npm run lint
npm test
```

5. Update documentation when behavior, configuration or public APIs change.

## Branch naming

Examples:

```text
feat/retro-improvements
fix/globe-mobile-rotation
fix/match-details
chore/dependency-update
```

## Commit messages

Short, descriptive commits are preferred:

```text
feat: improve retro goal center
fix: prevent duplicate broadcast channels
chore: update dependencies
```

## Pull requests

A good pull request should explain:

- what changed;
- why the change was needed;
- how it was tested;
- screenshots or recordings for visible UI changes.

Please avoid unrelated formatting or refactors in the same pull request.
