# Doodle Google + Redis Authentication Design

## Goal

Replace Supabase with direct Google sign-in and Redis-backed accounts so Doodle can launch without another billable platform. Preserve the existing product contract: two anonymous doodles, ten paid doodles for €4.99, cross-device paid balances, atomic credit spending, idempotent Stripe fulfillment, account deletion, localization, RTL, and mobile-first UX.

## Decision

Use Google Identity Services for authentication and the existing Redis REST database for account mappings and paid credits.

- Google provides the official localized sign-in button and a signed ID token.
- The server verifies the ID token with `google-auth-library` against one Doodle web client ID.
- Doodle issues its own signed, HttpOnly session cookie using the existing `SESSION_SECRET`.
- Redis stores only opaque identifiers, balances, holds, and idempotency markers. Email remains inside the user's signed session cookie and is sent to Stripe only when Checkout is created.
- Supabase packages, clients, callback route, migration, environment variables, and email-OTP UI are removed.

This is preferable to Firebase or Clerk because Doodle already has Redis, needs only Google login, and does not need a general-purpose user database.

## Capacity and Cost

The current global limit is 200 generated images per day, or about 6,000 per month. The Redis design uses a small bounded number of commands per account lookup, generation, and purchase. That remains comfortably below Upstash's free allowance of 500,000 commands per month and 256 MB of data for the expected launch workload.

If the existing Redis integration is not on a free tier, replace only its URL and token with a dedicated Upstash free database. No application redesign is required.

## Identity and Session Flow

### Sign in

1. The purchase sheet renders Google's official button in the active locale.
2. Google returns an ID-token credential to a browser callback.
3. The browser sends the credential to `POST /api/auth/google` with same-origin credentials.
4. The route rejects cross-origin requests and verifies the token signature, audience, issuer, and expiry with Google's official Node library.
5. The verified Google `sub` is HMAC-SHA256 hashed with `SESSION_SECRET` before it is used as a Redis key.
6. Redis atomically returns an existing account UUID or stores a newly generated UUID.
7. Redis marks that account active.
8. Doodle sets a signed, Secure, HttpOnly, SameSite=Lax cookie containing the account UUID, HMAC identity key, verified email, and a 30-day expiry.
9. The client refreshes `/api/account` and continues to Checkout without losing the scene.

Google `sub`, not email, is the stable identity. Email is display and Checkout data only.

### Session validation

Authenticated routes verify the cookie signature and expiry, then check the Redis active-account marker. A copied cookie stops working immediately after account deletion. Redis outages fail closed with a controlled 503 on authenticated money or generation paths.

### Sign out

`POST /api/auth/sign-out` validates same origin and clears the session cookie. It does not delete balances.

### Account deletion

`DELETE /api/account` retains the current explicit confirmation and same-origin checks. One Redis script:

- verifies the active account;
- deletes its Google mapping, active marker, balance, holds, and finalized-generation markers;
- writes a non-identifying tombstone for the random account UUID;
- clears the browser session cookie.

Signing in again creates a fresh account UUID. The tombstone prevents a delayed Stripe webhook for the deleted account from restoring credits. It contains no Google identifier or email.

## Redis Data Model

All account identifiers are random UUIDs.

- `doodle:auth:google:<hmac-sub>` → account UUID
- `doodle:account:<uuid>:active` → `1`
- `doodle:account:<uuid>:balance` → non-negative integer
- `doodle:account:<uuid>:holds` → sorted set of reservation IDs by expiry
- `doodle:account:<uuid>:finalized` → hash of finalized reservation IDs
- `doodle:purchase:<checkout-session>` → Stripe idempotency marker
- `doodle:account:<uuid>:deleted` → tombstone

No prompt, generated image, name, avatar, or email is stored in Redis.

## Credit Operations

The public TypeScript interface remains unchanged so generation and Checkout routes need minimal edits.

### Read

Return zero for an active account without a balance key. Reject malformed Redis values and inactive/deleted accounts.

### Reserve

One Lua script removes expired holds, counts active holds, and creates a ten-minute hold only when `balance - active_holds > 0`. Retries with the same reservation ID are idempotent.

### Finalize

One Lua script verifies the hold, decrements balance exactly once, removes the hold, and records finalization in the account hash. The existing bounded replay and ambiguous-response behavior remains unchanged so a customer is never charged without receiving an already-generated image.

### Release

One Lua script removes a pending hold. Failed releases remain safe because holds expire after ten minutes.

### Fulfill purchase

One Lua script rejects deleted/inactive accounts, records the Checkout session and payment intent idempotently, and increments the balance by ten exactly once. Webhook replay and browser confirmation therefore converge on the same balance.

## Stripe Integration

Checkout metadata continues to carry the random account UUID. The current fixed-pack validation remains: paid session, exact product price, quantity one, one line item, and payment-intent presence.

The previous Supabase user lookup is replaced by the Redis active-account check. Deleted-account fulfillment is rejected.

Stripe provisioning remains separately gated on tax configuration. The account currently has Slovakia as its head office but no active tax registration. Doodle must not silently claim a registration; the owner must confirm whether the business is VAT-registered in Slovakia before live automatic-tax provisioning continues.

## UI and Localization

- Preserve the existing purchase-sheet layout, focus management, reduced-motion behavior, and scene restoration.
- Replace the custom Google action with Google's official rendered button, sized to the sheet and localized for all ten locales.
- Keep the non-Google cancel action visually and keyboard accessible.
- Remove email OTP state, fields, copy usage, feature flag, and tests; there is one sign-in path.
- Keep Arabic RTL and the Alexandria font. Google's official Arabic button uses its own required typography and branding inside the provider control.
- Auth loading and failure states stay inside the sheet without causing layout jumps or overflow.

## Security

- Verify Google ID tokens only on the server using Google's maintained library.
- Validate token audience against `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and require a verified email claim.
- Use the Google `sub` only through an HMAC key; never persist raw `sub`.
- Sign session cookies with HMAC-SHA256 and compare signatures with `timingSafeEqual`.
- Validate same-origin on login, sign-out, deletion, Checkout, and generation mutations.
- Keep BotID, Redis generation limits, Secure cookies, no-store account responses, and existing security headers.
- Never expose Redis tokens, `SESSION_SECRET`, or Stripe secrets to the browser.

## Failure Handling

- Google script or popup failure: show the localized auth error and keep the scene.
- Invalid or expired Google credential: return 401 and set no cookie.
- Redis unavailable during login/account/Checkout: return 503 and create no partial account or purchase.
- Stripe unavailable: restore the offer state and preserve the scene.
- Credit finalization ambiguity: preserve the existing customer-safe image delivery and reconcile `/api/account` afterward.
- Webhook replay: return success with the unchanged balance.

## Migration and Rollout

No production Supabase user or credit data exists, so there is no data migration.

1. Add the Google client ID and authorized JavaScript origins for production and local development.
2. Implement Google session routes and Redis account/credit scripts behind the existing interfaces.
3. Replace the purchase and account Supabase calls.
4. Remove Supabase and email-OTP code and dependencies.
5. Run unit, route, localization, browser, mobile, desktop, RTL, reduced-motion, and build checks.
6. Configure the Google client ID in Vercel and deploy.
7. Smoke-test real Google sign-in, sign-out, deletion/re-sign-in, cross-browser balance, one live purchase, webhook replay, paid generation, and result-image inspection.
8. Refund the live smoke-test payment and remove any remaining test credits.

## Verification

Automated checks must cover:

- valid, invalid, wrong-audience, expired, and unverified-email Google credentials;
- signed-cookie tampering and expiry;
- concurrent first login returning one account UUID;
- immediate session revocation after deletion;
- Redis reserve/finalize/release boundaries and retries;
- purchase fulfillment idempotency and deleted-account rejection;
- existing two-free-doodle behavior and failure refunds;
- keyboard focus, mobile containment, desktop layout, Arabic RTL, reduced motion, and localized discovery pages.

Production evidence must include:

- successful Google sign-in on `doodle.samistudio.nl`;
- account balance shared across two browser sessions;
- exactly ten credits after one €4.99 payment and nine after one successful paid generation;
- no duplicate credits after webhook replay;
- successful account deletion and fresh empty account after signing in again;
- screenshots at mobile, narrow mobile, desktop, and Arabic RTL sizes.

## Non-goals

- Apple login, email OTP, passwords, subscriptions, teams, saved prompts, image history, admin dashboards, and a general-purpose relational database.
- Migrating away from Redis before real usage proves the free tier insufficient.
