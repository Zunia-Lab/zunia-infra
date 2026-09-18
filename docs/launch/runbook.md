# Launch runbook (draft)

Gates before public testnet / store submission. Check items only when evidence exists.

## Testnet gates

- [ ] `zunia-core` tagged release with `SHA256SUMS` verified
- [ ] Extension connects to testnet, signs bank send, IBC stub path reviewed
- [ ] Mobile unlock + send on testnet
- [ ] Dashboard watch-only + extension bridge against indexer
- [ ] Device binding (ADR-36) challenge/verify against backend
- [ ] Push: Web Push on Chromium PWA; iOS only after Home Screen install
- [ ] Indexer WS reconnect / failover smoke + `/health` load-test
- [ ] Sentry scrubbing deny-list enabled; no mnemonic in sample events
- [ ] Threat model reviewed by eng lead; open criticals documented

## Store submission checklist

- [ ] Privacy Policy + ToS published (not DRAFT) or store-allowed beta disclosures
- [ ] App Store encryption / export questionnaire completed ([checklist](https://github.com/Zunia-Lab/zunia-docs/blob/main/docs/legal/app-store-encryption.md))
- [ ] Play Data safety form matches privacy doc
- [ ] Screenshots / copy do **not** claim completed audits
- [ ] Support email + crash contact live
- [ ] Rollback: previous store build retained; feature flags for WC / push

## Explicit non-claims

- Do not announce "audited" until [docs/audit](../audit/README.md) has a dated report.
- Do not claim reproducible extension builds until public instructions pass an external rebuild.
