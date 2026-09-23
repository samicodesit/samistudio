# Play Data Safety runtime evidence

**Checked:** 2026-09-08
**Scope:** static inspection of the already-resolved Billing 8.3.0 artifact, the shipped release AAB, the installed `botid` 1.5.11 package, and the two exact BotID provider assets fetched by read-only HTTP. No browser, emulator, network capture, dependency installation, challenge verification, or application-code change was used.

## Result

Billing diagnostics are directly evidenced in the resolved library and in the shipped AAB. This is an actual automatic transport path, rather than a conclusion based only on a transitive dependency or a hypothetical SDK capability. The path sends Billing events and Android/app/network metadata to Google's CCT/Firebase Logging endpoint.

BotID Basic is different. The installed package contains the wrapper that forwards challenge and verification requests, while the provider's `c.js` and `p.js` payloads are fetched at runtime. A bounded inspection of the live `c.js` positively shows anti-bot/browser/device signals and encrypted challenge telemetry; `p.js` is a larger custom-bytecode payload whose exact signal schema is not recoverable from a short static inventory. The exact Basic field list, retention, and provider-side use therefore remain unverified. Do not import claims about Deep Analysis.

## Billing artifact and release identity

| Evidence | Finding |
| --- | --- |
| [`android/billing/build.gradle:17`](../android/billing/build.gradle#L17) | Resolves `com.android.billingclient:billing:8.3.0`. |
| Gradle cache AAR | `/home/mests/.gradle/caches/modules-2/files-2.1/com.android.billingclient/billing/8.3.0/db89e11a0b3b2929b37eabcb6fd14beaefda1702/billing-8.3.0.aar`; SHA-256 `9810B5CD47E20BC82B354F3583C9D3BF7C42B33E64E192DCE0495D036A85F505`. |
| Cached CCT artifacts | `/home/mests/.gradle/caches/modules-2/files-2.1/com.google.android.datatransport/transport-backend-cct/3.1.8/cfd0b63e154b80207d36ef3199ae06c8fe088e5/transport-backend-cct-3.1.8.aar` and `/home/mests/.gradle/caches/modules-2/files-2.1/com.google.android.datatransport/transport-runtime/3.1.8/5632cd0e73a5e28a50761beae0b999ca8a3d69ce/transport-runtime-3.1.8.aar`; inspected without installing anything. |
| AAR POM | Billing declares `transport-api:3.0.0`, `transport-backend-cct:3.1.8`, `transport-runtime:3.1.8`, Play Services base/basement/location/tasks, and AndroidX activity. The POM alone is only dependency evidence; the bytecode and AAB checks below establish use and packaging. |
| Release AAB | [`android/app/build/outputs/bundle/release/app-release.aab`](../android/app/build/outputs/bundle/release/app-release.aab), SHA-256 `F7ADDF03B0E51394312E7C30A9B4D586A55205EA37A080C929D7F563F09314F5`. It contains `base/dex/classes.dex`, Billing raw resources, Billing properties, and the transport API/backend/runtime properties. |
| Release merged manifest | Contains `com.android.vending.BILLING`, `INTERNET`, and `ACCESS_NETWORK_STATE`, Billing proxy activities, and CCT transport discovery/scheduling components. It contains no `com.google.android.gms.permission.AD_ID`, `ACCESS_FINE_LOCATION`, or `ACCESS_COARSE_LOCATION` permission. |

The release app launches the hosted app with `/?runtime=play` (`android/app/build.gradle:25-26`). The source purchase routing sends Play runtime purchases through `purchasePlayPack`; Stripe is the web/non-Play checkout path and is outside this Android Billing evidence pass.

## Billing automatic telemetry

The following findings came from `javap -p -c` on the cached AAR's `classes.jar`; the release AAB string scan also retains the Billing logger and CCT transport markers.

### Transport construction and send

`com.android.billingclient.api.zzdn(Context)` does all of the following:

1. Calls `TransportRuntime.initialize(Context)` and obtains `TransportRuntime.getInstance()`.
2. Creates a CCT factory with `CCTDestination.INSTANCE`.
3. Calls `newFactory(...).getTransport("PLAY_BILLING_LIBRARY", zzkh.class, Encoding.of("proto"), new zzdm())` and stores the resulting `Transport`.
4. Its `zza(zzkh)` sends `Event.ofData(zzkh)` through `Transport.send(...)`; initialization and send failures are caught and logged.

`zzdm.apply(Object)` serializes the `zzkh` protobuf. `com.android.billingclient.api.zzdl` is the logger adapter: its `zza` through `zzk` methods construct `zzkh` records from Billing operation, result, timing, and exception messages and call `zzdn.zza(...)`.

The decoded default endpoint in the cached `transport-backend-cct:3.1.8` `CCTDestination` is:

```text
https://firebaselogging.googleapis.com/v0cc/log/batch?format=json_proto3
```

`CCTDestination.INSTANCE` is the destination passed by `zzdn`; it has no API key in this construction. `CctTransportBackend.decorate(EventInternal)` adds the Android/client metadata below, `getRequestBody(...)` builds the CCT envelope, and `doSend(HttpRequest)` posts a gzip-compressed request over `HttpURLConnection` with a 30 second connect timeout and 130 second read timeout.

The release merged manifest proves that this runtime is packaged: `TransportBackendDiscovery` names `com.google.android.datatransport.cct.CctBackendFactory`, and the AAB contains `JobInfoSchedulerService` and `AlarmManagerSchedulerBroadcastReceiver`. This closes the earlier "only a transitive transport capability" gap for Billing diagnostics.

### Event and metadata fields evidenced by bytecode

`com.android.billingclient.api.zzcy.zzb(...)` builds the Billing event from:

- `BillingResult.getResponseCode()`;
- `BillingResult.getDebugMessage()`;
- the nonzero `getOnPurchasesUpdatedSubResponseCode()`;
- an internal Billing operation code;
- an optional supplied string; and
- source/subsource values when present.

`zzcy.zza(Exception)` records the exception simple class name and message, truncating the resulting string to 40 characters. `zzcy.zzc(...)` builds operation/result records. `BillingClientImpl` calls these logging helpers from its operation-result, timing, and error paths (`zzbs`, `zzbt`, `zzbu`, `zzbv`, `zzbw`, `zzbx`).

The base `zzjr` record constructed by `BillingClientImpl` includes these values before each event is sent:

- Billing library version `8.3.0` and, when available, the Billing KTX version;
- application package name and application version code;
- Android SDK API level;
- a random `new Random().nextLong()` value held by the BillingClient instance;
- device brand, model, manufacturer, and build fingerprint;
- total memory in MB; and
- additional internal boolean/long fields whose generated protobuf names are obfuscated in this release.

The CCT backend decorates every request with further Android/client metadata: SDK version, model, hardware, device, product, build ID, manufacturer, fingerprint, timezone offset, active network type and mobile subtype, default country and language, SIM operator (`mcc_mnc`), and application build/version code. The request envelope also carries event time, uptime, timezone offset, network connection info, and the serialized event payload.

The random long is evidence of a value sent with Billing telemetry, but the inspected code does not establish it as a stable device identifier. No Advertising ID or Android ID is synthesized by the inspected Billing code, and the AAB manifest does not request `AD_ID`. The `play-services-location` POM dependency likewise does not establish location collection; no location permission or location call was found in the inspected Billing path.

### Console consequence

For the Billing path, the runtime evidence supports:

| Play category / handling | Bounded answer from runtime evidence |
| --- | --- |
| App info and performance → Diagnostics | **Collected: Yes. Shared: Yes, with Google**, because Billing events and the CCT request are constructed and sent automatically. The evidence covers operation results, errors, timings, app/library versions, and Android/device/network/runtime metadata. |
| Location | **Not evidenced by this Billing path.** The transitive location artifact is insufficient by itself, and the release manifest has no location permission. |
| Advertising ID | **Not evidenced.** The release manifest has no `AD_ID` permission and the inspected Billing classes do not call an Advertising ID API. |
| Device or other IDs | **Do not label this as Advertising ID or a stable device ID.** A random BillingClient-instance long is sent; whether the Console's “other IDs” category applies to that internal value is a Console categorization decision, not resolved by its obfuscated schema. |
| Required / optional | The source release uses Play Billing for the user-initiated Play purchase flow. Runtime inspection establishes the collection and sharing path, but it cannot by itself decide the product's Console required/optional answer for telemetry. |

"Shared with Google" here describes the observed network destination. Whether a particular Google processing arrangement qualifies for a Play service-provider exception is a separate terms/policy determination and is not silently assumed from this bytecode report.

## BotID Basic installed package

### Package and app integration

The installed package is `node_modules/botid`, version `1.5.11` (`package.json:3`), SHA-256 `753201E7C41F0B62685D290E3BB131533E384C5CC4198FEBCC092541B1D030C5`. The app integration is:

- [`src/instrumentation-client.ts:1-6`](../src/instrumentation-client.ts#L1): `initBotId` protects `POST /api/generate` and `POST /api/checkout`; no `advancedOptions.checkLevel` is supplied.
- [`next.config.ts:2,22`](../next.config.ts#L2): imports and applies `withBotId`.
- [`src/app/api/generate/route.ts:17,35-46`](../src/app/api/generate/route.ts#L17): calls `checkBotId()` before processing the request.
- [`src/app/api/checkout/route.ts:5,11-17`](../src/app/api/checkout/route.ts#L5): calls `checkBotId()` before checkout processing.

The installed package contains wrapper JS, declarations, README, and package metadata. It does **not** contain the provider-delivered `c.js` or `p.js` scripts referenced by the wrapper. The relevant wrapper files are minified single-line files; their hashes are recorded here so this limitation is reproducible:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `node_modules/botid/dist/server/index.js` | 6,886 bytes | `85D53C9E332D129936E55081277C2C687BF2EA33792DCAB77B2B7CCE9178005E` |
| `node_modules/botid/dist/client/core/index.mjs` | 6,264 bytes | `BBDDB2C5BD7B09A8489A1AC8DFB42D09A876351ADA66BB2BDCB49065F2569904` |
| `node_modules/botid/dist/next/config/index.js` | 1,108 bytes | `2967D41FF89950BDAF088227D878FAB376F763C044DFDAAF500676E963E7877F` |

### Concrete wrapper transfers

The package's Vercel base is `https://api.vercel.com/bot-protection`.

The client wrapper references a challenge script path under the generated project prefix and rewrites it to `/v1/challenge`. `getChallenge()` adds `i` (reload counter), `v=3`, and `h=window.location.host`. The client loads the provider `p.js` path, waits for `kpsdk-load`/`kpsdk-ready`, and wraps `fetch` and `XMLHttpRequest` for protected same-origin routes. The wrapper adds `x-is-human`, `x-path`, and `x-method` values to protected requests.

The server `checkBotId()` wrapper posts to:

```text
https://api.vercel.com/bot-protection/v1/is-bot?v=3
```

with an envelope equivalent to:

```json
{
  "url": "request URL",
  "method": "HTTP method",
  "headers": [["header-name", "header-value"]],
  "vercelOidcToken": "OIDC token",
  "forceCheckLevel": "basic or deepAnalysis when explicitly set",
  "extraAllowedHosts": "when configured"
}
```

The wrapper removes the incoming `authorization` header and retains only cookies whose names begin `KP_`; other request-context headers are forwarded as available to the hosting/runtime. It sends the OIDC token in the request body and `x-vercel-oidc-token` header. The provider response is exposed as classification fields including `isHuman`, `isBot`, `isVerifiedBot`, `verifiedBotName`, `verifiedBotCategory`, `bypassed`, and `classificationReason`.

The default project configuration does not set `advancedOptions.checkLevel`; the wrapper recognizes `basic` and `deepAnalysis`. The client contains a branch that loads KPSDK for an explicit deep-analysis setting or a provider challenge response, but that branch is not evidence that this project uses Deep Analysis.

### Live provider assets (read-only)

The exact runtime asset paths were taken from the installed wrapper's generated project prefix and fetched from the deployed Doodle host with ordinary HTTP GET requests. No challenge-verification or protected application request was sent.

| Asset | Response / route evidence | Size | SHA-256 |
| --- | --- | ---: | --- |
| `https://doodle.samistudio.nl/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js?i=0&v=3&h=doodle.samistudio.nl` | HTTP 200; `x-matched-path: /bot-protection/v1/challenge`; `content-type: text/javascript` | 24,403 bytes | `bc3138e3238a9b037a29a0a67c5ba44e62349d3968cc5fc08d1ef85f9a334204` |
| `https://doodle.samistudio.nl/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/p.js` | HTTP 200; `x-matched-path: /bot-protection/v1/proxy/[[...restpath]]`; `content-type: application/javascript; charset=utf-8` | 158,499 bytes | `e2c5ca57828593d9ed43e0e28022f40810d125483aea8265dfa7183185e1b490` |

Both fetched files pass `node --check`. The readable/decrypted portion of `c.js` contains browser-environment checks for automation/headless indicators, canvas/WebGL context access, WebGL vendor/renderer parameters, iframe/console-evaluation checks, and `navigator.userAgent` use for a headless test. It also uses Web Crypto PBKDF2/SHA-256 and AES-GCM to encrypt a JSON telemetry object before the challenge callback exposes it. The visible object includes anti-automation flags and WebGL-derived values, but its remaining short keys are not semantically identifiable from this bounded decode. The `p.js` asset is heavily obfuscated custom bytecode; its raw text exposes no readable field schema or endpoint payload names in this inventory.

The response headers include `Permissions-Policy: camera=(), microphone=(), geolocation=()`. That policy limits those browser capabilities for the asset response; it is not evidence that the provider collects no other browser or network signals. Conversely, no readable `c.js` literal positively evidenced UGC, prompt/doodle content, contacts, photos, clipboard, camera, microphone, or location collection. Because `p.js` is opaque and provider-side processing is outside the scripts, those absences are bounded observations rather than proof of non-collection.

The Console worker reports that the live Vercel team plan is **PRO**. Read together with the current [official Vercel DPA](https://vercel.com/legal/dpa) already cited in the final mapping, this removes the earlier hosting-plan prerequisite for the DPA analysis; it does not resolve BotID's opaque provider signal schema, retention, or processing role.

### BotID consequence and unresolved facts

The wrapper and live assets prove that protected requests and selected request-context/browser-environment data leave the app/server boundary for Vercel bot verification. The readable `c.js` portion positively evidences anti-automation and WebGL browser/device signals and encrypted telemetry. It does not establish the exact complete Basic field list, retention, or Vercel's provider-side storage/processing role; `p.js` remains opaque. The wrapper also does not itself synthesize a named stable ID, IP address, or full user-agent field; those may appear in forwarded request-context headers, but the exact values depend on the deployed runtime.

Accordingly, keep BotID's precise complete Play data-type, diagnostics, identifier, retention, and sharing declarations separately marked **unverified** until the opaque provider asset/response behavior or an authoritative current provider statement makes those fields and handling explicit. The live asset evidence supports keeping anti-bot/browser/device signals in the existing Device IDs and Diagnostics review, but it does not justify adding a new category from an unreadable payload. Do not import claims about Deep Analysis into this Basic integration.

## Bounded remaining items

1. **Billing runtime evidence is closed for the diagnostics Yes/shared-to-Google determination.** The old blocker that there was no method-specific public table should be removed; the AAR bytecode and shipped AAB establish the actual path.
2. **Billing legal/Console categorization remains separate:** service-provider treatment, exact retention, and whether the internal random value belongs in “Device or other IDs” cannot be decided from runtime bytecode alone.
3. **BotID Basic remains the concrete runtime unknown:** the live `c.js`/`p.js` assets are retrievable, but their provider signal schema is minified/obfuscated (`c.js` only partially decoded; `p.js` is opaque), and retention/provider-side handling are not stated in the assets. Anti-automation/browser/device signals are positively evidenced; no extra Play category is positively evidenced by readable code. This is the remaining BotID diagnostics/identifier categorization gap.

No tests were run because this is a report-only static evidence inventory. No browser or manual signup flow was accessed.
