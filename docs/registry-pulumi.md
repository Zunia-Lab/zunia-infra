# Reuse chain-registry Pulumi?

`zunia-chain-registry` already contains `pulumi/` for registry hosting.

**Proposal:** keep registry deploy in that repo; use `zunia-infra` for API workers, push, DNS modules for `api.` / `link.` / `status.`, and shared monitoring. Avoid one mega-stack until Phase 3.
