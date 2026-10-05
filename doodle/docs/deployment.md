# Backend deployment

From the Doodle project directory in Ubuntu/WSL, use the standard Vercel command:

```sh
npx vercel --prod
```

The project is already linked to Doodle in `.vercel/project.json`. This publishes the web backend and website. A backend-only update does not require an Android build or Google Play submission.

Use the intended release source in the checkout. The command uploads the current checkout; it does not distinguish unfinished local work from approved release changes. Obtain the owner's deployment approval under AGENTS.md, then run the command. Do not invent a separate prompt-specific deployment command or repeat completed QA.

On 30 September 2026, the vague-subject update was deployed as `dpl_2oNzhiU8HDfcVDUvEva6LjAmC9gd`. Vercel returned READY with aliases assigned. The release retained the previous production source, changing only the generation prompt and its obsolete no-text test assertion.

Current production is `dpl_G6kXgdejq8wtZFhVSoyS5BF4upMm`, published 1 October 2026 from `13ea356`. It raises the server-owned free trial to four successful doodles and keeps older Android guest startup compatible. Previously used trial counts and paid credits are preserved. The earlier usage metrics remain available with `npm run metrics`; see `docs/usage-metrics.md`. Main matches all 228 uploaded source hashes; see `docs/production-baseline.json`.

Build 7 (0.1.5) and its matching four-free English store description were submitted through Play Console on 1 October 2026. Publishing overview shows Changes in review while quick checks run. The approved release will publish automatically at 100% rollout because managed publishing is off. Public Android remains build 6 until approval. Its canonical source is aacd2ce on codex/doodle-next-update at C:/Users/Sami/.codex/worktrees/doodle-next-update/samistudio/doodle. The final bundle is /home/mests/projects/samistudio/doodle/mobile/artifacts/doodle-release-v7.aab. Deploy web releases from main, rather than the native checkout.

## Landing release, October 2, 2026

Current production is dpl_2YjycmSA5qf6nvptiDbSysvfXXf2, source commit 439c00a, live at https://doodle.samistudio.nl. The approved option 2 landing includes localized copy, typed and backspaced hints, SVG language flags and the final laptop and label spacing. Main was fast-forwarded to that source. Unrelated local changes were preserved and excluded by deploying the clean landing worktree with the same standard Vercel command and production project link.

Vercel returned READY and assigned the public alias. All 46 targeted component checks passed; Vercel production build and TypeScript passed. The published page was visually inspected at actual CSS sizes 1366x768 and 390x844, with no horizontal overflow. All ten SVG flags loaded when the menu opened, four free doodles was shown, and the Google Play destination was confirmed. Evidence: landing-live-desktop.png and landing-live-phone.png in the existing landing evidence directory. Generation, authentication, payment and native APIs are unchanged; live transactions and physical-phone checks were not repeated.

## Flare generation release, October 5, 2026

Production is dpl_96oFMPhCYxVRsxqTrJ9CDcj7BjeQ, sourced from 8d80d11 in the intended detail release checkout. All levels use gpt-image-2.5-flare at MEDIUM quality. Simple uses the owner-reviewed simple-v3 template, with natural scene sizing and the expressive rounded ending. Medium and Detailed templates remain v1. Pricing, one-credit charging, paper correction, output dimensions and Integrity policy are unchanged. This shared backend change requires no Android publishing.

Verification: 615 unit/integration tests, TypeScript, lint with zero errors and five existing warnings, local and Vercel production builds, and all 83 browser cases covered successfully. One local sign-in test first failed because the production build lacked the public test Google client setting, then passed after rebuilding with that setting. Root reviewed the scoped change inline under the owner policy against delegation. The production upload excludes QA galleries, scripts, credentials and test outputs.

One real Simple generation through the live app returned a corrected downloadable PNG in 9,663 ms. Runtime logs confirmed Flare, MEDIUM and simple-v3; the owner account went from 100 to 99 credits. No automatic retries. See docs/qa/flare-release-2026-10-05.json and its retained PNG. Native Integrity remains enabled; trusted hardware generation was not newly verified. Slow provider outliers remain possible.

Rollback: promote dpl_94xaVdn7f4FSRjPcyeren3PjYM1o, then restore OPENAI_IMAGE_MODEL=gpt-image-1-mini for subsequent builds. Keep MEDIUM quality.
