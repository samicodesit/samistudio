# Doodle

Private, mobile-first sticky-note doodle generation for `doodle.samistudio.nl`.

## Local development

1. Copy `.env.example` to `.env.local` and fill `DOODLE_PASSWORD`, `SESSION_SECRET`, and the Doodle project `OPENAI_API_KEY`.
2. Run `npm run dev`.
3. Run `npm test`, `npm run typecheck`, and `npm run lint`.

The app keeps prompts and generated images in browser memory only. The root Sami Studio site is separate from this Next.js app.

## Paid checks

`npm run test:real` makes one low-quality Image API request and is skipped by the normal test command. `npm run eval:prompt` makes eight sequential requests and writes numbered PNGs under `tmp/prompt-eval/`. Both commands incur Doodle-project API costs and are never run by CI.

## Production shape

- Vercel project: `doodle`
- Root directory: `doodle/`
- Domain: `doodle.samistudio.nl`
- Image model: `gpt-image-1-mini`
- Image quality: `low`

## Deployment checklist

Configure the Vercel project with root directory `doodle/`, Fluid Compute, and the encrypted environment variables from `.env.example`. Attach `doodle.samistudio.nl` without changing the apex site. Local release verification was run on 2026-08-20; production deployment and one real generation remain pending until the project key and Vercel settings are supplied.
