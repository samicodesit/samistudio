# Combined Android and web release candidate

Prepared 8 October 2026 on `codex/photo-input`. Nothing deployed or published.

## Included

- Android 0.1.8 (10): approved 8-second pencil loop, smooth message roll every
  3 seconds, unchanged generous yellow waiting card, and clearer dashed 4x4 grid.
- Existing photo-to-doodle feature on web and Android, including local photo
  preparation, three detail levels, photo recovery copy and result Back.
- Removed the superseded pen animation and source archive. No new dependency
  for animation or grid. The pencil asset is 488,194 bytes before compression.
- Fixed sign-in/tab label clipping during live Android font-size changes.
- Updated the Data safety worksheet to declare optional, non-ephemeral Photos
  for app functionality. Existing privacy copy already covers the photo flow.

## Verification

- Native TypeScript and all 115 native tests passed on the final source.
- Production web build passed. Photo backend's 94 focused tests passed in the
  preceding review; backend source did not change during integration.
- All four protected text-generation hashes remain unchanged. Existing real
  photo outputs at all three detail levels were reviewed. No new provider spend.
- Fixture APK built and installed on API 36, 1080x2400, density 420. Actual system
  picker, prepared puppy preview, loading, result grid, Back preserving the
  selected photo and allowance, Remove, text input, and background/resume checked.
- Loading layout at font scale 1.4 inspected. Live and cold-start sign-in/tab
  labels inspected after the clipping fix. Font scale restored to 1.0.
- Emulator low storage initially prevented reinstall. A temporary storage
  threshold change allowed the disposable fixture reinstall; original setting
  restored. The production app and its data were untouched.
- Signed release bundle built, JAR signature verified, bundletool validation
  passed. Production package/version, API URL, fixture=false, both photo modules,
  blocked broad photo/camera/audio permissions, and four pencil images present
  exactly once verified directly in the bundle.

Final captures, video and build logs are retained outside the repository at
`C:/Users/Sami/.codex/visualizations/2026/10/08/01a11bb2-636a-7bb2-a0f1-58dae34dfbb7/combined-release`.
The captures and `native-loading.mp4` show the real native UI with simulated
account/billing/generation. The result is a fixed reference drawing, not a new
conversion of the selected photo. These are QA evidence, not marketing assets.

## Final artifact and release boundary

Signed AAB: `/home/mests/.local/share/doodle-android-tools/releases/doodle-0.1.8-v10-combined-upload-signed.aab`.
SHA-256: `428515c84cac36a9b111681ad786fe25c1a034b1778cd8a015400cc251f4c310`.
Version code 10 was confirmed unused in Play. The complete multi-architecture
AAB is 56,578,944 bytes; this is not a per-device download-size measurement.

Ready for internal release testing. Owner approval is required to deploy the
compatible web/backend, save the Photos declaration and upload this bundle to
Play internal testing. Then verify real text and photo generation from the
Play-installed build before public rollout. Independent final release review
and Play-installed end-to-end verification remain pending. Native iOS and
universal HEIC/AVIF support are not claimed.
