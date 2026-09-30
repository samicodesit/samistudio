# Native platform configuration discovery and setup

Discovery and the owner-authorized free platform setup completed 2026-09-09 for the Doodle Android migration.

## Verified project and app identity

| Item | Value | Evidence |
| --- | --- | --- |
| Play developer account | `5843530199260119810` | Play Console app route |
| Play app | `4973301025063263916` | Play Console app route |
| Android package | `nl.samistudio.doodle` | Play Console and `android/README.md` |
| Google Cloud project name | `Doodle` | Cloud Console project dashboard |
| Google Cloud project ID | `doodle-506308` | Cloud Console project dashboard |
| Google Cloud project number | `368967912119` | Cloud Console project dashboard and Play project picker |
| Cloud account observed | `samicodesit@gmail.com` | Cloud Console account indicator |

The local repository has no Play service account JSON file. The environment files expose no service-account JSON key. The existing server service-account metadata is recorded in `docs/play-api-support-draft.md` and was confirmed in Cloud Console:

- Client email: `doodle-play-billing@doodle-506308.iam.gserviceaccount.com`
- Project ID: `doodle-506308`
- Existing service-account use: Android Publisher API and Play billing support

No private key, token, or secret value was read or logged. The local `NEXT_PUBLIC_GOOGLE_CLIENT_ID` value is redacted in the checked environment metadata, so the Cloud Console value below is the source of truth.

## OAuth client discovery

Before setup, Cloud Console Credentials for `doodle-506308` had exactly one OAuth client:

- Name: `Doodle Web App`
- Type: Web application
- Client ID: `368967912119-eg869v0671g2kvg215l1ru91n1p1ihsn.apps.googleusercontent.com`
- Authorized JavaScript origin: `https://doodle.samistudio.nl`
- Authorized redirect URI list: empty

The existing web client remains the backend ID-token audience. Android Google Sign-In now has the owner-authorized client below:

- Name: `Doodle Android Play`
- Type: Android
- Client ID: `368967912119-10r46v9v4lq0aeec1t68bolbe3cl89n8.apps.googleusercontent.com`
- Package: `nl.samistudio.doodle`
- SHA-1: `B8:06:04:1D:76:62:E5:B6:99:88:2A:3B:CB:A8:A0:3F:E2:80:7C:DD`

The existing web client and consent configuration were not changed. No EAS or local-development client was created because the corresponding signing certificate is not yet established.

## Signing certificate discovery

Play Console App integrity > Play app signing shows a classical app-signing key and the following public certificates:

| Certificate | SHA-1 | SHA-256 | Use |
| --- | --- | --- | --- |
| Play deployment certificate | `B8:06:04:1D:76:62:E5:B6:99:88:2A:3B:CB:A8:A0:3F:E2:80:7C:DD` | `BD:31:BE:25:A8:57:3C:65:E0:02:06:AE:E4:CA:47:2B:59:BF:A4:0A:CD:25:72:89:EA:49:39:58:84:91:3E:64` | Production Google Sign-In Android client and Digital Asset Links |
| Local upload certificate | `44:D6:07:FE:0D:B6:BC:19:9E:12:6A:51:F8:CE:A0:64:62:3E:45:54` | `CA:AA:B7:44:11:C3:7B:97:DD:3D:AA:3F:47:35:94:CD:D6:6C:DC:CB:E0:AF:6D:EB:AE:C5:03:CE:0C:34:BC:C1` | Local TWA upload key, not the Play-distributed signing identity |
| Play hybrid classical certificate | `54:B3:2B:C8:EE:B5:BC:F0:16:EB:96:C7:7F:65:03:CB:48:30:8C:6A` | `B1:7B:43:62:D6:C4:D5:A7:88:69:54:A1:33:FF:54:67:B4:B3:BF:7B:69:E1:CE:09:97:05:49:3B:AA:20:85:06` | Play downloaded certificate variant |
| Play hybrid PQC certificate | `E1:96:54:CE:BD:8C:AB:2A:5F:9A:DE:57:F7:3E:7C:DF:59:0B:FA:04` | `01:FC:51:EC:E3:96:22:E8:3C:EF:F4:50:00:A0:7B:BE:21:88:C5:23:88:B5:17:28:77:68:C8:02:E8:87:34:24` | Play downloaded certificate variant |

The deployment certificate is the production app-signing identity. The upload certificate alone must not be used for the Play production Android OAuth client. An Expo or EAS build can have additional signing certificates. Those SHA-1 values are not present in this repository and must be collected from the actual EAS credentials or build signing report before adding corresponding Android clients.

## Play Integrity state after setup

The owner-authorized setup was completed for Play app `4973301025063263916`:

- Cloud API `playintegrity.googleapis.com`: `Enabled` in project `doodle-506308`.
- Linked Cloud project: `Doodle`, project ID `doodle-506308`, project number `368967912119`.
- Daily linked-project limit shown by Play Console: `10,000`.
- Account details and app licensing: `On`, with `LICENSED`, `UNLICENSED`, and `UNEVALUATED` values.
- Application integrity: `On`, with `PLAY_RECOGNIZED`, `UNRECOGNIZED_VERSION`, and `UNEVALUATED` values.
- Device integrity: `On`, with `MEETS_DEVICE_INTEGRITY` available.
- Response encryption: `Managed by Google`.

Optional response fields remain off: Recent device activity, Device attributes, Play Protect status, and App access risk. The unrelated default project `Naruto Arena Mests` (`316613431950`) was not linked.

## Service account decode readiness

The existing service account remains the server-side candidate:

- Email: `doodle-play-billing@doodle-506308.iam.gserviceaccount.com`
- Project: `doodle-506308`
- Status: enabled

Cloud Policy Analyzer was queried for this principal against the `doodle-506308` project resource. It returned no matching roles or permissions. No IAM role was added. The current official Standard Play Integrity instructions require a service account in the linked project, an access token with scope `https://www.googleapis.com/auth/playintegrity`, and the decode endpoint. They do not name a separate IAM role to grant for this flow. A live decode proof still needs a real token from a native build; if that request returns a permission error, investigate only that specific permission with the resulting error.

## Bounded authorization probe

The production Vercel environment visibly contains `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` for the existing server configuration, but Vercel treats saved secrets as write-only in the dashboard. The local `.env.local` contains no service-account JSON. An attempted in-memory Cloud impersonation of the same service-account identity returned the sanitized result `PERMISSION_DENIED` for `iam.serviceAccounts.getAccessToken`, so no Play Integrity decode request was sent. The approved local artifact locations also contained no matching service-account JSON: Windows Downloads `doodle-506308*.json`, Windows `.codex/private/doodle*`, and WSL `.local/share/doodle-android-tools` Play service-account filenames. No local Integrity variables were written and no credential was created or logged. The next probe must use the existing server credential through an already authorized secure runtime, send only a non-secret invalid token, and record HTTP 400 versus HTTP 403 without claiming a real attestation.

## Test response note

Google's official Play Integrity tools documentation says Play Console tests target email addresses selected by the developer and can return selected integrity verdicts or error codes. Test payloads include `testingDetails.isTestingResponse: true`. The official setup documentation lists `MEETS_VIRTUAL_INTEGRITY` for supported Google Play emulators. Doodle's production verifier currently requires `MEETS_DEVICE_INTEGRITY`, so any emulator result or Play Console test response must remain labeled as simulated test evidence and must not relax the production check.

## Completed owner-approved configuration sequence

1. Link Play app `4973301025063263916` to project number `368967912119` and verify the resolved project ID `doodle-506308`.
2. Enable `Google Play Integrity API` (`playintegrity.googleapis.com`) in Cloud Console for `doodle-506308`.
3. Confirm the default account, application, and device verdict fields are on, with response encryption managed by Google.
4. Create the Android OAuth client for package `nl.samistudio.doodle` using the Play deployment SHA-1 above. Keep the existing web client for backend ID-token verification.
5. For server decoding, obtain an access token from the existing linked-project service account with scope `https://www.googleapis.com/auth/playintegrity` and POST the token to `https://playintegrity.googleapis.com/v1/nl.samistudio.doodle:decodeIntegrityToken` with body `{"integrity_token":"..."}`. Keep credential material in the server secret store and outside the repository.
6. In the Standard Integrity API client, warm up with cloud project number `368967912119`, compute a request hash from the protected request, request the token, send it to the server, decode it, and validate `requestDetails` plus the relevant verdicts before performing the protected action. Do not place sensitive plaintext in the request hash.

Expo or EAS project configuration and its signing credentials still need to be established by the native foundation work. No iOS Play Integrity configuration is applicable; future iOS Google Sign-In setup is a separate platform client and signing path.

## Source evidence

- [Google Play Integrity setup](https://developer.android.com/google/play/integrity/setup)
- [Play Integrity additional tools and test responses](https://developer.android.com/google/play/integrity/additional-tools)
- [Standard Play Integrity API](https://developer.android.com/google/play/integrity/standard)
- [Integrity verdicts](https://developer.android.com/google/play/integrity/verdicts)
- [Google Sign-In Android client authentication](https://developers.google.com/android/guides/client-auth)
- [Google Sign-In backend authentication](https://developers.google.com/identity/sign-in/android/backend-auth)
- [Expo Android App Links and EAS credentials](https://docs.expo.dev/linking/android-app-links/)
