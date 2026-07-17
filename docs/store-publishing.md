# Store publishing

Store delivery has two separate trust boundaries:

1. Every pull request and release builds the same deterministic, checksummed browser archives without store credentials.
2. `.github/workflows/store-publish.yml` accepts an existing final GitHub Release, verifies its checksum, waits for approval in the `store-publish` environment, and submits only the selected store.

The repository environment is already configured with `@ubugeeei` as its required reviewer and a custom deployment policy that permits `main` only. Do not move store credentials to repository-wide secrets: keeping them in this environment prevents unapproved jobs from reading them.

## Required environment values

Open **Settings → Environments → store-publish**. Add the following values after completing each store's one-time setup.

| Store   | Kind     | Name                             | Value                                                                                       |
| ------- | -------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Chrome  | Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`            |
| Chrome  | Variable | `CWS_SERVICE_ACCOUNT`            | Google service-account email                                                                |
| Chrome  | Variable | `CHROME_PUBLISHER_ID`            | Publisher ID from **Chrome Web Store Developer Dashboard → Publisher → Settings**           |
| Chrome  | Variable | `CHROME_EXTENSION_ID`            | ID of the existing Chrome Web Store item                                                    |
| Firefox | Secret   | `AMO_JWT_ISSUER`                 | JWT issuer from the AMO API credentials page                                                |
| Firefox | Secret   | `AMO_JWT_SECRET`                 | JWT secret from the AMO API credentials page                                                |
| Edge    | Variable | `EDGE_CLIENT_ID`                 | Client ID from **Partner Center → Microsoft Edge → Publish API**                            |
| Edge    | Variable | `EDGE_PRODUCT_ID`                | Existing product's GUID from Partner Center                                                 |
| Edge    | Secret   | `EDGE_API_KEY`                   | Publish API v1.1 key; rotate it before the expiry date shown by Partner Center              |
| Safari  | Variable | `SAFARI_BUNDLE_ID`               | Unique reverse-DNS bundle ID registered for the app, for example `dev.ubugeeei.highlighter` |

`AMO_JWT_SECRET` and `EDGE_API_KEY` are the only long-lived publishing credentials in GitHub, and they are isolated as approval-gated environment secrets. There is deliberately no Google JSON key, OAuth client secret, Chrome refresh token, repository-wide store token, or Apple credential; build and GitHub Release jobs receive none of the two environment secrets.

## Chrome Web Store: tokenless OIDC

Chrome requires a developer account with 2-step verification and an existing item whose **Store listing** and **Privacy** tabs are complete. Create the item and perform its initial dashboard setup using `web-highlighter-vVERSION-chrome-web-store.zip`; the API then handles subsequent package uploads and review submissions. Use the canonical copy in `store/listing.md`, the declarations in `PRIVACY.md`, and the manual checks in `store/reviewer-notes.md`.

Configure Google Cloud without creating a service-account key:

1. Create or select a dedicated Google Cloud project and enable **Chrome Web Store API** and **IAM Service Account Credentials API**.
2. Create a service account such as `web-highlighter-publisher`. It needs no project role.
3. In Chrome Web Store Developer Dashboard, open **Account** and add that service-account email. Chrome currently permits one service account per publisher.
4. In Google Cloud **Workload Identity Federation**, create an OIDC pool and provider with issuer `https://token.actions.githubusercontent.com/` and the default audience.
5. Map `google.subject` to `assertion.sub`.
6. Set this provider condition, which rejects other repositories and refs:

   ```text
   assertion.repository=='ubugeeei-prod/web-highlighter' && assertion.ref=='refs/heads/main'
   ```

7. Read this repository's authoritative immutable subject prefix and confirm that it matches the value below:

   ```sh
   gh api repos/ubugeeei-prod/web-highlighter/actions/oidc/customization/sub --jq .sub_claim_prefix
   ```

   ```text
   repo:ubugeeei-prod@288813381/web-highlighter@1302664546
   ```

8. Grant `roles/iam.workloadIdentityUser` on the service account to this exact environment subject, using the numeric Google Cloud project number:

   ```text
   principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/subject/repo:ubugeeei-prod@288813381/web-highlighter@1302664546:environment:store-publish
   ```

9. Add the four Chrome environment variables from the table above.

At runtime, GitHub issues an OIDC token only to the Chrome job. Google exchanges it for a 15-minute access token scoped to `https://www.googleapis.com/auth/chromewebstore`; the workflow neither receives nor stores a renewable Google secret.

References: [Chrome Web Store API setup](https://developer.chrome.com/docs/webstore/using-api), [Chrome service accounts](https://developer.chrome.com/docs/webstore/service-accounts), [Google Workload Identity Federation for GitHub](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), and [GitHub OIDC claims](https://docs.github.com/en/actions/reference/security/oidc).

## Firefox Add-ons

1. Sign in to [AMO Developer Hub](https://addons.mozilla.org/developers/) and create API credentials.
2. Store the JWT issuer and secret under the two Firefox environment secret names above.
3. Confirm `store/amo-metadata.json` and the Firefox listing copy before the first submission.

The pinned `web-ext` submission command uses the packaged Gecko ID, the `listed` channel, the canonical AMO metadata, and the complete human-readable source ZIP. It can create the listing for the first listed version and add later versions. The job exits after AMO accepts the submission; AMO review continues asynchronously.

Reference: [Mozilla `web-ext sign`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).

## Microsoft Edge Add-ons

Microsoft's API updates existing products; it cannot create the first product or change store metadata.

1. Create and submit the initial product in [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) with the Edge ZIP and canonical listing material.
2. Open **Microsoft Edge → Publish API**, enable the v1.1 API-key experience, and create credentials.
3. Copy the Client ID and API key immediately, then copy the product GUID from the extension overview.
4. Add the two variables and one secret from the table. Record the API key expiry in the team's rotation calendar.

The workflow uploads the package, polls the returned operation until `Succeeded`, submits certification notes, and polls the submission. Unknown, failed, timed-out, or off-origin operation responses stop the job.

Reference: [Microsoft Edge Add-ons Update REST API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api).

## Safari and App Store Connect

1. Enroll the publishing Apple Account in the Apple Developer Program.
2. Register the bundle ID and create the app record in App Store Connect.
3. Add `SAFARI_BUNDLE_ID` to the GitHub environment.
4. Run the Safari job. The largest pinned Blacksmith macOS runner verifies the ZIP with Apple's current `safari-web-extension-packager` and uploads both the original ZIP and generated Xcode project as a seven-day workflow artifact. Download the generated project within seven days if it is needed locally; rerun **Store publish** with the same tag and `safari` selection to regenerate it after expiration. The original Safari ZIP remains durably attached to the GitHub Release.
5. Within that handoff window, open **Xcode Cloud → Safari Web Extension Packager** in App Store Connect, upload the full Safari ZIP from the durable GitHub Release or workflow artifact, choose the packaged build, complete the product page, and submit it for review. TestFlight can be used first.

App Store Connect packaging and review remain manual because Apple exposes that flow through the authenticated web interface, not the credential-free job used here.

References: [Safari command-line packager](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) and [App Store Connect Safari distribution](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect).

## Release and submit

From a clean, synchronized `main`, create the release:

```sh
vp run release minor
```

The atomic tag push starts `.github/workflows/release.yml`. Wait until **Verify and package** and **Attest and publish** pass and the GitHub Release contains every ZIP plus `SHA256SUMS`.

Then open **Actions → Store publish → Run workflow** on `main`:

1. Enter the exact final tag, such as `v0.2.0`.
2. Choose one store or `all`.
3. Start the workflow.
4. Review the pending deployment, inspect the selected tag, and approve `store-publish`.
5. Follow the store dashboard until its review is approved. A green workflow means the store accepted the submission, not that human review is complete.

For a dry build with no credentials or external writes, run `vp run package` locally or download `store-submission-artifacts` from any successful CI run.
