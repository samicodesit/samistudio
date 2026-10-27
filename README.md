# Sami Studio

Personal website for Sami, designer and developer. The homepage introduces Sami alongside an interactive terminal with About, Work, and Contact screens. Work opens spatial galleries for Doodle, AutoLister, and Cryptik.

## Website files

- `index.html`: homepage markup, content and metadata.
- `assets/studio.css`: desktop and mobile layouts.
- `assets/studio.js`: terminal screens, keys, sound and entrance behavior.
- `assets/key-spring.mjs`: key motion.
- `assets/project-gallery.js`: project opening, history, focus return, and gallery motion.
- `assets/project-gallery.css`: the gallery stage and its phone layout.
- `assets/project-data.mjs`: project descriptions, links, and image metadata.
- `assets/gallery-geometry.mjs`: perspective placement and the terminal screen aperture.
- `assets/gallery/`: real project images and generated stage artwork.
- `assets/fonts/`: the two locally hosted fonts and their licenses.
- `assets/icons/`: Phosphor navigation icons and their license.
- `assets/terminal-*.webp`: the five desktop/mobile artwork files.
- `favicon.svg`: website icon.

The original homepage and terminal artwork were recovered byte-for-byte from the working production deployment on 16 September 2026. The gallery builds on those sources. No framework or package installation is required for the homepage.

The top-right “Something needs doing?” link opens a front-facing version of the original screen with a name, email and message form. “Send me an email” prepares a complete draft in the visitor's email application for hello@samistudio.nl. There is no website mail backend in this version. The form preserves its draft when closed, supports Escape and browser history, and respects reduced motion. Source registration and QA are retained in `design-assets/contact-terminal/`.

## Local preview and checks

From the repository root, with Node.js 20 or newer:

```bash
node --test tests/studio.test.mjs
node scripts/build-studio.mjs
node scripts/preview-studio.mjs
```

Open `http://localhost:8090`. The preview disables asset caching so edits appear immediately. The build copies only the explicit runtime allowlist into `dist/`; it does not publish repository documentation, credentials, tests or other applications. When adding a runtime asset, update the allowlist in `scripts/build-studio.mjs` and its tests.

The project view opens from the terminal screen and returns to the selected row. Arrow keys select projects; Enter opens one; Escape closes it. Browser Back and Forward work with `#work/doodle`, `#work/autolister`, and `#work/cryptik`. Reduced-motion preferences disable the animated reveal and depth movement.

Hold the amber indicator for 700 ms, or focus it and press Enter, to explode the terminal directly in the homepage. The hidden playground also accepts `explode`. Drag the five assemblies to inspect them. Arrow keys move the focused part; Home or a double click resets it. Click the amber indicator again or press Escape to reassemble. The existing camera, scale, room, screen, keys and page layout remain in place. Reduced motion settles immediately.

Construction sources, lossless exported layers, source-pixel checks, browser QA helpers and the retained 3D study are documented in `design-assets/terminal-exploded/README.md`. These construction assets stay outside the public build.

## Vercel

Connect the **samistudio** project to this repository's `main` branch with root directory `./`. The checked-in `vercel.json` sets the build command and `dist` output directory, overriding old dashboard build/output settings. The build runs the asset tests before packaging the website. DNS and the `www` redirect remain dashboard configuration; this repository does not change them.

If the Git integration was disconnected during migration, reconnect it only after this update is merged, then deploy the latest `main` commit. Do not reuse the separately downloaded migration folder for future edits or deployments.

## Other projects

`doodle/` is a separate application and retains its own source, dependencies and deployment. Its current branch was not changed by the homepage sync.

`11112024.html`, the `assets/11112024-*` bundles and the associated audio belong to a separate gallery, not the homepage. They remain in Git unchanged and are intentionally excluded from the homepage's `dist` output, matching the current production site. The existing icon-generation script and icon files are also retained.

Previous homepage versions remain recoverable in normal Git history, but are not used by the current homepage or production build.
