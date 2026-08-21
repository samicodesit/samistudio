# Doodle Monetization Design

Date: 2026-08-21
Status: Proposed for review

## Summary

Doodle remains free to try without an account. Each browser receives two successful free doodles. After those are used, a customer can sign in and buy ten additional doodles for a single VAT-inclusive payment of €4.99.

The paid flow uses a dedicated Doodle Supabase project for identity and credit storage. It reuses the existing Stripe account credentials, but creates a Doodle-specific product, EUR price, Checkout flow, and webhook endpoint. AutoLister's users, database, billing logic, and products remain separate.

## Product Rules

- Two successful doodles are free per browser.
- Ten additional doodles cost €4.99 once.
- There is no subscription, trial renewal, expiry, or automatic top-up.
- A customer can buy the same pack again when needed.
- Failed, refused, timed-out, or malformed generations do not consume a free use or paid credit.
- Prices are shown and charged only in EUR.
- €4.99 includes applicable VAT; Stripe Tax calculates the included tax using the Stripe account's configured registrations.
- Stripe Adaptive Pricing is disabled.

The existing Vercel Firewall burst rule, BotID check, and daily free-generation budget remain cost-control layers. Paid credits bypass the free global daily budget but not BotID or burst protection.

## Authentication

Authentication appears only when someone chooses to buy or restore paid credits. Free visitors are not asked to register.

Launch methods:

1. `Continue with Google` through Supabase Auth.
2. `Continue with email` using a six-digit one-time code through Supabase Auth.

There are no passwords, usernames, profile setup, onboarding questionnaire, or marketing opt-in. Google is the fast path; email OTP is the universal fallback.

Sign in with Apple is deliberately excluded at launch. Apple web OAuth requires Apple Developer configuration and recurring client-secret rotation. It should be added only if purchase analytics or support requests show meaningful demand that email OTP does not satisfy.

Supabase uses cookie-based SSR sessions so the generation and checkout routes can identify the user server-side. Authenticated routes are dynamic and must never be statically cached.

## Purchase Experience

### Free use

The initial workspace keeps its current layout. A quiet line near the create action says that the first two doodles are free; there is no permanent balance counter in the header.

After the first successful free doodle, the result actions show `1 free doodle left` as secondary information. The next successful free generation uses the final allowance.

### Purchase prompt

When a visitor with no remaining free uses attempts another generation, Doodle opens a native dialog and preserves the current scene.

The dialog contains one offer only:

- Heading: `Keep doodling`
- Quantity: `10 more doodles`
- Price: `€4.99`
- Reassurance: `One payment. No subscription.`
- Policy: `Failed generations don't count.`
- Primary action: `Get 10 doodles`
- Secondary action: `Not now`
- Recovery link for existing customers: `Already bought? Sign in`

There is no fake discount, crossed-out price, “most popular” badge, countdown, credit-card artwork, comparison table, or decorative SVG.

The dialog follows the existing paper-and-sticky-note visual language: restrained typography, one physical paper edge, the current graphite/green/yellow palette, and a short entrance transition that respects reduced-motion settings. Mobile uses a bottom-sheet-like full-width card with comfortable thumb targets; desktop uses a centered compact dialog.

### Sign in and checkout

If the customer is signed out, the primary purchase action reveals Google and email-code sign-in in the same dialog. Successful authentication returns to the offer without losing the scene.

If the customer is already signed in, the action creates a Stripe-hosted Checkout Session immediately. Doodle saves the scene in `sessionStorage` before redirecting and restores it after return.

Checkout configuration:

- Mode: one-time payment
- Doodle-specific Stripe Price ID
- Currency: EUR
- Unit amount: €4.99
- Tax behavior: inclusive
- Automatic Tax: enabled
- Adaptive Pricing: disabled
- Quantity adjustment: disabled
- Promotion codes: disabled at launch
- Session metadata: authenticated Supabase user ID and pack identifier
- Success return: localized Doodle route with the Checkout Session ID
- Cancel return: localized Doodle route with the original scene restored

After payment, the customer returns to a compact success state: `10 doodles added` with `Start drawing` as the primary action. The workspace then shows the remaining paid balance quietly beside the create action. It does not add a dashboard or billing page.

## Data Model

The dedicated Doodle Supabase project has two application tables.

### `credit_balances`

- `user_id uuid primary key references auth.users`
- `balance integer not null default 0 check (balance >= 0)`
- `updated_at timestamptz not null`

Users may read only their own balance. Only server-side service-role code may change it.

### `credit_transactions`

- `id uuid primary key`
- `user_id uuid not null references auth.users`
- `kind text not null` with constrained values: `purchase`, `reserve`, or `refund`
- `amount integer not null`
- `external_id text not null`
- `stripe_payment_intent_id text`
- `created_at timestamptz not null`

`(kind, external_id)` is unique. Purchases use the Checkout Session ID; reservations and refunds use the same reservation ID with different kinds. A partial unique index covers non-null Stripe Payment Intent IDs. This makes fulfillment and refunds idempotent while leaving a minimal support/audit trail without storing prompts or images.

Free allowance remains in Upstash Redis and is keyed by a signed, HTTP-only browser identifier. Clearing browser storage can reset that allowance; the existing IP, BotID, WAF, and global free limits bound this deliberate anonymous-trial weakness.

## Payment And Credit Flow

1. An authenticated customer requests Checkout from a same-origin, BotID-protected route.
2. The server validates the user and creates a Stripe Checkout Session for the configured Doodle Price ID.
3. Stripe collects payment and tax information.
4. Stripe sends `checkout.session.completed` or `checkout.session.async_payment_succeeded` to the dedicated Doodle webhook.
5. The webhook verifies the endpoint-specific signing secret, retrieves the Checkout Session, and verifies that payment is paid, the Price ID matches, and metadata contains a valid user ID.
6. One database transaction inserts a unique purchase ledger row and adds ten credits. Repeated webhook deliveries cannot add credits twice.
7. The success route invokes the same idempotent fulfillment function in case the webhook is delayed, then displays the updated balance.

The Stripe secret key can come from the existing Stripe account configuration. The Doodle webhook signing secret cannot be copied from AutoLister because Stripe signing secrets belong to individual webhook endpoints.

## Generation Accounting

Before calling OpenAI, the generation route creates one atomic reservation:

- Authenticated customer with paid balance: decrement one paid credit and insert a `reserve` transaction.
- Otherwise, browser with free allowance: reserve one free use in Redis.
- Otherwise: return `payment_required` without calling OpenAI.

On a successful PNG response, the reservation is final. On refusal, timeout, malformed response, or upstream error, the route atomically refunds the same reservation exactly once. A retry is always a new explicit request.

If Supabase or Redis is unavailable, metered generation fails closed with a localized temporary-unavailable message. Checkout and webhook errors never grant credits speculatively.

## Security And Privacy

- Stripe, Supabase service-role, and webhook secrets remain server-only.
- Checkout creation requires same-origin validation and BotID.
- Webhook processing requires Stripe signature verification against the raw request body.
- Checkout metadata is revalidated server-side and never treated as proof of payment by itself.
- Database constraints prevent negative balances and duplicate fulfillment.
- Row-level security allows customers to read only their own balance and transaction history is not exposed to the client.
- Redirect targets are fixed localized paths, not arbitrary user-provided URLs.
- Doodle stores the Supabase user ID, credit balance, and transaction identifiers. It does not store prompts, generated images, Google tokens, card details, billing addresses, or tax IDs.
- A compact account menu provides balance, sign out, and account deletion. Deletion clearly warns that unused credits will be lost, removes the Doodle user and application rows, and does not alter Stripe's legally required payment records.

## Localization

All new interface copy is added to the existing ten locale dictionaries. Price and quantity remain exactly `€4.99` and `10` in every language. Checkout locale follows the Doodle locale when Stripe supports it, but currency remains EUR.

Authentication, pricing, balance, payment status, and generation-limit messages must be written naturally in each locale. RTL layout covers the complete Arabic dialog, email field, balance text, and success state.

## Testing

### Unit and route tests

- Free allowance grants exactly two successful generations.
- Failed free generations are refunded once.
- Paid reservations cannot make a balance negative.
- Paid failures refund exactly once.
- Checkout requires authentication and always uses the configured price.
- Checkout disables Adaptive Pricing and enables Automatic Tax.
- Webhook rejects invalid signatures, wrong prices, unpaid sessions, and unknown users.
- Repeated webhook and success-route fulfillment grants one pack only.
- Redirect validation accepts only local paths.

### Browser tests

- Two anonymous generations work without sign-in.
- The third attempt preserves the scene and opens the purchase dialog.
- Google and email-code controls are keyboard accessible and responsive.
- Canceling sign-in or Checkout returns to the same scene.
- Successful purchase shows ten credits and resumes generation.
- Signing in on another browser restores the same balance.
- Mobile, desktop, reduced-motion, and Arabic RTL layouts have no overflow or overlap.

### Stripe and production checks

- Stripe test-mode Checkout with automatic tax and EUR pricing.
- Signed webhook delivery and repeated-event replay.
- One live €4.99 purchase followed by one successful paid generation; the payment is then refunded in Stripe and the remaining test credits are removed manually.
- Production BotID/WAF behavior verified with a normal browser; automation is expected to receive a bot response.

## Deliberate Omissions

- Sign in with Apple
- Subscriptions and billing portal
- Multiple packs or quantity selector
- Coupons, referrals, regional pricing, and Adaptive Pricing
- Credit expiry
- Usage history, image history, and customer dashboard
- Team plans, gifting, and credit transfers
- Automated credit reversal for payment refunds or disputes; launch support handles these manually because the pack is low-value and expected volume is initially small

Add these only when actual purchases or support requests demonstrate the need.

## Acceptance Criteria

- A visitor can create two successful doodles without signing in.
- A customer can authenticate with Google or email OTP and buy ten doodles for exactly €4.99 in EUR.
- Stripe Tax calculates included tax using the account's configured registrations without changing the displayed total.
- The same paid balance is available after signing in on another device.
- Failed generation attempts restore their reservation and never silently consume a paid credit.
- Duplicate Stripe events never grant duplicate credits.
- The purchase UI feels native to the existing Doodle design and remains compact on mobile and desktop.
- AutoLister data and billing behavior are unchanged.
