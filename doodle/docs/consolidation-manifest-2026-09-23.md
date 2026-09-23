# Doodle consolidation manifest

Status: curated copy complete in the isolated consolidation worktree. Generated outputs and unapproved capture sets remain excluded.

## Inputs and safety anchors

- Original dirty checkout: `\\wsl.localhost\Ubuntu\home\mests\projects\samistudio\doodle`.
- Isolated target: `C:\Users\Sami\.codex\worktrees\doodle-consolidation\samistudio` on `codex/doodle-consolidation`.
- Feature baseline: `6176bd4`.
- Main baseline to merge: `9e06a12`.
- Recovery anchor in the original repository: `stash@{2026-09-21}` (`03740d0`).
- Copy only after the other source fixes are complete and reviewed. Preserve the original checkout and stash.

## Copied: web application source

Copy the current, reviewed versions of these paths from the original `doodle/` tree:

- `src/**`
- `public/.well-known/**`
- `public/ideas/**`
- `public/references/**`
- `public/marketing/**`, after asset approval
- `public/offline.html`
- `public/sw.js`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `playwright.config.ts`
- `README.md`
- `.env.example`
- `scripts/*.mts`
- `e2e/**`

Keep the current SEO routes and their tests in `src/` when the source fixes are copied: localized blog routes, localized `for-ai` routes, sitemap, robots, and Search Console analysis tooling.

## Copied: native Android source

Canonical source still requires owner and Play Console confirmation.

- Preferred current native source candidate: `mobile/app.config.ts`, `mobile/App.tsx`, `mobile/index.ts`, `mobile/src/**`, `mobile/plugins/**`, `mobile/scripts/**`, `mobile/assets/**`, `mobile/android/**` source and Gradle configuration, `mobile/package.json`, `mobile/package-lock.json`, `mobile/tsconfig.json`, `mobile/vitest.config.ts`, and `mobile/metro.config.js`.
- Preserve runtime fonts, images, animation files, and license files under `mobile/assets/**`.
- Keep `android/**` as the legacy TWA source until the canonical Android project and Play artifact are verified. Do not silently merge both projects into one build.

## Copied: documentation and release records

- `docs/**`
- `AGENTS.md`
- `CLAUDE.md`
- `android/README.md` and `android/twa-manifest.json` while the legacy source is retained
- Native, Play Console, billing, deployment, SEO, and measurement records under `docs/`

## Final assets only after approval

- Runtime images and icons under `public/ideas/**`, `public/references/**`, `public/marketing/**`, and `mobile/assets/**`.
- `store-assets/**` only from the current approved asset manifest, with provenance and review status.
- `marketing-assets/**` only for explicitly approved deliverables. Keep source manifests and provenance, not every generated capture.

## Do not copy into the release source tree

These are generated, diagnostic, local-only, or unverified artifacts:

- `.next/**`
- `node_modules/**`, `mobile/node_modules/**`
- `android/**/build/**`
- `mobile/android/**/build/**`
- `mobile/android/.gradle/**`
- `test-results/**`, `playwright-report/**`, `report-review/**`
- `mobile/artifacts/*.apk`, `mobile/artifacts/*.aab`, unless a Play Console verified artifact is intentionally archived separately
- local APK and AAB outputs under Android build directories
- root `*.tgz` package bundles and other local package archives
- generated marketing videos, screenshots, contact sheets, candidate folders, and capture traces unless individually approved
- `.env*` files other than `.env.example`
- `studio-terminal/**`

## Validation record

1. Original checkout and recovery stash were preserved.
2. Studio root conflicts were resolved from current `main` and committed separately as `2f37154`.
3. Native version metadata is aligned at version `0.1.1`, version code `3`, including the Expo runtime resource.
4. `.vercelignore` excludes native build trees, artifacts, archives, diagnostics, and store capture sets.
5. Web typecheck, lint, 418 unit tests, production build, and 37 Playwright tests pass. Seven unit tests remain skipped because Redis binaries and real image credentials are unavailable in this Windows worktree.
6. Mobile typecheck and 50 native unit tests pass. Android release signing and Play upload remain unverified.
