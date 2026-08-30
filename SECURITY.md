# Security Policy

FootGlobe uses server-side integrations for football data, video search and donation providers. Secrets must never be exposed in client code, commits, issues or screenshots.

## Reporting a vulnerability

Please avoid publishing exploit details in a public issue.

If GitHub private vulnerability reporting is enabled for the repository, use the **Security** tab to report the issue privately. Otherwise, open a minimal issue stating that you need a private contact channel, without including credentials, payloads or exploitation steps.

## Secrets

Never commit any of the following:

- `.env` or `.env.local`;
- API keys or API secrets;
- payment provider credentials;
- access tokens;
- private keys;
- production-only identifiers that are meant to remain secret.

Only `.env.example` should contain configuration names, with secret values left empty.
