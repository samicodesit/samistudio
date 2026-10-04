# Browser failure resolution, October 4, 2026

The complete production-build Chromium suite passed: 81 tests, zero failures, zero retries. Web/backend unit and Redis integration tests passed: 613 tests, with one paid provider test deliberately skipped. Native unit tests passed all 101 cases, including localization, and native TypeScript passed. Web TypeScript, the Webpack production build and ESLint passed. ESLint reported the two existing image-element warnings in `card-composer.tsx`.

## Baseline and root causes

All six originally reported failures reproduced against source baseline `dcf3529`. The isolated baseline checkout was built with the test Google client ID, with fixture generation/account responses where the tests provide them. Its focused run returned ten passes and the same six failures. The ten 320 px locale checks passed on that baseline. See [baseline evidence](browser-baseline.json).

| Original failure | Cause and resolution |
| --- | --- |
| Create, download, redraw and new scene | Public landing has suggestion chips with short labels and full scene values, plus a different reference image. Update the assertions to exercise those actual controls, preserve the complete workflow and explicitly hold the first fixture response while checking loading. |
| Refusal, timeout and temporary errors | Old test hardcoded the installed composer's 220 px error width on the public landing. Verify visible errors, retained scenes and viewport bounds instead. |
| Cancelled checkout | Old assertion hardcoded port 3100, although the isolated server used another port. Derive the expected return URL from the configured base URL and make the server port configurable. The full final run used 3122. |
| Desktop keyboard access | Old assertion required a superseded 1180 px landing width and omitted newer public controls. Verify centering and a single column, then check every actual top-level composer control in Tab order with visible focus. |
| Mobile result controls | Old test expected removed trial copy. Verify current balance copy and retain touch-target and result viewport checks. Run both public web and installed web at 320, 360 and 390 px. |
| Installed heading before hydration | A real existing initial-render defect: explicit app/runtime URLs initially rendered the public landing until a client effect ran. Pass the allowlisted runtime state from both server routes into the workspace. Confirm installed markup without JavaScript in all ten languages, for both `play` and `app`. Plain web requests retain the public landing. |

The wider feature rerun also exposed eight cramped hints at 320 px beside the drawer. These failures did not occur on the baseline. Shorten the existing translations without changing their purpose or generation prompts. All ten languages now meet the original hint-height and spacing checks at 320, 390 and 1280 px. The drawer's geometry and motion are unchanged.

## Commands and limits

```sh
NEXT_PUBLIC_GOOGLE_CLIENT_ID=playwright-google-client-id OPENAI_API_KEY=test-key-not-used-because-generation-is-mocked SESSION_SECRET=test-session-secret-with-at-least-32-characters npm run build -- --webpack
npm test
PLAYWRIGHT_PRODUCTION=1 PLAYWRIGHT_PORT=3122 npm run test:e2e -- --workers=2
npm run lint -- --ignore-pattern .qa-browser-baseline/
npm run typecheck -- --project .qa-typecheck.json
```

The temporary typecheck configuration extends the repository configuration unchanged and excludes only the disposable baseline checkout in addition to the existing `node_modules` and `mobile` exclusions. Automatic approval review rejected removing that temporary checkout, so it remains local and untracked. Its generated build files are not product source. The required build's own TypeScript check also passed.

The final run had no browser failures or retries. A local account endpoint without Redis reported expected infrastructure errors for tests that do not mock it and for the separate visual review. This is not a live production backend check. Generation, payment and authentication browser workflows use fixture responses. No provider calls, production deployment or store publication occurred.

## Visual evidence and next hero pass

Current browser captures were saved and inspected using the in-app browser. They are UI layout evidence, not marketing deliverables. Their [manifest](browser-resolution/manifest.json) records provenance, hashes and review status. The local account endpoint was unavailable, so these captures show the existing generic free-trial fallback rather than a verified balance.

- [Installed English, 320 px](browser-resolution/app-en-320.png)
- [Installed French, 320 px](browser-resolution/app-fr-320.png)
- [Installed Arabic, 320 px](browser-resolution/app-ar-320.png)
- [Public web, 1280 px](browser-resolution/web-en-1280.png)
- [Public web, 390 px](browser-resolution/web-en-390.png)

The owner requested a cleaner hero across languages and explicitly wants the new drawer retained. Current public web has a large introductory headline, a second composer question, and an empty column beside the drawer. The installed layout gives its helper copy very little width. A proposed next pass should simplify that hierarchy, keep helper wording compatible with all three detail levels, and preserve fixed input coordinates during drawer motion. A new hero layout has not been implemented or approved in this debugging pass. Native Android hero changes and fresh native rendering remain outside these web test fixes.

Real Play-installed generation and Integrity, owner visual acceptance, independent release review, and separate deployment/publication approval remain release gates.
