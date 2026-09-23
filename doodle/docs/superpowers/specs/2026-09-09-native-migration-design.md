# Doodle native migration design

**Date:** 2026-09-09
**Status:** Backend contract and implementation boundary
**Scope:** An Expo and React Native Android app in mobile/, backed by the existing Doodle web deployment. The app keeps the current web frontend, TWA project, account model, generation accounting, and Play credit ledger. The frontend and service interfaces remain shared and iOS-capable, while iOS build, signing, auth, and StoreKit verification are not verified or configured in this migration.

## Decision

Create mobile/ as a separate Expo application. Use stable Expo SDK 57.0.21, React Native 0.86, Node >=22.13, Android compile and target API 36, and JDK 17. Use a local development build because Google Sign-In, Play billing, file sharing, and attestation require native code. The existing android/ TWA and its local billing module remain available for the web wrapper and are not imported into the Expo app.

Native Google Sign-In verifies the same Google WEB client ID that the web route already verifies. A new native auth route creates the same Google account and returns an opaque, random, Redis-backed bearer session. The token is stored in expo-secure-store; no web session cookie or server secret is placed in the app. Shared authenticated routes read the bearer when present and retain the existing cookie path for web and TWA clients.

Native Play purchases use expo-iap and the existing server verification boundary. The app fetches the server-derived obfuscatedAccountId, passes it to Google Play, sends only the purchase token and fixed SKU back to /api/play/verify, and finishes a consumable transaction only after the server grants or confirms the ledger credit. No IAPKit, RevenueCat, Stripe, or other paid service is added.

The browser BotID client cannot run in React Native. Native generation therefore uses a separate Play Integrity standard request with a one-use server challenge and a request hash bound to the normalized scene. The web request path keeps checkBotId() and its current client protection. Native generation, including native guest bootstrap, fails closed until the server has valid Play Integrity configuration and a real Play-distributed build has passed verification. A client-supplied x-is-human header is never accepted as native proof.

## Existing behavior to preserve

| Capability | Current source and behavior | Native boundary |
| --- | --- | --- |
| Google auth | src/app/api/auth/google/route.ts verifies an ID token with NEXT_PUBLIC_GOOGLE_CLIENT_ID, then createOrGetGoogleAccount derives the HMAC identity key and account UUID. | Add /api/native/auth/google with the same verifier and account mapping. Never accept a client account ID. |
| Web session | src/lib/auth/session.ts signs doodle_session for 30 days and checks isPaidAccountActive. | Add a random bearer session stored under a SHA-256 token key. Keep cookie parsing unchanged for requests without Authorization. |
| Account summary | GET /api/account returns {authenticated,email,balance,freeRemaining} and sets the signed trial cookie. | Accept bearer sessions through getCurrentUser(request). Keep the JSON shape unchanged. Native stores its trial token explicitly instead of relying on Set-Cookie. |
| Account deletion | DELETE /api/account requires same-origin, {confirm:true}, an active user, and deletePaidAccount. | Accept bearer sessions, revoke the bearer after deletion, and keep the cookie expiry for web. A retained deletion tombstone makes all later bearer requests unauthorized through the active-account check. A concurrent Google sign-in rotates a mapping that still points at the tombstoned account to a new random account ID, leaving the deleted ledger isolated. |
| Sign-out | POST /api/auth/sign-out expires the web cookie. | Add /api/native/auth/sign-out, delete the hashed bearer key, and make the operation idempotent. |
| Paid generation | POST /api/generate checks exact origin, BotID, then atomically reserves and finalizes a paid credit. Holds expire after 600 seconds. | Native uses the same route and ledger after verified attestation. The image response and balance headers stay unchanged. |
| Guest generation | doodle_trial is a signed UUID cookie. Redis tracks two finalized uses, active holds, and idempotent finalization. | Native guest bootstrap returns the same signed trial value in JSON. Native sends it as X-Doodle-Trial-Token; the server still uses the existing Redis keys and IP/global limits. |
| Generation rate limit | Guest requests use HMAC-obscured client IP counters, 20 per client per day and 200 globally. | Native guests remain subject to the same checkGenerationLimit call. Attestation does not remove quota checks. |
| Play credits | doodle_credits_10, package nl.samistudio.doodle, HMAC account binding, Publisher API lookup, one-time ledger claim, server consumption, and pending-consumption recovery. | Reuse /api/play/config and /api/play/verify with bearer auth. The client never supplies the account binding. |
| Web checkout | Stripe checkout is authenticated and BotID-protected. | Native does not call Stripe checkout. It uses Play billing on Android. |
| Share and download | Web result actions create an image object URL, download it, or call the browser share API. | Stage the PNG in expo-file-system cache and use expo-sharing. No browser tab or tracking URL is constructed. |
| Delete, settings, localization | Existing account menu, settings links, and src/lib/i18n.ts provide the behavior and ten locales. | Native settings calls the shared account endpoints and uses the existing locale keys. Arabic direction and Alexandria font remain UI work. |

## Native HTTP invariants

The mobile API client sends:

~~~text
Origin: https://doodle.samistudio.nl
X-Doodle-Client: native-android
Authorization: Bearer <opaque session token>       # authenticated requests only
X-Doodle-Trial-Token: <signed trial value>         # guest generation/account only
~~~

Origin is required by the existing same-origin defense, but it is public and is not authentication. The bearer token or signed trial token is checked independently. The client never uses a generic HTTP self-proxy, sends tokens in a URL, or embeds any SESSION_SECRET, Play service account, or Integrity credential.

The server treats a present but malformed Authorization header as unauthenticated and does not fall back to a cookie. This prevents a stale native bearer from silently selecting a different browser identity. Requests with no bearer retain the current cookie behavior.

All native JSON routes set Cache-Control: no-store. Native auth, challenge, guest, account, generation, and Play errors expose stable error codes only. Purchase tokens, bearer tokens, Integrity tokens, Google credentials, and raw provider responses are never logged.

## Exact API contracts

### GET /api/native/config

This public, no-store response lets the native client avoid an unsupported generation attempt. It contains no credential or certificate data.

~~~ts
type NativeConfigResponse = {
  enabled: boolean;                 // true only when server Integrity config is valid
  packageName: "nl.samistudio.doodle";
  minimumVersionCode: 2;
  attestation: "play_integrity";
  guestEnabled: boolean;            // equal to enabled for Android
  cloudProjectNumber?: string;      // safe to expose, required by the Android provider
};
~~~

When NATIVE_ATTESTATION_ENABLED is not exactly true, return enabled:false, guestEnabled:false, and omit cloudProjectNumber. A malformed enabled configuration is a 503 with {error:"native_generation_unavailable"}.

### POST /api/native/auth/google

Headers: exact Doodle origin and JSON content type. Maximum body size is 8,192 bytes. The body must contain exactly one key.

~~~ts
type NativeGoogleRequest = { credential: string };
type NativeGoogleResponse = {
  authenticated: true;
  email: string;
  accessToken: string; // 32 random bytes, base64url, never a signed user payload
  expiresAt: number;   // Unix milliseconds
};
~~~

The route runs verifyGoogleCredential(credential) and createOrGetGoogleAccount(sub) from the existing auth code. It creates a Redis key:

~~~text
doodle:auth:native:<sha256(accessToken)> -> {"id":<uuid>,"identityKey":<64 hex>,"email":<email>}
~~~

The key has EX 2592000. The token is returned only in the JSON response and is never set as a cookie. The response is 200 with the shape above. Malformed JSON, extra keys, non-string credentials, or an oversized body return 400 {error:"invalid_request"}. Invalid Google credentials return 401 {error:"invalid_credential"}. Account or Redis failures return 503 {error:"auth_unavailable"}.

The server must use the same NEXT_PUBLIC_GOOGLE_CLIENT_ID WEB audience. The Android Google Sign-In client must be configured with this WEB client ID so idToken is non-null. Android package and signing certificate OAuth clients are separate Google Cloud configuration and must be present for the signed build.

### POST /api/native/auth/sign-out

Headers: exact Doodle origin and a bearer token. No body is accepted. The route deletes doodle:auth:native:<sha256(token)> and returns 204. Unknown or already-deleted tokens also return 204; malformed tokens return 204 after local client cleanup. Redis failure returns 503 {error:"auth_unavailable"}. The client clears SecureStore after the response or after a network failure.

### POST /api/native/attestation/challenge

Headers: exact Doodle origin and JSON content type. generate requires either a valid bearer or a valid X-Doodle-Trial-Token. Maximum body size is 4,096 bytes.

~~~ts
type NativeChallengeRequest =
  | { operation: "guest"; installId: string }
  | { operation: "generate"; installId: string; sceneHash: string };

type NativeChallengeResponse = {
  challenge: string;    // 32 random bytes, base64url
  requestHash: string;  // SHA-256 digest used as Standard Integrity requestHash
  expiresAt: number;    // Unix milliseconds, approximately five minutes
};
~~~

installId is a UUID accepted by the existing UUID grammar and normalized to lower-case. sceneHash is exactly 64 lower-case hexadecimal characters and is the SHA-256 digest of the normalized scene. The server creates a Redis key:

~~~text
doodle:native:attestation:<sha256(challenge)> -> {
  "operation":"guest"|"generate",
  "installId":<uuid>,
  "sceneHash":<hex|null>,
  "principal":"install:<uuid>"|"account:<uuid>"|"trial:<uuid>",
  "requestHash":<base64url>
}
~~~

The key uses SET ... NX EX 300. The record also stores a principal binding: install:<installId> for guest bootstrap, account:<accountId> for paid generation, or trial:<trialId> for guest generation. The request hash is the base64url SHA-256 digest of the stable JSON object {challenge,operation,installId,sceneHash,principal} with those property names and that order. The native client passes this exact requestHash to the Android Standard Integrity provider. A challenge is single-use. After the provider responds, the server compare-deletes the record for both valid and invalid verdicts, so an invalid token cannot be retried. If the provider is unavailable, the record remains until expiry so a transient failure can be retried. Before allocating that Redis key, the server applies separate cheap Redis counters for challenge issuance: 20 per client and operation per UTC day, plus 200 globally per UTC day. The client key is an HMAC of the normalized source IP and does not expose the IP in Redis. A client or global limit returns 429 {error:"rate_limited"}; an unavailable limiter returns 503 {error:"native_generation_unavailable"}. These limits are separate from the existing generation counters.

Disabled or malformed configuration returns 503 {error:"native_generation_unavailable"}. Invalid input returns 400 {error:"invalid_request"}. Missing or invalid bearer and missing or invalid trial token for generate return 401 {error:"unauthorized"}. A guest generation challenge uses the signed trial token as its principal, so the two free uses do not require Google sign-in.

### POST /api/native/session/guest

Headers: exact Doodle origin and JSON content type. Maximum body size is 16,384 bytes.

~~~ts
type NativeGuestSessionRequest = {
  installId: string;
  challenge: string;
  integrityToken: string;
};

type NativeGuestSessionResponse = {
  trialToken: string;       // existing doodle_trial value, returned explicitly
  expiresAt: number;        // one year from issuance
  freeRemaining: number;    // 0, 1, or 2 from existing Redis allowance
};
~~~

The server verifies and consumes a guest challenge, then stores one trial UUID per installation:

~~~text
doodle:native:trial:<sha256(installId)> -> <trial UUID>, EX 31536000
~~~

It returns trialToken = <uuid>.<HMAC-SHA256(uuid, SESSION_SECRET)>. The existing getFreeRemaining, reserveFreeDoodle, finalizeFreeDoodle, and releaseFreeDoodle functions remain the source of truth. The route never returns a paid account or an unbound free identity. Invalid Integrity returns 403 {error:"native_attestation_failed"}; unavailable configuration or provider failure returns 503 {error:"native_generation_unavailable"}.

### Shared GET /api/account and DELETE /api/account

Change the handlers to call getCurrentUser(request) so a bearer can be selected without changing the web cookie fallback. Keep AccountSummary exactly:

~~~ts
type AccountSummary = {
  authenticated: boolean;
  email: string | null;
  balance: number;
  freeRemaining: number | null;
};
~~~

For native guest calls, send X-Doodle-Trial-Token and do not depend on Set-Cookie. For native authenticated calls, send the bearer and omit the trial header. DELETE still requires exact same-origin and {confirm:true}. After deletePaidAccount succeeds, revoke the native bearer when present and expire the web cookie as before.

### Shared POST /api/generate

Web requests keep the current sequence and response:

1. Exact same-origin check.
2. checkBotId() using the existing browser challenge headers.
3. JSON parse and normalizeScene.
4. Paid credit or signed trial reservation, free IP/global rate limit, generation, and idempotent finalization.

Native requests are identified only to select validation, never to grant trust:

~~~text
X-Doodle-Client: native-android
X-Doodle-Install-Id: <uuid>
X-Doodle-Attestation-Challenge: <challenge>
X-Doodle-Attestation-Token: <opaque Play Integrity token>
Authorization: Bearer <token>                         # paid account
X-Doodle-Trial-Token: <signed value>                  # guest
~~~

The server normalizes the scene, computes its SHA-256, consumes a matching generate challenge, verifies the Standard Integrity token, and then enters the existing reservation path. An authenticated native request must have a valid bearer. A guest native request must have a valid signed trial header. A request cannot provide both as a way to choose a different identity.

The decoded verdict must have:

- requestDetails.requestPackageName === "nl.samistudio.doodle".
- requestDetails.requestHash equal to the challenge's request hash.
- A timestamp no older than the challenge window and not materially in the future.
- appIntegrity.appRecognitionVerdict === "PLAY_RECOGNIZED".
- appIntegrity.packageName === "nl.samistudio.doodle".
- appIntegrity.certificateSha256Digest containing the configured Play app-signing digest.
- accountDetails.appLicensingVerdict === "LICENSED".
- deviceIntegrity.deviceRecognitionVerdict containing MEETS_DEVICE_INTEGRITY.

The route never accepts x-is-human as a substitute for the decoded verdict. Missing or invalid native proof returns 403 {error:"native_attestation_required"} or {error:"native_attestation_failed"}. Missing configuration or provider failure returns 503 {error:"native_generation_unavailable"} before a credit or trial hold is made. The generated PNG bytes and existing X-Doodle-Paid-Remaining, X-Doodle-Free-Remaining, and X-Doodle-Balance-Uncertain headers are unchanged.

An authenticated native bearer selects the paid account ledger. If no paid credit can be reserved, the route returns 402 without creating an anonymous trial identity. The two-use trial path is selected explicitly with a signed X-Doodle-Trial-Token and no bearer, so a missing native trial token can never mint a new allowance. Signing in does not strand an existing free allowance: the client keeps its valid trial token and may use that trial-only path when the paid balance is zero. The server does not mint a replacement trial identity during sign-in.

### Shared Play routes

GET /api/play/config and POST /api/play/verify call getCurrentUser(request) and accept the opaque bearer. Their response contracts remain:

~~~ts
type PlayConfigResponse = {
  enabled: true;
  productId: "doodle_credits_10";
  obfuscatedAccountId: string; // server HMAC of the active account UUID
};

type PlayVerifyResponse = {
  status: "granted" | "already_granted" | "granted_consume_pending";
  balance: number;
};
~~~

The client sends {productId:"doodle_credits_10",purchaseToken:string} only. The server derives the account ID and expected HMAC binding from the bearer. It retains exact SKU, quantity, one-line, purchase state, consumed-ledger, and Google Publisher checks. No native route accepts accountId or obfuscatedAccountId from the client.

## Play Integrity server configuration

The standard request flow follows the Android Developers guidance for request hashes, Google-side token decoding, and verdict validation:

- [Make a standard API request](https://developer.android.com/google/play/integrity/standard)
- [Integrity verdicts](https://developer.android.com/google/play/integrity/verdicts)

The server reads these deployment-only values:

~~~text
NATIVE_ATTESTATION_ENABLED=true
PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=<numeric Google Cloud project number>
PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON=<service account JSON with playintegrity access>
PLAY_INTEGRITY_CERTIFICATE_SHA256=<base64 digest from the Play Integrity app verdict>
PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS=true
~~~

The service account must have the Play Integrity API enabled and permission in the Cloud project linked to the Play app. The preferred source is the dedicated Integrity variable. When that variable is absent, the existing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON may be selected only when PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS is exactly true and its parsed project_id is doodle-506308 and client_email is doodle-play-billing@doodle-506308.iam.gserviceaccount.com. The server passes the selected credential to GoogleAuth with the https://www.googleapis.com/auth/playintegrity scope and fails closed for any project or account mismatch. It never silently reuses a Publisher credential. PLAY_INTEGRITY_CERTIFICATE_SHA256 uses the representation returned by the verdict, not the colon-delimited fingerprint copied from an Android keystore report.

The Android app warms a Standard Integrity provider with the project number and requests a fresh token for each challenge. Standard Integrity's automatic replay protection supplements the server's one-use challenge. An Android local debug APK, the existing TWA artifact, and an emulator without Play distribution cannot be presented as a successful production Integrity test.

Platform discovery recorded in docs/superpowers/native-platform-config.md confirms the linked Cloud project, enabled Integrity API, Play package, production signing certificate, and Android OAuth client. A live decode token, verified service-account decode permission, and verified native module are still unavailable. Until those are supplied and tested, /api/native/config reports disabled and native generation remains unavailable. iOS uses the same interface but has no attestation implementation in this migration; its generation path stays disabled.

## Native IAP lifecycle

The mobile billing adapter owns this sequence:

1. initConnection().
2. Fetch doodle_credits_10 as an in-app product.
3. Fetch /api/play/config after bearer sign-in.
4. Call requestPurchase with one SKU and the returned obfuscated account binding. Current Expo IAP docs expose obfuscatedAccountId in the current unified request shape and obfuscatedAccountIdAndroid in older examples. Pin the installed version and use the exported type from that version, with a small adapter that maps the exact field.
5. Register the purchase update listener before requesting a purchase.
6. POST the purchase token to /api/play/verify.
7. Call finishTransaction({purchase,isConsumable:true}) only for granted or already_granted.
8. Leave pending or unavailable purchases unfinished and retry on the next foreground or connection. Never log or expose purchase tokens.

The official Expo IAP documentation describes the server-verification-before-finish lifecycle and native development-build requirement:

- [Expo IAP](https://hyochan.github.io/expo-iap/)
- [Expo IAP unified APIs](https://hyochan.github.io/expo-iap/api/methods/unified-apis/)
- [Expo IAP lifecycle](https://hyochan.github.io/expo-iap/guides/lifecycle/)
- [Expo IAP Android setup](https://hyochan.github.io/expo-iap/getting-started/setup-android/)

The current docs describe getAvailablePurchases differently for consumables across pages. Treat recovery of this consumable as an acceptance test on a Play-installed build. The pending server ledger remains authoritative, and a purchase must never be finished before the server has claimed it.

## Native service interfaces

These interfaces are the boundary between the foundation worker and the UI worker. The UI receives resolved state and callbacks and does not import any server or platform SDK.

~~~ts
export type NativeApi = {
  getConfig(): Promise<NativeConfigResponse>;
  signInWithGoogle(credential: string): Promise<NativeGoogleResponse>;
  signOut(): Promise<void>;
  getAccount(): Promise<AccountSummary>;
  deleteAccount(): Promise<void>;
  createGuestSession(installId: string): Promise<NativeGuestSessionResponse>;
  generate(scene: string): Promise<{ imageUri: string; freeRemaining?: number; paidRemaining?: number }>;
};

export type NativeBilling = {
  prepare(): Promise<{ productId: "doodle_credits_10"; priceLabel: string }>;
  buy(): Promise<void>;
  recoverPending(): Promise<void>;
  dispose(): Promise<void>;
};

export type NativeMedia = {
  stagePng(bytes: ArrayBuffer): Promise<string>;
  download(uri: string): Promise<void>;
  share(uri: string): Promise<void>;
};

export type NativeAttestation = {
  prepare(): Promise<void>;
  request(requestHash: string): Promise<string>;
};
~~~

The foundation adapter owns token and installation ID persistence, API headers, challenge exchange, IAP listeners, and media staging. The UI owns copy, tabs, modal state, character counting, waiting messages, accessibility, and callbacks.

## File ownership

Workers must not edit one another's files.

| Owner | Files | Responsibility |
| --- | --- | --- |
| Backend and security | src/app/api/native/config/route.ts; src/app/api/native/auth/google/route.ts; src/app/api/native/auth/sign-out/route.ts; src/app/api/native/attestation/challenge/route.ts; src/app/api/native/session/guest/route.ts; src/lib/native-session.ts; src/lib/native-attestation.ts; src/lib/native-guest.ts; src/lib/native-contracts.ts; src/lib/auth/session.ts; src/lib/generation/free-allowance.ts; src/app/api/account/route.ts; src/app/api/generate/route.ts; src/app/api/play/config/route.ts; src/app/api/play/verify/route.ts; corresponding tests | Opaque session, Google mapping, challenge storage and decode, guest identity, bearer selection, attestation gate, existing ledger integration, and server contract tests. |
| Native foundation | mobile/package.json; mobile/app.json or mobile/app.config.ts; mobile/tsconfig.json; mobile/src/contracts/**; mobile/src/platform/**; mobile/src/services/**; mobile/src/assets/fonts/**; generated mobile/android/** | Expo scaffold, config plugin, SecureStore, Google Sign-In, Expo IAP, FileSystem, Sharing, Integrity provider interface, and API adapter. It may read the backend contract but does not edit src/. |
| Native UI | mobile/src/ui/**; mobile/src/ui/assets/** | Native screen components, fonts and visual states from docs/superpowers/specs/2026-09-09-native-ui-contract.md. No fetch, auth, billing, or attestation imports. |
| App integration | mobile/App.tsx; mobile/src/app/** | Compose adapters with the UI contract, preserve tab state, map service results to callbacks, and keep platform back behavior. This owner coordinates only by interfaces, never by editing backend files. |

The checked-in android/ TWA, root package.json, web source, and previous release artifact are preserved. The Expo foundation worker must not rewrite the root package scripts or move the TWA.

## Verification

Backend unit and route tests must cover:

- Opaque token length and entropy shape, Redis TTL, malformed and expired bearer, unknown bearer, idempotent sign-out, and inactive/deleted account rejection.
- Google native route exact body keys, same existing WEB audience mock, no cookie response, no account ID response, and Redis failure mapping.
- Challenge request validation, scene hash binding, one-use consumption, wrong install or operation, expired challenge, mismatched decoded request hash, wrong package, wrong certificate, unlicensed app, weak device verdict, and stale timestamp.
- Guest session same-install idempotence, existing two-use remaining count, invalid Integrity rejection, and no trial identity when the challenge is absent.
- Native generate missing or fake attestation rejection before reservation, valid attestation entering the existing paid or free path, invalid bearer rejection, guest IP/global limit behavior, and replay rejection.
- Play config and verify bearer success, fixed SKU, server-derived account binding, pending purchase, duplicate ledger claim, and deleted account.
- Existing web tests for cookie auth, BotID, free holds, paid concurrency, generation finalization, Play verification, Stripe checkout, and account deletion.

Build and local checks:

~~~bash
export DOODLE_ANDROID_TOOLS=/home/mests/.local/share/doodle-android-tools
export JAVA_HOME="$DOODLE_ANDROID_TOOLS/jdk-17.0.20.1+1"
export ANDROID_HOME="$DOODLE_ANDROID_TOOLS/android-sdk"
export PATH="/home/mests/.nvm/versions/node/v22.17.1/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

node --version
npx expo --version
npx expo doctor
npx expo run:android --variant debug
npm run typecheck
npm test -- --run
~~~

For a release candidate, with the existing external signing variables loaded:

~~~bash
cd mobile
npx expo prebuild
./android/gradlew :app:bundleRelease
~~~

The generated native application must declare package nl.samistudio.doodle and versionCode >= 2. Install a debug APK on the existing Windows emulator using its ADB port 5038 for UI verification. Use a Play-installed internal-track device for real Google Sign-In, Play purchase, and Integrity verification. No live purchase or deployment is part of local tests.

## External constraints

- Vercel BotID has no native React Native client in the installed package. A direct native call cannot fabricate its browser challenge.
- Play Integrity requires a linked Google Cloud project, enabled API, service-account authorization, Play app signing digest, Play Console configuration, and an app distributed through Google Play. These are deployment account gates, not code-only work.
- Google Sign-In requires Android OAuth clients for the package and every signing certificate used in debug, upload, and Play app-signing builds. The existing TWA package and release certificate do not automatically configure the native client.
- Expo IAP, Google Sign-In, sharing, and Integrity require a custom development or release build. Expo Go is insufficient.
- WSL local builds are the practical free path here. Expo documents Windows WSL local builds as possible but not officially tested or supported. Windows currently lacks the Java and ADB commands in the normal shell, while the documented isolated WSL toolchain is available.
- Play listing continuity requires the exact package nl.samistudio.doodle and a higher version code than the existing signed artifact (versionCode 1, versionName 0.1.0). Existing signing keys remain outside the repository.
- The iOS app can share the service and UI interfaces, but Apple team credentials, App Store setup, StoreKit verification, and App Attest are future gates. This migration makes no Apple publishing promise.
