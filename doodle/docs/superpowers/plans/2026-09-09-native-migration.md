# Doodle native migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a native Expo Android client boundary that preserves Doodle's existing account, two-use trial, BotID web protection, generation accounting, and Play credit ledger, with shared iOS-capable service interfaces. iOS build, signing, auth, and StoreKit verification remain unverified and unconfigured.

**Architecture:** Keep the Next web app and TWA in place. Add a mobile/ Expo project with a platform adapter. Add a Redis-backed opaque native bearer session and a replay-bound Play Integrity gate to the existing server routes. Native Play purchases call the existing server Publisher verification and ledger code.

**Tech Stack:** Expo SDK 57.0.21, React Native 0.86, Node 22.17.1 or newer within the SDK floor, TypeScript, Next Route Handlers, Redis REST, google-auth-library, expo-secure-store, expo-iap, expo-file-system, expo-sharing, and native Google Sign-In.

**Spec:** docs/superpowers/specs/2026-09-09-native-migration-design.md

## Global Constraints

- Preserve the existing web frontend, root package scripts, Android TWA, and signed release artifact.
- Create all native code under mobile/; do not modify mobile/ from backend tasks.
- Preserve Android package nl.samistudio.doodle and set native release versionCode to at least 2.
- Keep the web POST /api/generate BotID sequence unchanged; native proof is a separate fail-closed branch.
- Never accept a client account ID, client obfuscated account ID, fake x-is-human header, query token, embedded secret, or generic self-proxy.
- Reuse verifyGoogleCredential, createOrGetGoogleAccount, isPaidAccountActive, the existing trial Redis scripts, and the existing Play credit and purchase ledger.
- Native trial requests remain limited to two finalized uses, ten-minute holds, and the existing 20-client and 200-global guest rate limits.
- Native Play purchase requests use product doodle_credits_10 and finish a consumable only after /api/play/verify grants or confirms it.
- Native JSON responses use Cache-Control: no-store and must not log credentials, bearer tokens, trial tokens, purchase tokens, Integrity tokens, or provider responses.
- NATIVE_ATTESTATION_ENABLED defaults to disabled. Production native generation and guest bootstrap fail closed without verified Play Integrity configuration.
- Use the documented WSL local toolchain and do not use paid EAS builds or live purchase tests.
- Do not reset, revert, stash, or commit unrelated files in the dirty checkout. Stage only owned files if a commit is later requested.

---

### Task 1: Add shared native request parsing and opaque sessions

**Files:**
- Create: src/lib/native-contracts.ts
- Create: src/lib/native-session.ts
- Create: src/lib/native-session.test.ts
- Modify: src/lib/auth/session.ts

**Interfaces:**
- Produces readNativeJson(request: Request, maxBytes: number): Promise<Record<string, unknown>>.
- Produces hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean.
- Produces getNativeBearer(request: Request): string | null | undefined, where undefined means no Authorization header, null means a present malformed header, and a string is a valid 32-byte base64url token.
- Produces createNativeSession(user: SessionUser): Promise<{ accessToken: string; expiresAt: number }>.
- Produces revokeNativeSession(request: Request): Promise<void>.
- Extends getCurrentUser(request?: Request): Promise<SessionUser | null> without changing no-argument cookie behavior.

- [ ] **Step 1: Add failing session and parser tests**

Test the exact body-size limit, extra-key rejection helper, malformed bearer, 42-character and 44-character bearer rejection, opaque token shape, Redis SET EX 2592000 NX, Redis lookup, Redis DEL, no cookie fallback after a malformed bearer, and inactive-account rejection. Mock only next/headers, @/lib/billing/credits, and redisCommand.

Run:

~~~bash
npm test -- --run src/lib/native-session.test.ts
~~~

Expected: the new test file fails because the parser, bearer, and session functions do not exist.

- [ ] **Step 2: Implement bounded JSON and bearer helpers**

Read content-length before reading the body, reject a declared or actual UTF-8 body over the limit with a typed error, parse one JSON object, and reject arrays, null, malformed JSON, and non-object values. Implement:

~~~ts
export function getNativeBearer(request: Request): string | null | undefined {
  const value = request.headers.get("authorization");
  if (value === null) return undefined;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
  return match?.[1] ?? null;
}
~~~

Use a 32-byte random token encoded with toString("base64url"), which is 43 characters.

- [ ] **Step 3: Implement Redis-backed native sessions**

Store only JSON.stringify({id,identityKey,email}) at doodle:auth:native:<sha256(token)> with SET key value EX 2592000 NX. Retry a collision with a fresh token. Treat a non-string or malformed stored value as absent. getCurrentUser(request) must select bearer auth when an Authorization header is present, never fall back to cookies for that request, and call isPaidAccountActive(id) before returning the user. No-argument calls continue reading the signed doodle_session cookie.

- [ ] **Step 4: Verify the focused tests**

Run:

~~~bash
npm test -- --run src/lib/native-session.test.ts src/lib/auth/session.test.ts
~~~

Expected: PASS, including the existing cookie session tests.

### Task 2: Implement Play Integrity configuration, challenge storage, and verdict decoding

**Files:**
- Create: src/lib/native-attestation.ts
- Create: src/lib/native-attestation.test.ts
- Create: src/app/api/native/config/route.ts
- Create: src/app/api/native/attestation/challenge/route.ts
- Create: src/app/api/native/attestation/challenge/route.test.ts

**Interfaces:**
- Produces getNativeAttestationConfig(): NativeAttestationConfig | null.
- Produces createNativeChallenge(input: { operation: "guest" | "generate"; installId: string; sceneHash: string | null; principal: string }): Promise<NativeChallenge>.
- Produces consumeNativeAttestation(input: { operation: "guest" | "generate"; installId: string; sceneHash: string | null; principal: string; challenge: string; integrityToken: string }): Promise<"verified" | "unavailable" | "invalid">.
- NativeChallenge is { challenge: string; requestHash: string; expiresAt: number }.
- /api/native/config returns the NativeConfigResponse from the spec.
- /api/native/attestation/challenge returns the NativeChallengeResponse from the spec.

- [ ] **Step 1: Add config and challenge tests**

Cover disabled config, malformed enabled config, valid service-account shape, wrong certificate digest representation, missing cloud project number, invalid install ID, missing scene hash for generate, extra body keys, challenge TTL and NX storage, and the stable request hash. Mock redisCommand and GoogleAuth.

Run:

~~~bash
npm test -- --run src/lib/native-attestation.test.ts src/app/api/native/attestation/challenge/route.test.ts
~~~

Expected: FAIL because no verifier or route exists.

- [ ] **Step 2: Implement fail-closed configuration**

Read NATIVE_ATTESTATION_ENABLED exactly. When it is not true, return null. When enabled, require numeric PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER, either a valid service-account JSON value in PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON or the explicit billing-credential opt-in, and at least one base64 digest in PLAY_INTEGRITY_CERTIFICATE_SHA256. Construct GoogleAuth with scope https://www.googleapis.com/auth/playintegrity. If the dedicated variable is absent, allow GOOGLE_PLAY_SERVICE_ACCOUNT_JSON only when PLAY_INTEGRITY_USE_PLAY_BILLING_CREDENTIALS is exactly true and parsed project_id and client_email match doodle-506308 and doodle-play-billing@doodle-506308.iam.gserviceaccount.com. Reject all mismatches and never silently fall back to a Publisher credential.

- [ ] **Step 3: Implement request-hash-bound challenges**

Generate a 32-byte base64url challenge and compute:

~~~ts
const requestHash = createHash("sha256")
  .update(JSON.stringify({ challenge, operation, installId, sceneHash, principal }))
  .digest("base64url");
~~~

Before allocating the challenge key, apply cheap Redis issuance counters: 20 per client and operation per UTC day, plus 200 globally per UTC day. Use an HMAC of the normalized source IP for the client counter, with no raw IP in Redis. Return 429 for a counter limit and 503 when the limiter is unavailable. These counters are separate from generation quotas.

Store the exact challenge record at doodle:native:attestation:<sha256(challenge)> with SET NX EX 300. Challenge creation must require bearer authentication or a valid signed trial token for generate. Store the principal binding with the challenge and use a Lua compare-and-delete to consume a matching record exactly once after both valid and invalid provider verdicts. Leave it for retry only when the provider is unavailable, and let the five-minute expiry remove abandoned records.

- [ ] **Step 4: Decode and validate the Google verdict**

Call:

~~~text
POST https://playintegrity.googleapis.com/v1/nl.samistudio.doodle:decodeIntegrityToken
{"integrity_token":"<opaque token>"}
~~~

Use the GoogleAuth client request with a 15-second timeout. Read tokenPayloadExternal as the object returned by the Play Integrity API, and reject missing or non-object responses. Configure certificate digests in the URL-safe base64 representation returned by the verdict. Require matching requestDetails.requestPackageName, matching requestDetails.requestHash, a fresh timestamp inside the five-minute challenge window, PLAY_RECOGNIZED, exact package name, configured certificate digest, LICENSED, and MEETS_DEVICE_INTEGRITY. Return invalid for verdict mismatch and unavailable for credentials, network, or response failures. Diagnostic logs may record only boolean check outcomes and transport error codes. Do not log tokens, hashes, credentials, prompts, or response bodies.

- [ ] **Step 5: Verify attestation tests**

Run:

~~~bash
npm test -- --run src/lib/native-attestation.test.ts src/app/api/native/attestation/challenge/route.test.ts
~~~

Expected: PASS, including wrong package, request hash mismatch, replay, stale timestamp, wrong certificate, unlicensed app, and weak device verdict.

### Task 3: Add native Google auth, guest bootstrap, and sign-out routes

**Files:**
- Create: src/lib/native-guest.ts
- Create: src/lib/native-guest.test.ts
- Create: src/app/api/native/auth/google/route.ts
- Create: src/app/api/native/auth/google/route.test.ts
- Create: src/app/api/native/auth/sign-out/route.ts
- Create: src/app/api/native/auth/sign-out/route.test.ts
- Create: src/app/api/native/session/guest/route.ts
- Create: src/app/api/native/session/guest/route.test.ts
- Modify: src/lib/generation/free-allowance.ts

**Interfaces:**
- POST /api/native/auth/google accepts {credential:string} and returns {authenticated:true,email,accessToken,expiresAt}.
- POST /api/native/auth/sign-out accepts a bearer and returns 204.
- POST /api/native/session/guest accepts {installId,challenge,integrityToken} and returns {trialToken,expiresAt,freeRemaining}.
- getTrialIdentity(request) accepts the existing cookie or a signed X-Doodle-Trial-Token header.
- signedTrialToken(identity) returns the existing UUID plus HMAC representation.

- [ ] **Step 1: Add route tests**

Test exact origin, body limits, exact keys, invalid Google credential, Google account mapping, no response cookie, no account ID in the response, Redis failure, idempotent sign-out, invalid Integrity, same-install guest identity reuse, two-use remaining value, and missing challenge rejection.

Run:

~~~bash
npm test -- --run src/app/api/native/auth/google/route.test.ts src/app/api/native/auth/sign-out/route.test.ts src/app/api/native/session/guest/route.test.ts
~~~

Expected: FAIL because the routes and guest service do not exist.

- [ ] **Step 2: Implement native Google auth**

Run the existing verifyGoogleCredential, then createOrGetGoogleAccount, then createNativeSession. Return only email, token, and expiry with Cache-Control: no-store. Map invalid credentials to 401 and all account, Redis, or token-store failures to 503. Keep the existing /api/auth/google cookie route untouched.

- [ ] **Step 3: Implement signed native trial identity**

Read or create one UUID under doodle:native:trial:<sha256(installId)> with SET NX EX 31536000. Return the existing signed doodle_trial value using a new exported helper from free-allowance.ts. Add X-Doodle-Trial-Token as an input to getTrialIdentity, while preserving cookie precedence for web requests and validating the HMAC before use.

- [ ] **Step 4: Implement guest bootstrap and sign-out**

Guest bootstrap must first consume a guest challenge and only then create or load the installation identity. It must not issue an identity when Integrity is unavailable or invalid. Sign-out deletes the hashed bearer key and returns 204 for absent or already-deleted tokens. Set no cookies from native routes.

- [ ] **Step 5: Verify auth and guest tests**

Run:

~~~bash
npm test -- --run src/app/api/native/auth/google/route.test.ts src/app/api/native/auth/sign-out/route.test.ts src/app/api/native/session/guest/route.test.ts src/lib/native-guest.test.ts
~~~

Expected: PASS.

### Task 4: Integrate bearer sessions and native attestation with shared routes

**Files:**
- Modify: src/app/api/account/route.ts
- Modify: src/app/api/generate/route.ts
- Modify: src/app/api/play/config/route.ts
- Modify: src/app/api/play/verify/route.ts
- Create or modify: corresponding existing route tests

**Interfaces:**
- Existing web response shapes and error codes remain unchanged.
- Shared handlers call getCurrentUser(request).
- Native generation uses the existing binary PNG response and remaining headers.

- [ ] **Step 1: Add regression tests before route edits**

Add cases for valid native bearer account lookup, malformed bearer with no cookie fallback, account deletion revoking the bearer, Play config and verify deriving the binding from the bearer, missing native proof before any reservation, invalid challenge replay, valid paid native proof, valid guest native proof, and unchanged web BotID behavior.

Run:

~~~bash
npm test -- --run src/app/api/account/route.test.ts src/app/api/generate/route.test.ts src/app/api/play/config/route.test.ts src/app/api/play/verify/route.test.ts
~~~

Expected: the new native cases fail while existing web cases pass.

- [ ] **Step 2: Pass the request into shared user lookup**

Change only the calls needed for bearer support:

~~~ts
const user = await getCurrentUser(request);
~~~

Keep no-argument callers working. On successful account deletion, revoke a native bearer and continue expiring the web cookie. Account GET may continue setting a cookie for web; native clients ignore it and use their explicit trial token.

- [ ] **Step 3: Add the native generation branch**

For X-Doodle-Client: native-android, parse and normalize the scene, require the exact install, challenge, Integrity token, and either a valid bearer or signed trial token, derive account or trial principal, then call consumeNativeAttestation with that principal. Return native_generation_unavailable before reservation for unavailable configuration and native_attestation_required or native_attestation_failed for missing or invalid proof. After proof, enter the existing paid or guest reservation, rate limit, generation, and finalization code. Do not call BotID for a verified native branch because the branch has an independent server-verified Play Integrity control. Any non-native request keeps the original same-origin, BotID, parse, reservation sequence.

When a native bearer has no reservable paid credit, return payment_required without creating a new trial identity. A guest native request must carry the signed trial header and has no cookie fallback.

- [ ] **Step 4: Keep Play verification unchanged except for bearer selection**

Pass the request to getCurrentUser. Continue deriving expectedObfuscatedAccountId with playAccountId(user.id), checking doodle_credits_10, querying Google Publisher, claiming the idempotent ledger, and returning pending status without finishing a client transaction. Do not add a native account ID field.

- [ ] **Step 5: Run the route and web regression suite**

Run:

~~~bash
npm test -- --run src/app/api/account/route.test.ts src/app/api/generate/route.test.ts src/app/api/play/config/route.test.ts src/app/api/play/verify/route.test.ts src/lib/auth/session.test.ts src/lib/generation/free-allowance.test.ts src/lib/billing/play-purchase.test.ts
~~~

Expected: PASS, including all pre-existing web cases.

### Task 5: Foundation handoff for the Expo client

**Files owned by the foundation worker:**
- Create: mobile/package.json
- Create: mobile/app.json or mobile/app.config.ts
- Create: mobile/tsconfig.json
- Create: mobile/src/contracts/backend.ts
- Create: mobile/src/platform/api-client.ts
- Create: mobile/src/platform/session-store.ts
- Create: mobile/src/platform/attestation.ts
- Create: mobile/src/platform/billing.ts
- Create: mobile/src/platform/media.ts
- Create: mobile/src/assets/fonts/**
- Generated: mobile/android/**

**Interfaces:**
- NativeApi and NativeBilling implement the interfaces in the design spec.
- API requests always send the canonical Origin and the stored bearer or signed trial header.
- NativeBilling calls /api/play/config and /api/play/verify; it never calls a web Stripe route.

- [ ] **Step 1: Scaffold with the stable SDK**

From the WSL toolchain, create mobile/ with Expo SDK 57.0.21. Add only expo-iap, expo-secure-store, expo-file-system, expo-sharing, expo-localization, and the current @react-native-google-signin/google-signin package through npx expo install. Use a config plugin and a custom development build. Do not use Expo Go for native auth or billing.

- [ ] **Step 2: Implement bearer and installation persistence**

Store the opaque access token and a random installation UUID in SecureStore. Clear the bearer on sign-out, account deletion, invalid-account response, and explicit local cleanup. Never put tokens in AsyncStorage, logs, URLs, or analytics.

- [ ] **Step 3: Implement Google Sign-In and API client**

Configure the native Google package with the existing WEB client ID. Post the returned idToken to /api/native/auth/google. Use shared account and Play routes with bearer auth. Use guest challenge, Integrity provider, and guest bootstrap only when /api/native/config says enabled.

- [ ] **Step 4: Implement IAP lifecycle**

Call initConnection, register purchase listeners before requestPurchase, fetch the fixed SKU, pass the server-returned obfuscated account binding using the installed expo-iap request type, verify server-side, and call finishTransaction({purchase,isConsumable:true}) only after a granted or already_granted response. Retry pending and unavailable purchases on foreground. Do not finish or grant from client price or token data.

- [ ] **Step 5: Implement image staging and share**

Write PNG bytes to the FileSystem cache directory, expose a local URI to the UI, and call expo-sharing with that URI. Keep download and share outside screen components. Delete stale cache files when replaced.

### Task 6: Native UI and integration

**Files owned by the UI worker:**
- Create: mobile/src/ui/**
- Create: mobile/src/ui/assets/**
- Modify only through the integration owner: mobile/App.tsx and mobile/src/app/**

**Interfaces:**
- UI consumes NativeDoodleUiProps from docs/superpowers/specs/2026-09-09-native-ui-contract.md.
- UI does not import fetch, SecureStore, Google Sign-In, expo-iap, or attestation.
- Integration maps NativeApi, NativeBilling, and NativeMedia results into resolved UI state.

- [ ] **Step 1: Implement the presentation contract**

Build Create, Ideas, Settings, account, purchase, report, delete, larger-image, waiting, error, and result states using the existing tokens, fonts, copy, and action hierarchy. Keep the yellow waiting card and rotating in-card messages.

- [ ] **Step 2: Wire app integration**

Compose the UI with the foundation adapters. Preserve draft and result state across tabs, keep account discoverable, refresh account after generation and purchase, and show unavailable generation when native config is disabled. Do not manufacture a successful result for a blocked backend call.

- [ ] **Step 3: Verify visual and accessibility states**

Check 320, 360, and 390 dp portrait, the documented landscape widths, keyboard behavior, platform back, reduced motion, Arabic RTL, focus restoration, account deletion confirmation, and all result actions.

### Task 7: Verification and release evidence

**Files:**
- Read: docs/android-toolchain.md
- Read: docs/android-test-plan.md
- Read: docs/play-billing.md
- Read: docs/superpowers/specs/2026-09-09-native-migration-design.md
- No source edits in this task unless a failing owned test identifies a defect.

- [ ] **Step 1: Run backend checks**

~~~bash
npm run typecheck
npm test -- --run
~~~

Expected: typecheck and the full Vitest suite pass with all existing web tests.

- [ ] **Step 2: Build the Android debug app locally**

~~~bash
export DOODLE_ANDROID_TOOLS=/home/mests/.local/share/doodle-android-tools
export JAVA_HOME="$DOODLE_ANDROID_TOOLS/jdk-17.0.20.1+1"
export ANDROID_HOME="$DOODLE_ANDROID_TOOLS/android-sdk"
export PATH="/home/mests/.nvm/versions/node/v22.17.1/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npx expo doctor
npx expo prebuild
npx expo run:android --variant debug
~~~

Install the resulting APK on the existing Windows emulator with its ADB port 5038. This validates UI and local API wiring only. The emulator or a debug APK is not evidence of Play billing or Play Integrity success.

- [ ] **Step 3: Build a signed release candidate**

~~~bash
cd mobile
./android/gradlew :app:bundleRelease
~~~

Load the existing external signing environment, assert applicationId nl.samistudio.doodle, and assert versionCode >= 2. Keep the generated artifact outside the old TWA release path until root accepts it.

- [ ] **Step 4: Record external acceptance evidence**

On a Play-installed internal-track build, verify Android OAuth package and signing certificate, Google native login maps to the same email/account and retained credit balance, Play product purchase claims exactly ten credits, duplicate callbacks remain idempotent, pending consumption recovers, account deletion revokes all bearer sessions, and a fresh Integrity token matches package, certificate, license, device, and request hash. Report missing Cloud, Play Console, OAuth, signing, or Apple credentials as external constraints. Do not claim a real transaction or native generation before these checks pass.

The shared dirty checkout is not a reason to reset or clean unrelated work. Root should review only the owned file set and test evidence.
