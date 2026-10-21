# Doodle production-source consolidation, 14 October 2026

The web/backend source is recovered from the actual production deployment `dpl_9FMZyHBkZkJVoMRDz5T5ytHML9HW`. All 475 uploaded source files were hash-verified before applying the approved social-preview changes. The GitHub branch starts from current `origin/main`, preserving its Studio work. Older local drafts and historical release folders were not reset or deleted.

## Included source

- Current live web/backend, including the existing photo, detail-level, gallery, checkout, diagnostics, Android and Apple API work. This is source recovery, not a new implementation of those features.
- Current native app source from the established Android source checkout, including its existing photo input, waiting artwork and local native modules. Its version, application ID and store settings are retained. Signing files, dependencies, build outputs, APKs and AABs are excluded.
- Current administrative scripts and browser test source, plus permanent gallery, paper-color and shared-loading regression fixtures omitted by deployment uploads. One browser fixture uses the DOM Node API for TypeScript compatibility. Browser end-to-end execution is not implied by type checking.
- Node 24 in `.nvmrc`, matching the deployed runtime. Node 26 changes CBOR fixture behavior and is not the verification runtime for this checkpoint.
- A separate Doodle GitHub Actions job for backend and native checks. Studio's workflow and application files are retained.

## Approved social preview

The approved 1200 x 630 PNG is served at `/social/doodle-og-2026-10-14.png`. Its SHA-256 is `3564fddf3ed091e8a3a219606a2776e329ff3fc5b5bdd05d4b234e64f4e82e93`.

Localized home pages, Ideas, blog indexes and articles, assistant pages and legal pages explicitly share this image. Open Graph includes dimensions, content type and descriptive alternative text. X uses `summary_large_image` and the same alternative text. Page titles, descriptions, locale metadata and canonical URLs retain their existing meaning. The artwork is English on every locale because this is the single approved asset.

The versioned image URL avoids reusing the previous image URL. Existing social posts may retain cached cards until the network refreshes them. No third-party validator result is implied by local crawler tests.

## Channel links

`/x`, `/reddit`, `/pinterest`, `/instagram`, `/tiktok`, `/facebook`, `/linkedin`, `/threads` and `/bluesky` issue temporary 307 redirects to the home page with a fixed source, `utm_medium=organic_social` and `utm_campaign=doodle_web_launch`. The canonical page remains `/`. These aliases identify link attribution; they do not claim an account exists on every network. Analytics continues to strip arbitrary prompts, authentication values and other private query parameters.

Use these links when publishing on the corresponding channel. There is one approved image, without per-network visual variants. The main `/` link remains suitable for generic sharing.

## Verification and release boundaries

See `qa/social-preview-2026-10-14/` for source hashes, approved-asset provenance, HTTP checks and final verification. Build output, dependencies and signing credentials are not part of the commit. This consolidation does not submit Android or iOS binaries, run paid image generation, send promotional posts or change credentials. The owner subsequently authorized the OG update to go live. The web candidate was deployed to https://doodle.samistudio.nl, then verified against all 480 uploaded source files, 100 production crawler page checks and nine channel redirects. The published PNG matches the approved asset and was visually inspected at 400 x 210. The GitHub pull request remains unmerged; Android and iOS releases remain unauthorized.
