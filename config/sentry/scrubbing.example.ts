# Sentry scrubbing deny-list (example)

Copy into each app's Sentry init (`beforeSend` / `denyUrls` / `allowUrls`). **Never** ship real production DSNs in examples.

```ts
/** Example deny-list for Zunia clients — extend per surface. */
export const SENTRY_DENY_PATTERNS: RegExp[] = [
  /\b(mnemonic|seed\s*phrase|recovery\s*phrase)\b/i,
  /\b(private[_\s-]?key|privkey|spending[_\s-]?key)\b/i,
  /\b(cosmos|osmo|akash|noble|safro)1[a-z0-9]{38,}\b/i, // optional: redact full addresses in breadcrumbs
  /\b(xprv|xpub|tprv|tpub)[a-zA-Z0-9]+\b/,
  /\bBEGIN (EC |OPENSSH |PRIVATE )KEY\b/,
  /\b(password|passcode|pin)\s*[:=]\s*\S+/i,
  /\b(Authorization|x-api-key)\s*[:=]\s*\S+/i,
  /\bVAPID_PRIVATE_KEY\b/,
  /\bwc:[a-z0-9]+@\d+/i, // WalletConnect URIs may embed secrets
];

export function scrubText(input: string): string {
  let out = input;
  for (const re of SENTRY_DENY_PATTERNS) {
    out = out.replace(re, "[redacted]");
  }
  return out;
}

export function sentryBeforeSend(event: {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: { values?: Array<{ message?: string; data?: Record<string, unknown> }> };
}) {
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  for (const b of event.breadcrumbs?.values ?? []) {
    if (b.message) b.message = scrubText(b.message);
  }
  return event;
}
```

Also configure Sentry project **Data Scrubber** + proprietary fields: `mnemonic`, `seed`, `privateKey`, `password`, `pin`, `apiKey`.
