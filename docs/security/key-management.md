# Key management

**Status:** Engineering stub — expand before production key ceremonies.

## Principles

1. **User keys never on Zunia servers.** Seed / mnemonic / private keys stay in extension WASM worker, mobile secure storage, or hardware. Dashboard is watch-only / WC / extension bridge only.
2. **Platform secrets** (VAPID, WC project secret if any, DB URLs, API keys) live in deploy secret stores (Fly/Railway/Vercel), never in git.
3. **Release signing** (Apple, Google Play, npm provenance, git tags) uses hardware-backed or CI OIDC where possible; dual control for store credentials.

## Secret inventory (draft)

| Secret | Owner system | Rotation |
|--------|--------------|----------|
| `INDEXER_API_KEY` | indexer + dashboard server | 90d |
| `DATABASE_URL` | indexer / backend | on compromise |
| VAPID keypair | backend + dashboard public | on compromise |
| WalletConnect project | extension / mobile / dashboard | WC dashboard |
| npm publish token / OIDC | core + ui releases | prefer OIDC |
| Apple / Google signing | mobile CI | org policy |

## Forbidden

- Mnemonics in logs, Sentry, analytics, support tickets
- Private keys in browser `localStorage` / cookies
- Committing `.env.deploy` or production WC secrets

See also [threat model](./threat-model.md) and Sentry scrubbing config example.
