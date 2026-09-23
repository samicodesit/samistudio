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

The product is a single €4.99 payment for ten doodles; adaptive pricing and subscriptions stay off. Paid web checkout is disabled unless `STRIPE_CHECKOUT_ENABLED=true` and `STRIPE_CHECKOUT_TAX_MODE` is explicitly set to `disabled` or `automatic`. The `disabled` mode requires an owner or advisor decision about the tax treatment. The `automatic` mode additionally requires `STRIPE_TAX_REGISTRATION_CONFIRMED=true` after the active Stripe Tax registration and account settings have been checked. Missing or invalid combinations fail closed before a Checkout Session is created. Configure the webhook at `https://doodle.samistudio.nl/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

For the automatic mode, verify the live Stripe Tax registration, business location, product tax code, and Price tax behavior before enabling the flag. If the customer-facing total should remain €4.99, verify the Price is configured for the intended inclusive behavior in Stripe. The application does not treat an environment flag as proof of registration.
