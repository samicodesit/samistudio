# Dedicated Doodle app experience

Implemented September 7, 2026. The Android launch URL (`/?runtime=play`) and installed PWA display mode select a dedicated Create / Ideas / Settings workspace. `/?runtime=app` provides a browser preview of that layout without selecting Play billing.

## What changed

- Installed mode removes the website header, language dropdown, explanatory SEO sections and website footer.
- Create is focused on the scene field and its next action. The mobile website also receives smaller headings, better ordering and 48px controls.
- Ideas offers actual example drawings and fills the composer with the selected idea. Switching tabs preserves the current draft or generated drawing; selecting a new idea deliberately starts a new scene.
- Settings holds language selection and support/policy links. Language changes navigate to the selected locale. Signed-in account actions remain alongside the credit balance in Create.
- Bottom navigation uses browser history so Back can return between app tabs. Image/report dialogs retain native dialog cancellation behavior.
- Starting generation dismisses the textarea keyboard and resets the Create screen scroll. Background completion while browsing another tab leaves that tab's scroll alone.
- Dynamic viewport and safe-area spacing support smaller screens and keyboard resizing. Browser zoom remains enabled.
- The installed image viewer has a full-width Download action rather than the website's new-tab action.

## Screenshot provenance

`store-assets/phone-drafts/` contains 1080 x 1920 opaque RGB captures of the actual installed-mode interface, rendered in Chromium at 360 x 640 CSS pixels. Existing Doodle example drawings are replayed through local generation fixtures; no paid generation or real purchase is performed. The optional Settings capture is included in the preview gallery.

These are store screenshot drafts, not captures from a Play-installed Android app. Android toolbar/domain association, real keyboard/Back, file download/share and real Play transactions still require Android verification. The native emulator setup and its current download limitation are documented in `android-toolchain.md`.

## QA evidence

Browser checks cover desktop1440, mobile320/360/390, German and Arabic, draft/result retention across tabs, background completion, dialog focus restoration and a keyboard-sized viewport. The app workspace tests confirm that website navigation remains separate, Settings exposes language choices, Back restores Create, and selecting an idea fills the composer. Final command results and deployment status are recorded in the task delivery.

Final checks: 293 unit/integration tests passed (one paid live-generation test skipped), all 28 Playwright browser tests passed, ESLint and production build passed. The initial deletion browser-test failure was traced to a manually reused dev server without the configured test Google client ID; the unchanged test passed both alone and in the full suite with the correct test environment.

Deployed to production as Vercel `3fsdsnpQoJ4ysQnPNo5RXx8wu2rt`, aliased to `https://doodle.samistudio.nl/`. Final phone drafts were recaptured against the live `/?runtime=play` UI with local response fixtures and visually inspected after deployment. No real generation or purchase was performed by this verification.
