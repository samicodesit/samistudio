# Doodle

Public, mobile-first sticky-note doodle generation.

## Local development

1. Copy `.env.example` to `.env.local` and fill `SESSION_SECRET` and the Doodle project `OPENAI_API_KEY`.
2. Run `npm run dev`.
3. Run `npm test`, `npm run typecheck`, and `npm run lint`.

The app keeps prompts and generated images in browser memory only. The root Sami Studio site is separate from this Next.js app.

## Paid checks

`npm run test:real` makes one low-quality Image API request and is skipped by the normal test command. `npm run eval:prompt` makes eight sequential requests and writes numbered PNGs under `tmp/prompt-eval/`. Both commands incur Doodle-project API costs and are never run by CI.

## Production shape

- Vercel project: `doodle`
- Production URL: `https://doodle-puce.vercel.app`
- Git root directory when the repository is connected: `doodle/`
- Image model: `gpt-image-1-mini`
- Image quality: `low`

## Deployment checklist

The app is deployed directly to the `doodle` Vercel project with encrypted production environment variables. Vercel Firewall and application-level daily limits protect the public generation endpoint.

The Vercel project is not yet connected to Git. When it is connected to the existing `samistudio` repository, set its root directory to `doodle/` before enabling automatic deployments.
