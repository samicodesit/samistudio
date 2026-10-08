# Photo preparation: WebKit verification

Date: October 8, 2026. Local branch `codex/photo-input`. No deployment, store submission or paid provider call in this round.

## Scope and result

24 browser checks passed: six cases on each of three Windows WebKit profiles and a Linux Chromium reference profile. Current Playwright WebKit 26.5 (revision 2336) was used because Ubuntu 20.04 offers an older frozen WebKit build. Profiles: iPhone SE (375 x 667), iPhone 13 (390 x 844), iPhone 13 Pro Max (428 x 926), and Pixel 5 Chromium.

This tests the website with mobile viewport, touch and browser emulation. It does not test iPhone hardware, Apple's shipped Safari build, the operating system photo picker, HEIC support or a native iOS app. Doodle's current native release target is Android. Native iOS verification is not an Android release gate.

Coverage includes actual decoded pixels for all eight EXIF rotations/mirrors; proportional preparation of a synthetic 48 MP JPEG; transparent PNG flattened onto white; an extreme aspect ratio; small WebP without enlargement; preserving the chosen detail level; cancel and corrupt replacement; Remove returning to the saved writing draft and focus; IndexedDB draft restoration after reload; oversized input rejection; and the actual Create request carrying only the prepared image and selected detail. The submission response was mocked as a recoverable 502 error to verify retained photo/detail state without a funded request.

The dedicated test configuration blocks service workers so browser API interception remains reliable. The existing offline/PWA suite owns service worker behavior. Initial harness failures were caused by an ambiguous Next.js route-announcer selector, interaction before hydration, and WebKit service worker interception. One local generation request reached the dummy-key dev server during diagnosis and was rejected with HTTP 403 before provider access. No app protections or production behavior were changed to make these tests pass.

## Local performance and payload

Five public photos from the earlier approved experiment, plus a synthetic 48 MP JPEG, were prepared three times per browser profile: 72 measurements in total. Timing starts at file-input change and ends when React shows the prepared preview and clears its busy state. It excludes the system picker, upload and provider generation. These measurements use a desktop CPU, not phone performance.

| Profile | Five real photos, range | Real-photo median | Synthetic 48 MP, range |
| --- | --- | --- | --- |
| WebKit, iPhone SE viewport | 65-121 ms | 78 ms | 262-281 ms |
| WebKit, iPhone 13 viewport | 82-119 ms | 96 ms | 296-331 ms |
| WebKit, large iPhone viewport | 72-126 ms | 115 ms | 292-347 ms |
| Chromium reference on Linux | 21-39 ms | 28 ms | 175-310 ms |

Real-photo JPEGs were 34,780-71,777 bytes; the actual JSON body including base64 was 46,411-95,739 bytes. Real-photo JPEG byte counts matched between engines. The flat-color synthetic image is useful for large-dimension decoding, not representative compression ratios for camera photos. The platforms differ, so these figures are not a controlled browser speed comparison.

The actual server normalizer was also run locally five times on each real prepared photo. Its 25 calls took 6.1-13.1 ms, preserved dimensions, and removed EXIF/ICC metadata. Re-encoding produced only a small pixel difference (per-channel RMS 0.17-0.82 on a 0-255 scale). This is image fidelity evidence, not a recognition accuracy score. See [raw measurements](preparation-metrics.json).

## Cost, speed and recognition decision

Keep the existing 600px maximum edge, no crop or enlargement, and JPEG quality 90. All five final server-normalized images were visually inspected: faces, animal markings, pose, two-subject separation and the coffee cup remain legible. This preparation resolution was also used in the earlier live conversion experiments. Do not reduce resolution or quality solely to save a few upload bytes without testing the effect on actual doodles.

Keep one Flare MEDIUM image-edit request per doodle, one output and no automatic paid retries. Simple, Medium and Detailed control drawing complexity; provider quality remains MEDIUM for all three. There is no separate paid caption or recognition pass. Browser preparation and server normalization do not consume image-generation tokens. JPEG file size alone does not establish billed input token count.

The previous [live provider ledger](../photo-input-2026-10-08/flare-live/live-generation.json) recorded three conversions at $0.022612-$0.023677 each and 11.680-21.243 seconds end to end. The earlier v3 prompt experiment had a 12.198-second median across 17 calls. These are small historical samples, not new measurements, invoices or a latency guarantee. Current published Flare rates remain $5/M text input tokens, $8/M image input tokens and $30/M image output tokens. This round added $0 in provider charges.

Actual recognition quality is supported by the earlier live outputs, not by this mocked browser suite. Known limitations remain: Simple portraits can retain a prominent background object, small details may be omitted, and the model may invent a decorative heart or complete an occluded paw. Exact likeness and perfect subject extraction are not promised. Both standard and photo generation prompts are unchanged in this round. The four baseline standard-generation hashes were rechecked before commit.

## QA asset manifest

These assets are current QA evidence only, not approved marketing artwork. All eight images were visually inspected in this round.

| Files | Provenance and purpose |
| --- | --- |
| `iphone-375-photo.png`, `iphone-390-photo.png`, `iphone-428-photo.png` | Actual local app composer captures in WebKit at the three profile widths. Synthetic yellow/red 48 MP fixture selected. Cropped composer evidence, not full-page screenshots or live generation results. Controls fit without horizontal overflow. |
| `portrait-provider-input.jpg`, `coffee-provider-input.jpg`, `cat-provider-input.jpg`, `woman-dog-provider-input.jpg`, `two-dogs-provider-input.jpg` | Actual output of the server normalizer applied to browser-prepared versions of the five previously approved public research downloads. Subject names retain the earlier experiment labels. Original URLs/provenance remain in that experiment's asset manifest. These are inputs, not generated doodles. |
| `preparation-metrics.json` | All 72 browser samples and 25 local server-normalization measurements. No original photo bytes or base64 request content in the JSON. |

Permanent synthetic fixtures and their generator live in `e2e/fixtures/photo`. Browser cases live in `e2e/photo-preparation.spec.ts`; the dedicated matrix is `playwright.photo.config.ts`. The optional public-photo benchmark requires `PHOTO_BENCHMARK_INPUT_DIR` pointing at the existing experiment inputs. Other cases run without that directory.

## References checked October 8, 2026

- [Playwright browser support](https://playwright.dev/docs/browsers) and [device emulation](https://playwright.dev/docs/emulation).
- [Flare model, supported quality and token pricing](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation).
