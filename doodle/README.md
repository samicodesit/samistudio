# Doodle

Public, mobile-first sticky-note doodle generation. Prompts and generated images stay in browser memory only.

## Local development

Copy `.env.example` to `.env.local`, run `npm install`, then `npm run dev`.

```dotenv
SESSION_SECRET=
OPENAI_API_KEY=
KV_REST_API_URL=
KV_REST_API_TOKEN=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_DOODLE_PRICE_ID=
```

Create one Google Web client with these authorized JavaScript origins:

```text
https://doodle.samistudio.nl
http://localhost:3000
http://127.0.0.1:3100
```

Google verifies the user server-side; Doodle stores only a signed HttpOnly session and Redis HMAC identity map. Redis atomically manages paid-credit holds, fulfillment, account deletion, and Stripe idempotency. Two anonymous generations remain free.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e` before release.

## Stripe

Web checkout keeps the existing fixed-price Stripe flow and sends `automatic_tax: { enabled: true }`. This describes the request made by the application. It does not confirm that a VAT or other Stripe Tax registration is active in the Stripe account; that status was not verified in this release check. Confirm the Stripe Tax setup and registration status before release. Configure the webhook at `https://doodle.samistudio.nl/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Release verification: 13 billing unit tests and 3 mocked Playwright billing scenarios passed after restoring this behavior. No live Stripe Checkout Session was created, and Stripe Tax registration was not verified.
