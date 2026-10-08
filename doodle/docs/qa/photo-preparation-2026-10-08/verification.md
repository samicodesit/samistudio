# Photo preparation verification

October 8, 2026. Local branch `codex/photo-input`. No deployment, store submission, paid generation or credit consumption in this review.

## Preparation policy

- Inspect actual file headers and dimensions before allocating pixels. Browser filename and MIME labels are not trusted. Android independently checks the private picker copy, byte size, decoded bounds and format.
- Maximum source: 20,000,000 bytes and 64,000,000 pixels. Browser non-JPEG and iOS fallback: 24,000,000 pixels because those paths may decode at full resolution. Oversized or damaged replacements preserve the current photo and show a localized error.
- Keep the entire aspect ratio. No crop or enlargement. Maximum prepared edge: 600 pixels. Maximum prepared binary payload: 512,000 bytes, with exact base64 padding accounting.
- Browser JPEG: read only EXIF orientation, request a proportional oriented ImageBitmap thumbnail, smooth canvas resize and JPEG quality 90. Always release the bitmap and canvas backing store.
- Android: system picker quality 1 uses Expo's raw-copy exporter. The local module uses the already installed Glide engine for sampled decoding and EXIF orientation, composites transparency onto white, then encodes JPEG quality 90 once. Preview and payload reference the same encoded file. Blocking decoding runs off the UI thread. Glide owns its pooled bitmap; only our output bitmap is recycled.
- iOS fallback: existing Expo ImageManipulator, WebP quality 90 with transparency preserved, no base64 in saveAsync, then one read of the saved output. Server composites onto white. SDK source confirms the iOS WebP encoder; device behavior remains unverified.
- The server independently validates and re-encodes the submitted image. Provider input has no source EXIF, GPS or ICC metadata. A browser canvas JPEG can contain a standard ICC profile locally; it does not contain source EXIF.
- Cancel leaves the previous photo unchanged. Failed, stale and unmounted preparations release their temporary files. Remove, replacement and unmount remove the prepared Android cache file. Abrupt process death can leave an OS-managed cache file.
- Android pending picker results use Expo's recovery API, with guards against replacing newer selections or generation. Font and display size changes are handled live by the Activity, preserving its picker registration. The rendered view remounts on changed font/display scale to refresh native text measurements while controller state persists.

JPG, PNG and WebP are the tested compatibility baseline. HEIC/HEIF and AVIF depend on the browser or installed Android codec and are not claimed universally supported. GIF is rejected by browser preparation. Animated submitted payloads are rejected server-side; local preparation produces a still image.

## Verification performed

| Surface | Evidence |
| --- | --- |
| Browser preparation unit tests | 12 passed. Actual JPEG/PNG header fixtures, all eight EXIF orientations, forged huge bounds, empty MIME, size bounds and failure cleanup. Bitmap/canvas boundaries are mocked in these tests. |
| Web composer integration | 4 passed, including corrupt and cancelled replacement preserving the old photo, text draft restoration and duplicate submit protection. |
| Server binary image tests | 21 passed. All eight EXIF orientations checked against explicit quadrant colors, portrait/landscape/panorama, small images, transparent PNG/WebP, CMYK, corrupt/truncated data, compressed oversized dimensions and animated WebP. |
| Native picker unit tests | 10 passed. Android bridge arguments, 48 MP acceptance, oversize/decode cleanup, pending recovery/stale discard and iOS fallback output handling. SDK boundaries are mocked. |
| Android graphics | 2 Robolectric tests passed with native graphics. White alpha compositing, small image preservation and tall aspect ratio. |
| Full web suite | 98 files passed, 678 tests passed, 1 paid-generation test skipped. |
| Full native suite | 17 files, 112 tests passed. An initial concurrent run hit the existing 10 ms API timeout test's real-clock timing assertion. The full native suite passed on a standalone rerun; that unrelated test was not modified. |
| Compilation | Web and native TypeScript passed. Web production build passed. Final fixture APK build passed, with the local module autolinked. |
| Lint | Changed preparation, controller and test files passed targeted ESLint. DoodleAppView has two pre-existing warnings; its pre-existing React Native static asset require was checked with the web-only no-require-imports rule disabled for that file. |
| Configuration | Expo config introspection and merged Android manifest retain fontScale/density handling. No broad photo, camera or microphone permission added. |
| Standard generation | All four standard generation source hashes still match the recorded fcd03f7 baseline. Neither standard nor photo prompts changed in this review. |

## Actual UI and output checks

Browser: actual local app in Chromium, desktop 1265 x 712 and mobile viewport 390 x 844. Used the real file chooser and actual preparation function. Rotated JPEG produced an oriented 400 x 600 image with the expected quadrant colors. A synthetic 8000 x 6000 JPEG produced a 600 x 450 preview. Transparent PNG produced white JPEG corner pixels. Damaged replacement preserved the current image and enabled Create. Encoded output was read back for dimensions, pixels and metadata. The 48 MP fixture is synthetic and does not establish real-world photo compression ratios or a performance benchmark.

Android: API 36 emulator, installed release-like fixture APK. Real Android picker, native preparation and preview exercised with the 48 MP JPEG, rotated JPEG and transparent PNG. The fixture simulates account, billing and generation only; these checks did not call the generation backend. Picker cancellation and an Activity-recreation exercise returned usable UI. Full process-death recovery was not proven end to end.

Changing text size originally reproduced an unregistered Expo ActivityResultLauncher error. After live configuration handling, picker launch and replacement worked after Settings-style background/resume at font scales 1.0, 1.1 and 1.4. A combined density change from 420 to 460 and font scale 1.4 preserved the selected photo, refreshed readable controls and left Change photo working. Restoring default density and font scale restored the normal side-by-side footer. All temporary emulator settings were restored.

No iOS device, Safari, physical Android, Play-installed integrity or real backend generation verification was performed in this review. Independent release review and Play-installed generation remain release gates. Preparation is local and adds no provider operation or generation charge. Test generation spend: $0.

## QA asset manifest

These are actual app captures with synthetic diagnostic input, reviewed for this preparation task. They are QA evidence, not approved marketing or gallery assets.

- `web-mobile-error.png`: actual 390 x 844 browser, transparent input retained after corrupt replacement.
- `web-desktop.png`: actual desktop browser, same retained preview.
- `android-photo.png`: final fixture app, transparent input on white, default font/display size, normal footer.
- `android-large-text.png`: final fixture app, font scale 1.4 and density 460, retained input and readable stacked controls.

## Authoritative guidance checked

Checked October 8, 2026: [Android sampled bitmap decoding](https://developer.android.com/topic/performance/graphics/load-bitmap), [Android runtime configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes), [MDN createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [Expo ImagePicker and pending results](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [Expo ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/), [Glide resource ownership](https://bumptech.github.io/glide/doc/resourcereuse.html), [OWASP file upload validation](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Sharp input validation](https://sharp.pixelplumbing.com/api-constructor/). Installed SDK sources were inspected for the raw picker copy, iOS WebP encoding and React Native live font metrics.
