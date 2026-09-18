# Threat model (infra + platform expansion)

Companion to [zunia-security/threat-model](https://github.com/Zunia-Lab/zunia-security/blob/main/threat-model/README.md).

**Status:** Draft expansion — not a completed audit.

## Trust boundaries

```
[User device: extension / mobile]
        |  signed txs / ADR-36
        v
[RPC / LCD nodes]  <— poisoned node risk
        ^
        |  server-side only
[Indexer / Backend] — push tokens, address-scoped history
        ^
[Dashboard Next.js] — browser never talks to chain RPC directly
```

## Additional threats

| ID | Threat | Impact | Mitigation (planned) |
|----|--------|--------|----------------------|
| T1 | Dashboard XSS steals session | Push/session abuse | CSP, no keys in browser, short-lived tokens |
| T2 | Compromised indexer API key | History scrape / subscribe spam | Key rotation, rate limits, address auth via binding |
| T3 | Malicious service worker | Phishing notifications | Scoped SW, HTTPS only, user permission |
| T4 | Supply-chain npm/cargo | Malicious signing code | Lockfiles, CodeQL, gitleaks, provenance, reproducible builds |
| T5 | Log leakage of mnemonic | Total loss | Sentry deny-list, CI tests for scrubbers |
| T6 | Stale WC relay metadata | Address confusion | Verified peer metadata, explicit chain namespaces |
| T7 | Registry CDN poison | Wrong fees / chain IDs | Checksums, signed registry releases |

## Out of scope (for this doc)

- Full formal STRIDE per component (track in `zunia-security`)
- Completed third-party audit findings (see `docs/audit/`)
