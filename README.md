# zunia-infra

> Infrastructure as code for Zunia backend, DNS helpers, secrets layout, and monitoring.

**Status:** scaffold. Chain registry already has a `pulumi/` directory — decide reuse vs this repo (ADR below).

## Layout

```
pulumi/       Preferred for Vercel-adjacent / multi-cloud workers
terraform/    Optional DNS / Cloudflare modules
docs/         Runbooks pointers → zunia-security
```

## Domains (from DEPLOY.md + deep links)

| Host | Purpose |
|------|---------|
| `zuniawallet.com` | Marketing |
| `docs.zuniawallet.com` | Docs |
| `wallet.zuniawallet.com` | Dashboard |
| `api.zuniawallet.com` | Backend |
| `link.zuniawallet.com` | Universal / App Links |
| `status.zuniawallet.com` | Status page |

## Secrets

Never commit. Use Vercel env / 1Password / Doppler. Template names live in each app's `.env.example`.

## License

Apache-2.0.
