# Doodle

Public, mobile-first sticky-note doodle generation.

## Local development

1. Copy `.env.example` to `.env.local` and fill the Doodle-specific values below.
2. Run `npm install` once, then `npm run dev`.
3. Verify locally with `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`.

Required server-side values:

```dotenv
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1-mini
OPENAI_IMAGE_QUALITY=low
KV_REST_API_URL=
KV_REST_API_TOKEN=
SESSION_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_DOODLE_PRICE_ID=
```

Required browser-safe values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Keep every key except the two `NEXT_PUBLIC_` values server-only. Generate `SESSION_SECRET` with `openssl rand -base64 32`.

The app keeps prompts and generated images in browser memory only. The root Sami Studio site is separate from this Next.js app.

Generation reservations are 10-minute expiring holds. Failed requests never change permanent free usage or paid balance; only atomic successful finalization consumes a doodle.

## Paid checks

`npm run test:real` makes one low-quality Image API request and is skipped by the normal test command. `npm run eval:prompt` makes eight sequential requests and writes numbered PNGs under `tmp/prompt-eval/`. Both commands incur Doodle-project API costs and are never run by CI.

## Accounts and credits

Create a dedicated Supabase project for Doodle. Do not reuse AutoLister users, database, product records, or webhook secrets.

1. Apply `supabase/migrations/202608210001_doodle_credits.sql` in that project's SQL editor.
2. In Supabase Auth, enable Google and email OTP. Keep password sign-in disabled/unused, set OTP expiry to 600 seconds, and use `{{ .Token }}` in the email template.
3. Add `http://localhost:3000/auth/callback` and `https://doodle.samistudio.nl/auth/callback` to Supabase Auth redirect URLs.
4. Use a Doodle-specific Google OAuth client. Its authorized redirect URI is the Supabase Google provider callback URL shown in the Supabase dashboard; Doodle itself always returns through `/auth/callback`.

## Stripe test-mode setup

Use the existing Stripe account, but create Doodle-only billing objects in Stripe test mode first:

1. Create `Doodle — 10 doodles` and one non-recurring EUR Price at **€4.99**. Set the Price tax behavior to **inclusive**.
2. Disable Adaptive Pricing, quantity adjustment, and promotion codes. The customer-facing currency is always EUR.
3. Enable Automatic Tax and verify Slovakia is the business origin with the real active registrations configured; Stripe Tax can calculate only from those registrations.
4. Add a test-mode Doodle webhook endpoint for `/api/stripe/webhook`. Subscribe it only to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
5. Use its test Price ID and endpoint-specific test signing secret only in local or Vercel Preview variables. Never copy AutoLister billing objects.

For a local signed-webhook purchase test, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, copy the printed endpoint signing secret into `.env.local`, then complete a test-mode €4.99 Checkout in the browser.

Complete a test-mode €4.99 Checkout, send a signed webhook delivery and replay it once, then confirm the balance is granted only once. Test-mode products, Prices, keys, payments, and webhook endpoints do not exist in Stripe live mode.

## Stripe live-mode setup

After test-mode validation, switch Stripe to live mode and recreate the Doodle product, inclusive one-time EUR €4.99 Price, and dedicated `https://doodle.samistudio.nl/api/stripe/webhook` endpoint with the same two events. Put the live secret key, live Price ID, and that live endpoint's new signing secret in the Vercel **Production** values for `STRIPE_SECRET_KEY`, `STRIPE_DOODLE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. Keep Adaptive Pricing disabled in live mode too; never put test keys, test Price IDs, or test webhook secrets in Production.

At launch, refunds and disputes need a manual remaining-credit adjustment for the affected Doodle account; there is no automatic credit clawback yet.

## Production shape

- Vercel project: `doodle`
- Production URL: `https://doodle.samistudio.nl`
- Git root directory when the repository is connected: `doodle/`
- Image model: `gpt-image-1-mini`
- Image quality: `low`

## Deployment checklist

Set the live Supabase, OpenAI, Redis, and Stripe values above as encrypted Production environment variables in the `doodle` Vercel project, then deploy from the `doodle/` root with `vercel --prod`. Production verification uses a live €4.99 purchase and live signed webhook replay, followed by a visual pass at 390×844, 320×700, 1440×1000, reduced motion, and Arabic RTL. Test-mode validation remains separate and must be completed before live deployment.

Vercel Firewall, BotID, and the existing 3-per-60-second burst rule still protect the public endpoint. Paid credits bypass only the daily free budget, not those protections.
