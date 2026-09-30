# Android domain association

Prepared 7 September 2026 from the Digital Asset Links snippet in Doodle's Google Play Console App Signing page. The public statement is `public/.well-known/assetlinks.json`, served by Next.js at `https://doodle.samistudio.nl/.well-known/assetlinks.json`. No environment variable is required.

- Android package: `nl.samistudio.doodle`
- Relation: `delegate_permission/common.handle_all_urls`
- Play distribution certificate SHA-256: `BD:31:BE:25:A8:57:3C:65:E0:02:06:AE:E4:CA:47:2B:59:BF:A4:0A:CD:25:72:89:EA:49:39:58:84:91:3E:64`

Only the certificate supplied by Play Console is trusted here. The local upload key and debug key are intentionally not associated with the production domain. If Play changes the signing certificate, retrieve its current association snippet and update this statement accordingly.

After deployment, verify the public HTTPS endpoint returns status 200 and `application/json` without a redirect or authentication. Then install the app through Play internal testing and confirm the domain opens as a Trusted Web Activity without a browser toolbar. A local debug APK does not prove this association because it has a different signing certificate.

Local verification: on 7 September 2026 at 16:49 UTC, the running Next.js server at `http://localhost:3100/.well-known/assetlinks.json` returned HTTP 200 directly, `Content-Type: application/json; charset=UTF-8`, and the exact statement above. Deployment and Play-installed verification remain separate checks.

Production verification: deployed as Vercel `ANQ1qDtRi8fKaEPrYx7ZXK8xzSTA`, aliased to doodle.samistudio.nl. On 7 September at 16:55 UTC the public HTTPS endpoint returned direct HTTP 200, application/json, and the exact Play statement. Actual Play-installed toolbar-free behavior still needs verification.
