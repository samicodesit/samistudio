# Samistudio — Netlify-ready static site

This repository contains a small static site. It is prepared for automatic deploys on Netlify.

Quick local Git setup

1. Create a remote on GitHub (or another Git host).
2. Add the remote and push:

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Netlify setup

- In Netlify, choose "New site from Git" and select your repository.
- Build command: leave blank (no build step for plain static files).
- Publish directory: `.`

If you'd rather use the Netlify CLI for a one-off deploy:

```bash
npx netlify-cli deploy --prod --dir=.
```
