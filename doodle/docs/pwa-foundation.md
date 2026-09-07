# PWA foundation

## Goal

Make Doodle installable from supported mobile and desktop browsers while keeping every generated image, prompt, account response, and payment flow network-only.

## Shape

- `src/app/manifest.ts` publishes the standalone app identity, colors, start URL, and 192/512/maskable icon routes.
- `src/app/pwa/icon/[variant]/route.tsx` renders the existing paper, graphite, moss, and sticky-note identity as PNG icons without adding an image-generation dependency.
- A small client component in the shared root document registers `/sw.js` with cache bypass for worker updates.
- `public/sw.js` owns one versioned cache and precaches exactly `/offline.html`. It handles only same-origin top-level document navigations, tries the network first, and returns the cached offline document only after a network failure.
- `public/offline.html` explains that creating a doodle needs a connection and reloads the original address on retry. Its inline copy follows the locale segment in the requested URL where available.

## Cache and privacy contract

Cache Storage may contain only the dedicated static offline document. The worker never calls `cache.put` for runtime responses and never intercepts API requests, Next.js data/RSC requests, static assets, generated blob URLs, account or checkout traffic, or third-party origins. App pages remain network-first and are not retained. Query strings, including prompts or return parameters, are never used as cache keys.

## Validation

Unit tests cover manifest metadata, registration, icon variants, and the worker allowlist/source contract. Browser tests verify install metadata and icon responses online, inspect Cache Storage after normal generation, then prove a localized navigation receives the static fallback while offline on mobile and desktop viewports.

Next.js requires service-worker offline behavior to be checked against a production build. Run the focused reproducible check from the app directory:

```sh
npm run build
PLAYWRIGHT_PRODUCTION=1 npm run test:e2e -- e2e/pwa.spec.ts
```

The normal `npm run test:e2e` command continues to use the faster development server.
