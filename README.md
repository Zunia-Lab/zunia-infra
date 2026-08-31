# zunia-infra

> Infrastructure-as-code for **platform hosting** that is not owned by a single app repo.

## Role

| Owns | Does not own |
|------|----------------|
| Always-on workers (tx realtime / indexer WS) on Fly/Railway/Render | Vercel project wiring for website/docs/dashboard (app repos + `vercel.json`) |
| Shared DNS records for `api.`, `link.`, `status.` | Chain-registry deploy stack (`zunia-chain-registry/pulumi`) |
| Secrets layout docs, monitoring stubs | Application business logic |

**Tooling:** **Pulumi only** for this repo. Do not add a parallel Terraform tree — DNS/Cloudflare can be Pulumi providers. Registry keeps its own Pulumi project.

## Layout

```
pulumi/     App workers, DNS helpers, monitoring stubs
docs/       Hosting ADRs / pointers
```

## Related ADRs

- Indexer realtime worker must run on a **container host** (not Vercel serverless) — see `zunia-indexer/docs/adr/0003-realtime-worker-host.md`.

## License

Apache-2.0.
