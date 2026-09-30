# Organic discovery delivery, 30 September 2026

The public website now uses Google's official localized Google Play badge and links its existing card, lunchbox note and journal drawing guides from the homepage and ideas gallery. The badge opens the published app, `nl.samistudio.doodle`. Play's relevant Art & design tag was saved; its existing Art & Design category and first screenshot were retained.

## Release and scope

- Public destination: [Doodle](https://doodle.samistudio.nl).
- Vercel Production deployment: `dpl_8S47HUTGHE2nFkxx9B59knm9cKQY`, READY and promoted to the public domain.
- Built from an isolated snapshot of the previous live source. Of 208 existing files, only `src/components/doodle-page.tsx` and `src/components/doodle-ideas-page.tsx` changed. The other 206 were unchanged by hash. Thirteen new files comprise the discovery component, stylesheet, tests and ten official badge assets. All 221 uploaded source files matched the verified snapshot.
- Generation, payments, Apple Pay, native authentication, refund reconciliation and cron source were unchanged. No new Android build, credential changes, outreach or ad spend were part of this update.

## Verification

- Five targeted Vitest suites passed, 23 tests total. Targeted ESLint passed. Local and Vercel Production builds passed, including TypeScript and 84 routes.
- Inspected rendered desktop pages and labelled local layout previews at 320 CSS pixels. The phone previews were layout checks with API calls disabled, not native or backend functional testing. The badge and guide cards fit without horizontal overflow. Brand heading and body font families were checked.
- Inspected the actual published homepage and gallery. Clicked the public badge and confirmed the correct Play listing and Install action. All ten published badge SVGs returned HTTP 200 with bytes matching the official downloads.
- Public homepage, gallery, three guides, robots, sitemap and native configuration returned HTTP 200. Native configuration retained Play Integrity authentication. Unauthenticated refund reconciliation returned HTTP 401. The badge is hidden in installed app mode.
- Google Search Console live tests passed for the homepage and gallery. Both indexing requests were accepted into Google's priority crawl queue on 30 September. Their cached indexed verdict was still Crawled - currently not indexed. Queue acceptance is not confirmation of indexing or improved ranking.
- Existing sitemap submission remains Success. No crawler block or canonical defect was established, so those settings were retained.
- Play's saved Art & design tag was verified in the Console rendering. The existing screenshot sequence already communicates a small drawing use case and was retained.

## Evidence

Minimal screenshots are retained in `C:/Users/Sami/.codex/doodle-android-preview/release-diagnosis/`: `organic-production-home.png`, `organic-production-guides.png`, `organic-mobile-home-qa.png`, `organic-mobile-guides-qa.png`, `play-organic-category-tag.png`, `google-home-indexing-requested.png` and `google-gallery-indexing-requested.png`. Layout QA captures are not promotional assets.

Badge provenance and review status are recorded in [the current badge asset manifest](google-play-badge-assets-2026-09-30.md). These are implemented discovery improvements, not measured growth. Use the existing Play, Search Console and Vercel dashboards to assess post-launch results separately.
