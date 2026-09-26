# zunia-infra

> Infrastructure-as-code for **platform hosting** that is not owned by a single app repo.

## Role

| Owns | Does not own |
|------|----------------|
| Always-on workers on the Hetzner host (nginx + systemd). See [docs/hetzner.md](./docs/hetzner.md). | Vercel is not the production target for zunialab.com |
| Shared DNS records for `api.`, `link.`, `status.` | Chain-registry deploy stack (`zunia-chain-registry/pulumi`) |
| Secrets layout docs, monitoring stubs | Application business logic |

**Production** is nginx and systemd on the Hetzner host. Snippets are in `deploy/`. Pulumi in this repo is still a stub.

## Layout

```
deploy/              nginx vhosts and systemd units for the Hetzner host
pulumi/              App workers, DNS helpers, monitoring stubs
docs/                Hosting ADRs, security, audit, launch, Hetzner runbook
config/sentry/       Scrubbing deny-list examples
provisioning/        Env / secret checklists
```

## Security stubs

- [docs/security/key-management.md](./docs/security/key-management.md)
- [docs/security/threat-model.md](./docs/security/threat-model.md)
- [config/sentry/scrubbing.example.ts](./config/sentry/scrubbing.example.ts)
- [docs/audit/README.md](./docs/audit/README.md) — no completed audits claimed
- [docs/launch/runbook.md](./docs/launch/runbook.md)

## Deploy credentials

`.env.deploy.example` is the tracked template listing every credential needed to
deploy any Zunia surface: Cloudflare, Vercel, Pulumi, Fly/Railway/Render, SSH
targets, databases, push, auth, email, observability, app stores, and secret
managers.

```bash
cp .env.deploy.example .env.deploy && chmod 600 .env.deploy
set -a && . ./.env.deploy && set +a
```

`.env.deploy` is git-ignored and must never be committed. The template is the
source of truth for *names*; real values live in `.env.deploy` locally and in the
platform secret store (GitHub Actions secrets, Vercel env, Pulumi config,
1Password/Doppler). When you add a variable, add it to the template too, empty.

## Related ADRs

- Indexer realtime worker must run on a **container host** (not Vercel serverless) — see `zunia-indexer/docs/adr/0003-realtime-worker-host.md`.

## License

Apache-2.0.
