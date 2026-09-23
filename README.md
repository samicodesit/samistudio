# Sami Studio

Personal website for Sami, product designer and builder. The homepage is the interactive terminal design: **From idea to everyday.**

## Website files

- `index.html`: homepage markup, content and metadata.
- `assets/studio.css`: desktop and mobile layouts.
- `assets/studio.js`: terminal screens, keys, sound and entrance behavior.
- `assets/key-spring.mjs`: key motion.
- `assets/terminal-*.webp`: the five desktop/mobile artwork files.
- `favicon.svg`: website icon.

These ten runtime files were recovered byte-for-byte from the working production deployment on 16 September 2026. Edit them here for subsequent changes; the deployment is no longer the only copy of the current homepage. No framework or package installation is required for the homepage.

## Local preview and checks

From the repository root, with Node.js 20 or newer:

```bash
node --test tests/studio.test.mjs
node scripts/build-studio.mjs
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. The build copies only the ten current homepage files into `dist/`; it does not publish repository documentation, credentials, tests or other applications. When adding a runtime asset, update the allowlist in `scripts/build-studio.mjs` and its tests.

## Vercel

Connect the **samistudio** project to this repository's `main` branch with root directory `./`. The checked-in `vercel.json` sets the build command and `dist` output directory, overriding old dashboard build/output settings. The build runs the asset tests before packaging the website. DNS and the `www` redirect remain dashboard configuration; this repository does not change them.

If the Git integration was disconnected during migration, reconnect it only after this update is merged, then deploy the latest `main` commit. Do not reuse the separately downloaded migration folder for future edits or deployments.

## Other projects

`doodle/` is a separate application and retains its own source, dependencies and deployment. Its current branch was not changed by the homepage sync.

`11112024.html`, the `assets/11112024-*` bundles and the associated audio belong to a separate gallery, not the homepage. They remain in Git unchanged and are intentionally excluded from the homepage's `dist` output, matching the current production site. The existing icon-generation script and icon files are also retained.

Previous homepage versions remain recoverable in normal Git history, but are not used by the current homepage or production build.
