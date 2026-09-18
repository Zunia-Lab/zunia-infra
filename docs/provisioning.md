# Provisioning runbook

Every external account, identity and DNS record Zunia needs, in the order that respects lead
times. Items marked **BLOCKING** gate a later phase of
`PRE-DEVELOPMENT.md` and the build plan, so start them on day one even though the code that
needs them is weeks away.

Track state in [../provisioning/status.yaml](../provisioning/status.yaml). CI reads that file
and fails the release workflow if a blocking item is still `pending` when a store submission
is attempted.

Secrets go into the secret manager, then into `zunia-infra/.env.deploy` locally (git ignored)
and GitHub Actions secrets for CI. Never commit a value.

---

## 1. Legal entity first

Nothing else can complete without it. Apple and Google both require an organisation for a
crypto wallet app, and store review will ask who the publisher is.

1. Incorporate the entity and record the jurisdiction.
2. Obtain the company registration number, and for Apple the D-U-N-S number. **A D-U-N-S
   request alone can take 5 to 30 business days.**
3. Open the business bank account used for the developer programmes.

Owner: founder. Lead time: weeks. **BLOCKING** for store submissions.

---

## 2. Domain, DNS and email

Follow [../../DEPLOY.md](../../DEPLOY.md) for the record values. Hosts required:

- `zunialab.com` and `www`, website
- `docs.zunialab.com`, docs
- `wallet.zunialab.com`, dashboard
- `api.zunialab.com`, backend
- `link.zunialab.com`, universal and app links
- `status.zunialab.com`, status page

Email addresses, all required before store submission because the listings ask for a support
contact and the security policy publishes a disclosure address:

- `hello@`, `security@`, `dev@`, `press@`

Set SPF and DKIM immediately. Start DMARC at `p=none` with reporting, review the aggregate
reports for two weeks, then move to `p=quarantine` and finally `p=reject`.

Generate the PGP key for `security@` and publish the fingerprint in
`zunia-website/public/.well-known/security.txt`, which currently has a placeholder.

```bash
gpg --quick-generate-key "Zunia Security <security@zunialab.com>" ed25519 sign 2y
gpg --armor --export security@zunialab.com > zunia-security-pgp.asc
```

Owner: infra. Lead time: days. **BLOCKING** for `security.txt` and store listings.

---

## 3. GitHub organisation

1. Verify `zunialab.com` under organisation settings, verified domains.
2. Require two-factor authentication for all members, hardware keys for anyone with publish
   or release rights.
3. Branch protection on `main` in every repository: required reviews, required status checks,
   no force push, no deletion.
4. Create `zunia-security` as a **private** repository. It exists locally but has no remote,
   and it must never be public.
5. Real teams behind `CODEOWNERS`, which is currently a placeholder in `zunia-core`.
6. Restrict who can publish to npm and who can create tags.

Owner: infra. Lead time: hours. **BLOCKING** for the supply-chain gate.

---

## 4. npm scope

Reserve `@zunialab` before anyone else does, because the package names are already published
in documentation and in the website copy.

```bash
npm login
npm org create zunialab          # or claim via the npm web UI
npm access set status=public --otp=<code>
```

Create a granular automation token limited to `@zunialab/*` for CI, and enable required 2FA
for publishing. Store as `NPM_TOKEN`.

Owner: release engineering. Lead time: hours. **BLOCKING** for ADR-0005 package flow.

---

## 5. Apple Developer Program

**Start this before anything else in the mobile track.**

1. Enrol as an **organisation**, not an individual. App Review guideline 3.1.5(b) only permits
   virtual-currency storage in apps from an organisation. An individual account will be
   rejected after the work is done.
2. Cost 99 USD per year. Organisation verification commonly takes 2 to 6 weeks and can stall
   on the D-U-N-S record.
3. Record the Team ID. `zunia-mobile/ios/Runner.xcodeproj` already has `683ATPM9Y6`, so
   confirm it matches the organisation account and is not a personal team.
4. Create the App ID `com.zuniawallet.zuniaMobile` with the Associated Domains capability.
5. Create the APNs authentication key (p8, token based, not a certificate). Record
   `APNS_KEY_ID`, `APNS_TEAM_ID` and store the p8 in the secret manager.
6. Register App Attest for the app.
7. Publish `apple-app-site-association` with the real Team ID at
   `zunia-website/public/.well-known/`, replacing the `TEAMID` placeholder, and confirm it is
   served as `application/json` with no redirect.
8. Prepare the export compliance answers: the app uses standard cryptography for key storage
   and TLS. Confirm the exemption category and the ECCN with counsel before the first upload.

Owner: mobile plus legal. Lead time: 2 to 6 weeks. **BLOCKING** for the mobile release.

---

## 6. Google Play Console

1. Enrol as an **organisation**. Cost 25 USD one off. Organisation verification for new
   accounts takes days to weeks and requires the registration number and a verifiable website.
2. Create the app with package name `com.zuniawallet.zunia_mobile`.
3. Complete the Financial features declaration, selecting the crypto wallet category. Some
   regions require additional licensing evidence, so answer with counsel.
4. Enable Play App Signing, then record the **app signing key** SHA-256 fingerprint. This is
   the value that goes into `assetlinks.json`, not the upload key fingerprint. Getting this
   wrong silently breaks Android App Links.
5. Fill `android_sha256_cert_fingerprints` in `zunia-mobile/config/connect.yaml`, currently an
   empty list, and publish the real `assetlinks.json`.
6. Create the Play Integrity API credentials.
7. Create a service account for Fastlane uploads and store the JSON key.

Owner: mobile. Lead time: 1 to 3 weeks. **BLOCKING** for the Android release.

---

## 7. Extension stores

**Chrome Web Store.** 5 USD one-off developer fee. Group publishing under the organisation, not
a personal Google account. Expect 1 to 3 weeks of review for a wallet, longer if
`host_permissions` stays broad. Prepare the justification text for each permission.

**Microsoft Edge Add-ons.** Free, separate Partner Center account, separate submission and
separate listing assets. Same MV3 bundle as Chrome. Review is typically faster, a few days.

**Firefox AMO.** Free. Requires `browser_specific_settings.gecko.id`, which is already set to
`extension@zunialab.com`. Because the build is bundled and minified, AMO requires a
**source code submission** with build instructions that reproduce the artifact. Prepare that
archive as part of the reproducible-build work.

**Brave.** No store. Brave installs from the Chrome Web Store, so there is no account to
create, but it still needs its own test row in the manual matrix.

**Safari.** Deferred past launch. When it happens it needs the Apple Developer account, an
Xcode project from `xcrun safari-web-extension-converter`, and a Mac App Store submission.

Owner: extension. Lead time: 1 to 3 weeks of review each. **BLOCKING** for the extension launch.

---

## 8. Service accounts and infrastructure

- **WalletConnect Cloud (Reown).** Create the project, record the project ID. It is referenced
  as a placeholder in three places: `zunia-extension/.env.example`
  (`WXT_WALLETCONNECT_PROJECT_ID`), `zunia-mobile/config/connect.yaml`, and
  `zunia-dashboard/.env.example` (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`).
- **Firebase project** for FCM. Create a service account for the **FCM HTTP v1 API**. Do not
  use the legacy server key, which Google deprecated; `config/notifications.ts` names
  `FCM_SERVER_KEY` and that field is being renamed.
- **Web Push VAPID keys.** Generate once and reuse across dashboard and extension:

  ```bash
  npx web-push generate-vapid-keys
  ```

- **Neon Postgres**, one project with `production` and `preview` branches. Record
  `DATABASE_URL` per environment.
- **Upstash Redis** for rate limiting and idempotency.
- **Container host** for the always-on indexer realtime worker: Fly, Railway or Render, per
  `zunia-indexer/docs/adr/0003-realtime-worker-host.md`. Serverless cannot hold a WebSocket.
- **Vercel** projects for website, docs and dashboard, plus Vercel Queues for the
  `zunia-tx-events` topic already declared in `zunia-backend/vercel.json`.
- **Sentry** organisation with separate projects per client, and PII scrubbing configured
  before the first event is sent.
- **Status page** provider for `status.zunialab.com`.
- **Secret manager**: 1Password or Doppler as the source of truth, syncing to Vercel and
  GitHub Actions. Nothing in a committed `.env`.

Owner: infra. Lead time: hours to days.

---

## 9. Security programme

- Third-party audit firm engaged for the kernel and signing flow. **Book 4 to 8 weeks ahead**,
  because good firms are scheduled out, and reserve time for a fix and re-review cycle.
- Bug bounty platform decided, Immunefi or self-hosted, with the scope already drafted in
  `zunia-security/bug-bounty/README.md`.
- Named security owner with authority to block a release.

Owner: security. Lead time: 4 to 8 weeks. **BLOCKING** for the mainnet marketing push.

---

## 10. Verification

Once provisioned, prove it rather than assuming it:

```bash
# security.txt reachable and current
curl -sS https://zunialab.com/.well-known/security.txt

# Apple association file, must be application/json with no redirect
curl -sSI https://zunialab.com/.well-known/apple-app-site-association

# Android asset links, must contain the Play app signing SHA-256
curl -sS https://zunialab.com/.well-known/assetlinks.json

# Email authentication
dig +short TXT zunialab.com | grep spf
dig +short TXT _dmarc.zunialab.com
```

Record each result in `provisioning/status.yaml` with the date checked.
