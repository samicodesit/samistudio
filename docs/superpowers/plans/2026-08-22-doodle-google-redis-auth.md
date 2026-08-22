# Doodle Google + Redis Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with direct Google sign-in and Redis-backed accounts and credits, then deploy and visually verify the complete monetized Doodle flow.

**Architecture:** Google Identity Services returns an ID token that Doodle verifies server-side before issuing its own signed HttpOnly session cookie. Existing Redis REST infrastructure atomically maps Google identities to random account UUIDs and stores paid balances, holds, deletion tombstones, and Stripe idempotency markers. Anonymous free allowances, Stripe Checkout, localization, and the public composer remain intact.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Google Identity Services, `google-auth-library`, Redis REST/Lua, Stripe Checkout, Vitest, Testing Library, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-22-doodle-google-redis-auth-design.md`

## Global Constraints

- No Supabase, Firebase, Clerk, email OTP, passwords, Apple login, subscriptions, saved prompts, or image history.
- Google `sub` must never be persisted raw; Redis keys use HMAC-SHA256 with `SESSION_SECRET`.
- Session cookies are signed, Secure in production, HttpOnly, SameSite=Lax, path `/`, and expire after 30 days.
- Paid-credit reservation, finalization, release, deletion, and fulfillment remain atomic Lua operations.
- Two anonymous doodles and the 200-generation/day global cap remain unchanged.
- Checkout remains one-time, exactly ten doodles for €4.99 EUR, adaptive pricing disabled, and failed generations do not consume credit.
- Prompts and generated images remain browser-memory-only.
- Preserve all ten locales, Arabic RTL/Alexandria, keyboard access, reduced-motion behavior, mobile containment, desktop layout, and image inspection.
- Do not create a Stripe tax registration without explicit confirmation that the business is VAT-registered in Slovakia.

---

### Task 1: Shared Redis Command Boundary and Paid Credit Ledger

**Files:**
- Create: `doodle/src/lib/redis.ts`
- Create: `doodle/src/lib/redis.test.ts`
- Modify: `doodle/src/lib/billing/credits.ts`
- Modify: `doodle/src/lib/billing/credits.test.ts`

**Interfaces:**
- Produces: `redisCommand(command: unknown[]): Promise<unknown>` and strict `redisInteger(value: unknown): number`.
- Preserves: `getPaidBalance`, `reservePaidCredit`, `finalizePaidCredit`, `releasePaidCredit`, and `fulfillCreditPack` signatures used by generation and Checkout.
- Adds: `deletePaidAccount(accountId: string, identityKey: string): Promise<void>` and `isPaidAccountActive(accountId: string): Promise<boolean>` for Tasks 2 and 3.

- [ ] **Step 1: Write failing Redis boundary tests**

Add tests proving missing credentials, non-2xx responses, malformed JSON, missing `result`, and unsafe integers throw a single customer-safe infrastructure error. The successful request must be exactly:

```ts
expect(fetch).toHaveBeenCalledWith("https://redis.example", expect.objectContaining({
  method: "POST",
  headers: {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(["GET", "key"]),
  cache: "no-store",
}));
```

- [ ] **Step 2: Run the Redis tests and verify red**

Run: `npm test -- src/lib/redis.test.ts`

Expected: FAIL because `@/lib/redis` does not exist.

- [ ] **Step 3: Implement the minimal Redis REST helper**

Create a server-only module with this public shape:

```ts
import "server-only";

export async function redisCommand(command: unknown[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis unavailable");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Redis unavailable");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("result" in payload)) throw new Error("Redis unavailable");
  return payload.result;
}

export function redisInteger(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number)) throw new Error("Redis unavailable");
  return number;
}
```

Catch fetch and JSON failures and normalize them to `Redis unavailable`; never include the URL, token, command body, or provider response in errors.

- [ ] **Step 4: Write failing paid-ledger tests**

Mock `redisCommand` and assert exact operation behavior:

```ts
await expect(getPaidBalance(ACCOUNT_ID)).resolves.toBe(0); // null GET
await expect(reservePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ reserved: true, remaining: 9 });
await expect(finalizePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toEqual({ finalized: true, remaining: 8 });
await expect(releasePaidCredit(ACCOUNT_ID, RESERVATION_ID)).resolves.toBe(1);
await expect(fulfillCreditPack(ACCOUNT_ID, "cs_paid", "pi_paid")).resolves.toBe(10);
```

Also assert reserve rejects inactive/deleted accounts, concurrent holds never exceed balance, finalize retries do not double-decrement, fulfillment replay stays at ten, deletion removes credit keys, and fulfillment after deletion returns an account-deleted error.

- [ ] **Step 5: Run paid-ledger tests and verify red**

Run: `npm test -- src/lib/billing/credits.test.ts`

Expected: FAIL because the current implementation calls Supabase RPCs.

- [ ] **Step 6: Replace Supabase RPCs with Lua-backed Redis operations**

Use account keys generated only by strict UUID validation:

```ts
const accountKey = (id: string, suffix: string) => `doodle:account:${id}:${suffix}`;
const purchaseKey = (sessionId: string) => `doodle:purchase:${sessionId}`;
```

Implement four compact scripts with these invariants:

```lua
-- reserve
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[1])
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
local active = redis.call('ZCARD', KEYS[4])
if redis.call('ZSCORE', KEYS[4], ARGV[3]) then return {1, math.max(0, balance - active)} end
if balance <= active then return {0, 0} end
redis.call('ZADD', KEYS[4], ARGV[2], ARGV[3])
return {1, balance - active - 1}

-- finalize
if redis.call('HEXISTS', KEYS[5], ARGV[2]) == 1 then return {1, tonumber(redis.call('HGET', KEYS[5], ARGV[2]))} end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[1])
if redis.call('ZREM', KEYS[4], ARGV[2]) == 0 then return {0, 0} end
local balance = tonumber(redis.call('GET', KEYS[3]) or '0')
if balance <= 0 then return {0, 0} end
balance = redis.call('DECR', KEYS[3])
redis.call('HSET', KEYS[5], ARGV[2], balance)
return {1, balance}

-- release
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZREM', KEYS[1], ARGV[2])

-- fulfill
if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 1 then return {-1, 0} end
if redis.call('EXISTS', KEYS[4]) == 1 then return {0, tonumber(redis.call('GET', KEYS[3]) or '0')} end
redis.call('SET', KEYS[4], ARGV[1])
return {1, redis.call('INCRBY', KEYS[3], 10)}
```

The deletion script receives the signed identity-map key plus account keys, verifies the mapping still points to the account UUID, writes the opaque tombstone, and deletes mapping, active, balance, holds, and finalized keys atomically.

- [ ] **Step 7: Run ledger and existing generation tests**

Run: `npm test -- src/lib/redis.test.ts src/lib/billing/credits.test.ts src/app/api/generate/route.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add doodle/src/lib/redis.ts doodle/src/lib/redis.test.ts doodle/src/lib/billing/credits.ts doodle/src/lib/billing/credits.test.ts
git commit -m "feat(doodle): store paid credits in Redis"
```

---

### Task 2: Google Account Registry and Signed Sessions

**Files:**
- Create: `doodle/src/lib/auth/google.ts`
- Create: `doodle/src/lib/auth/google.test.ts`
- Create: `doodle/src/lib/auth/accounts.ts`
- Create: `doodle/src/lib/auth/accounts.test.ts`
- Create: `doodle/src/lib/auth/session.ts`
- Create: `doodle/src/lib/auth/session.test.ts`
- Create: `doodle/src/app/api/auth/google/route.ts`
- Create: `doodle/src/app/api/auth/google/route.test.ts`
- Create: `doodle/src/app/api/auth/sign-out/route.ts`
- Create: `doodle/src/app/api/auth/sign-out/route.test.ts`
- Modify: `doodle/package.json`
- Modify: `doodle/package-lock.json`
- Modify: `doodle/.env.example`

**Interfaces:**
- Produces: `verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string }>`.
- Produces: `createOrGetGoogleAccount(sub: string): Promise<{ id: string; identityKey: string }>`.
- Produces: `SessionUser = { id: string; email: string; identityKey: string }` and `getCurrentUser(): Promise<SessionUser | null>`.
- Produces: `setSessionCookie(response, user)` and `clearSessionCookie(response)`.
- Consumes: `redisCommand`, `isPaidAccountActive`, and `deletePaidAccount` from Task 1.

- [ ] **Step 1: Install only Google's maintained server verifier**

Run: `npm install google-auth-library`

Do not add Firebase, Clerk, Auth.js, a JWT library, or a client wrapper. The browser uses Google's native script.

- [ ] **Step 2: Write failing Google verification tests**

Mock `OAuth2Client.verifyIdToken` and cover:

```ts
await expect(verifyGoogleCredential("credential")).resolves.toEqual({ sub: "google-sub", email: "buyer@gmail.com" });
await expect(verifyGoogleCredential("")).rejects.toThrow("Invalid Google credential");
```

Reject missing `sub`, missing email, `email_verified !== true`, wrong audience, expired credentials, and verifier errors. Assert `verifyIdToken` receives `audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

- [ ] **Step 3: Implement Google verification**

```ts
const client = new OAuth2Client();

export async function verifyGoogleCredential(credential: string) {
  if (!credential || credential.length > 8192) throw new Error("Invalid Google credential");
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: required("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("Invalid Google credential");
  return { sub: payload.sub, email: payload.email };
}
```

Use the library's signature, issuer, audience, and expiry verification. Do not decode JWTs manually.

- [ ] **Step 4: Write failing account-registry tests**

Assert HMAC identity keys do not contain raw Google `sub`, concurrent first-login retries resolve to the same UUID, active markers are created, malformed Redis UUIDs fail closed, and deletion calls `deletePaidAccount` with the exact mapping key.

- [ ] **Step 5: Implement the Redis account registry**

```ts
export async function createOrGetGoogleAccount(sub: string) {
  const identityKey = createHmac("sha256", required("SESSION_SECRET")).update(sub).digest("hex");
  const candidate = randomUUID();
  const id = await redisCommand([
    "EVAL", CREATE_ACCOUNT_SCRIPT, "1", `doodle:auth:google:${identityKey}`,
    candidate, "doodle:account:",
  ]);
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new Error("Redis unavailable");
  return { id, identityKey };
}
```

The Lua script uses `GET`, `SET ... NX`, and a final `GET` so concurrent logins converge on one UUID; it sets `doodle:account:<uuid>:active` to `1`.

- [ ] **Step 6: Write failing signed-session tests**

Use a fixed `SESSION_SECRET` and assert round-trip, tampered payload, tampered signature, expired payload, malformed email, malformed UUID, inactive account, deleted account, and cookie attributes.

- [ ] **Step 7: Implement signed sessions**

Use `createHmac`, `timingSafeEqual`, base64url JSON, and `cookies()` from `next/headers`. Keep the payload shape exact:

```ts
type SessionPayload = {
  id: string;
  identityKey: string;
  email: string;
  exp: number;
};
```

`getCurrentUser` returns null for missing, malformed, bad-signature, or expired cookies; Redis errors propagate; inactive accounts return null. Set `maxAge` to `2_592_000` seconds.

- [ ] **Step 8: Write failing auth-route tests**

Cover cross-origin 403, malformed body 400, invalid Google token 401, Redis failure 503, success 204 with session cookie, and sign-out 204 with an expired cookie.

- [ ] **Step 9: Implement login and sign-out routes**

```ts
export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { credential } = await request.json();
  const google = await verifyGoogleCredential(credential);
  const account = await createOrGetGoogleAccount(google.sub);
  const response = new NextResponse(null, { status: 204 });
  setSessionCookie(response, { ...account, email: google.email });
  return response;
}
```

Normalize JSON, token, and Redis failures into the tested status codes without leaking provider details.

- [ ] **Step 10: Run Task 2 tests and static checks**

Run:

```bash
npm test -- src/lib/auth/google.test.ts src/lib/auth/accounts.test.ts src/lib/auth/session.test.ts src/app/api/auth/google/route.test.ts src/app/api/auth/sign-out/route.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 11: Commit Task 2**

```bash
git add doodle/package.json doodle/package-lock.json doodle/.env.example doodle/src/lib/auth doodle/src/app/api/auth
git commit -m "feat(doodle): add direct Google sessions"
```

---

### Task 3: Switch Account, Generation, and Checkout Consumers

**Files:**
- Modify: `doodle/src/app/api/account/route.ts`
- Modify: `doodle/src/app/api/account/route.test.ts`
- Modify: `doodle/src/app/api/generate/route.ts`
- Modify: `doodle/src/app/api/generate/route.test.ts`
- Modify: `doodle/src/app/api/checkout/route.ts`
- Modify: `doodle/src/app/api/checkout/route.test.ts`
- Modify: `doodle/src/app/api/checkout/confirm/route.ts`
- Modify: `doodle/src/app/api/checkout/confirm/route.test.ts`
- Modify: `doodle/src/lib/billing/checkout.ts`
- Modify: `doodle/src/lib/billing/checkout.test.ts`
- Modify: `doodle/src/app/api/stripe/webhook/route.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `clearSessionCookie`, `deletePaidAccount`, and unchanged paid-ledger functions.
- Preserves: API response shapes, Stripe metadata, fixed-pack validation, free-cookie behavior, and existing client reconciliation headers.

- [ ] **Step 1: Update route tests first**

Change mocks from `@/lib/supabase/session` and Supabase Admin to `@/lib/auth/session` and `@/lib/auth/accounts`. Add assertions that:

```ts
expect(deletePaidAccount).toHaveBeenCalledWith(user.id, user.identityKey);
expect(clearSessionCookie).toHaveBeenCalledWith(response);
```

Keep all existing same-origin, malformed confirmation, unauthenticated, reservation, finalization, checkout validation, and webhook replay tests.

- [ ] **Step 2: Run focused route tests and verify red**

Run:

```bash
npm test -- src/app/api/account/route.test.ts src/app/api/generate/route.test.ts src/app/api/checkout/route.test.ts src/app/api/checkout/confirm/route.test.ts src/lib/billing/checkout.test.ts src/app/api/stripe/webhook/route.test.ts
```

Expected: FAIL on old Supabase imports and admin calls.

- [ ] **Step 3: Replace session imports without changing route contracts**

Use `@/lib/auth/session` in generation, account, Checkout, and confirmation routes. Preserve controlled 503 responses when session or Redis validation throws.

For account deletion:

```ts
await deletePaidAccount(user.id, user.identityKey);
const response = new NextResponse(null, { status: 204 });
clearSessionCookie(response);
return response;
```

- [ ] **Step 4: Remove the Supabase user lookup from fulfillment**

Keep all current Stripe validation, then call the Redis script directly:

```ts
return fulfillCreditPack(userId, sessionId, session.payment_intent);
```

An inactive/deleted account is rejected by the atomic fulfillment script. Do not add a separate race-prone read before fulfillment.

- [ ] **Step 5: Run focused tests and static checks**

Run:

```bash
npm test -- src/app/api/account/route.test.ts src/app/api/generate/route.test.ts src/app/api/checkout/route.test.ts src/app/api/checkout/confirm/route.test.ts src/lib/billing/checkout.test.ts src/app/api/stripe/webhook/route.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add doodle/src/app/api/account doodle/src/app/api/generate doodle/src/app/api/checkout doodle/src/app/api/stripe/webhook/route.test.ts doodle/src/lib/billing/checkout.ts doodle/src/lib/billing/checkout.test.ts
git commit -m "refactor(doodle): use Google Redis accounts"
```

---

### Task 4: Official Google Button and Account UX

**Files:**
- Create: `doodle/src/components/google-sign-in-button.tsx`
- Create: `doodle/src/components/google-sign-in-button.test.tsx`
- Create: `doodle/src/types/google-identity.d.ts`
- Modify: `doodle/src/components/purchase-dialog.tsx`
- Modify: `doodle/src/components/purchase-dialog.test.tsx`
- Modify: `doodle/src/components/doodle-client.test.tsx`
- Modify: `doodle/src/components/account-menu.tsx`
- Modify: `doodle/src/components/account-menu.test.tsx`
- Modify: `doodle/src/app/globals.css`

**Interfaces:**
- Produces: `<GoogleSignInButton locale busy onCredential onError />`.
- Consumes: `POST /api/auth/google`, `POST /api/auth/sign-out`, and `/api/account`.
- Preserves: dialog focus restoration, scene persistence, Checkout continuation, loading therapy, RTL, reduced motion, and no overflow.

- [ ] **Step 1: Write failing official-button tests**

Stub `window.google.accounts.id` and assert initialization uses the configured client ID, `renderButton` receives the mapped locale and measured width, the credential callback forwards only the credential string, resize rerenders safely, and script failure calls `onError`.

Locale mapping is exact:

```ts
const GOOGLE_LOCALE = {
  en: "en", nl: "nl", de: "de", fr: "fr", es: "es",
  "pt-br": "pt_BR", it: "it", ja: "ja", ko: "ko", ar: "ar",
} as const;
```

- [ ] **Step 2: Implement the native Google component**

Use `next/script`, a container ref, and native `ResizeObserver`. Render Google's required button into an empty container:

```ts
google.accounts.id.initialize({
  client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  callback: ({ credential }) => onCredential(credential),
  use_fedcm_for_prompt: true,
});
google.accounts.id.renderButton(container, {
  type: "standard",
  theme: "outline",
  size: "large",
  text: "continue_with",
  shape: "rectangular",
  logo_alignment: "left",
  width: Math.floor(container.clientWidth),
  locale: GOOGLE_LOCALE[locale],
});
```

Show a fixed-height localized loading treatment until the provider control is ready so the dialog does not jump.

- [ ] **Step 3: Write failing purchase and account interaction tests**

Replace Supabase browser mocks with fetch assertions:

```ts
expect(fetch).toHaveBeenCalledWith("/api/auth/google", expect.objectContaining({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ credential: "google-token" }),
}));
expect(fetch).toHaveBeenCalledWith("/api/auth/sign-out", { method: "POST" });
```

Cover login error, account refresh, existing balance closes the purchase sheet, zero balance continues to Checkout, sign-out refresh, deletion refresh, focus order, and preserved scene.

- [ ] **Step 4: Replace purchase-sheet Supabase flows**

Delete email/code state, OTP normalization, forms, and feature-flag branches. On Google credential:

1. save the scene return intent;
2. POST the credential;
3. refresh `/api/account`;
4. close if the returned balance is positive;
5. otherwise create Checkout and navigate.

Provider/script/popup errors use the existing localized auth error.

- [ ] **Step 5: Replace account-menu sign-out**

POST `/api/auth/sign-out`, then refresh `/api/account`. The delete endpoint already clears the cookie; refresh immediately after a successful 204.

- [ ] **Step 6: Style and visually contain the provider control**

Use the existing purchase-sheet spacing and shadows. Add only a container and loading-state rule; do not restyle Google's internal iframe or add substitute logos/SVGs. Ensure widths fit 320 px screens and RTL alignment remains intentional.

- [ ] **Step 7: Run component tests and static checks**

Run:

```bash
npm test -- src/components/google-sign-in-button.test.tsx src/components/purchase-dialog.test.tsx src/components/account-menu.test.tsx src/components/doodle-client.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add doodle/src/components doodle/src/types/google-identity.d.ts doodle/src/app/globals.css
git commit -m "feat(doodle): add polished Google sign-in"
```

---

### Task 5: Delete Supabase and Email-OTP Debt, Update Documentation

**Files:**
- Delete: `doodle/src/lib/supabase/admin.ts`
- Delete: `doodle/src/lib/supabase/browser.ts`
- Delete: `doodle/src/lib/supabase/browser.test.ts`
- Delete: `doodle/src/lib/supabase/env.ts`
- Delete: `doodle/src/lib/supabase/server.ts`
- Delete: `doodle/src/lib/supabase/session.ts`
- Delete: `doodle/src/app/auth/callback/route.ts`
- Delete: `doodle/src/app/auth/callback/route.test.ts`
- Delete: `doodle/supabase/migrations/202608210001_doodle_credits.sql`
- Delete: `doodle/src/lib/billing/credits-migration.test.ts`
- Modify: `doodle/src/lib/i18n.ts`
- Modify: `doodle/src/lib/i18n.test.ts`
- Modify: `doodle/package.json`
- Modify: `doodle/package-lock.json`
- Modify: `doodle/.env.example`
- Modify: `doodle/README.md`

**Interfaces:**
- Removes all Supabase and email-OTP interfaces.
- Preserves all user-visible Google, purchase, account, generation, and SEO copy in ten locales.

- [ ] **Step 1: Add a failing dead-dependency assertion**

Extend the configuration test to read `package.json`, `.env.example`, and tracked source names and assert none contains runtime references to:

```ts
expect(serialized).not.toMatch(/@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_EMAIL_OTP_ENABLED/);
```

- [ ] **Step 2: Remove dead files, dependencies, env keys, and OTP copy**

Run `npm uninstall @supabase/ssr @supabase/supabase-js`, delete the listed Supabase/migration files, remove email OTP fields from `DoodleCopy`, and mechanically remove those fields from all ten locale objects. Keep the Google auth error and Google action copy.

Move the small `required(name)` helper to `doodle/src/lib/env.ts`, update Stripe/Google imports, and test missing values without mentioning Supabase.

- [ ] **Step 3: Rewrite setup documentation**

Document only:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`;
- the three authorized JavaScript origins (`https://doodle.samistudio.nl`, `http://localhost:3000`, `http://127.0.0.1:3100`);
- existing Redis REST credentials;
- Stripe variables and the Slovak tax-registration gate;
- signed-cookie and Redis account behavior;
- exact local test commands.

- [ ] **Step 4: Run repository scans and the full local suite**

Run:

```bash
rg -n "supabase|EMAIL_OTP|signInWithOtp|verifyOtp" doodle --glob '!package-lock.json'
npm test
npm run typecheck
npm run lint
npm run build
CI=1 npm run test:e2e -- --retries=0
```

Expected: the scan returns only historical design/plan documentation if those paths are included;  all executable-source scans are empty;  all automated checks pass.

- [ ] **Step 5: Inspect local UI at launch viewports**

Capture and inspect:

- 320×700 English purchase/auth;
- 390×844 English purchase/auth/account/delete/success;
- 390×844 Arabic purchase/auth/account/delete/success;
- 1440×1000 English purchase/auth/account/success;
- reduced-motion versions of purchase/auth;
- keyboard focus from offer through Google, cancel, account, and deletion controls.

Verify no horizontal overflow, provider-button clipping, unexpected scrolling, layout jump, untranslated copy, broken RTL, or focus loss. Adjust CSS and rerun the focused component/browser tests if any defect is visible.

- [ ] **Step 6: Commit Task 5**

```bash
git add -A doodle
git commit -m "chore(doodle): remove Supabase auth"
```

---

### Task 6: Production Configuration, Stripe Provisioning, Deployment, and Live QA

**Files:**
- Modify only if production evidence reveals a defect: files directly responsible for that defect plus one focused regression test.

**Interfaces:**
- Consumes the completed Google/Redis app and existing Vercel project `doodle`.
- Produces a public production deployment at `https://doodle.samistudio.nl` with verified sign-in, purchase, balance, generation, deletion, localization, and image-modal behavior.

- [ ] **Step 1: Verify isolated Redis capacity and health**

Identify the Doodle Redis integration without exposing credentials. Confirm it responds to `PING`, is not shared with Supabase, and is free or capped at zero cost. If it is not, create a dedicated Upstash free database, claim it, and replace only `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and read-only aliases in Doodle's Vercel project.

- [ ] **Step 2: Create the Doodle Google web client**

In Google Auth Platform create one Web application client named `Doodle` with authorized JavaScript origins:

```text
https://doodle.samistudio.nl
http://localhost:3000
http://127.0.0.1:3100
```

No client secret is consumed by Doodle and no redirect URI is needed for the JavaScript popup callback. Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to Doodle Production in Vercel without printing it in logs.

- [ ] **Step 3: Confirm the Stripe tax position before mutation**

Verify current evidence: Stripe Tax status `active`, head office `SK`, registrations `[]`. Ask the owner exactly whether the business is VAT-registered in Slovakia.

- If confirmed registered: create the live Slovak registration using the registration type supplied by the owner, then rerun the reviewed live Stripe provisioner.
- If confirmed not registered: do not create a false registration; stop automatic-tax provisioning and obtain the owner's explicit tax-handling instruction before deployment.

- [ ] **Step 4: Provision the fixed Stripe pack**

Using the local `sk_live_` key without logging it, create or reuse:

- product `Doodle — 10 doodles`, metadata `app=doodle`, `credits=10`;
- one-time EUR 499 inclusive price, tax code `txcd_10000000`;
- webhook `https://doodle.samistudio.nl/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Set `STRIPE_SECRET_KEY`, `STRIPE_DOODLE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` in Vercel Production. Refuse duplicates and roll back a newly-created webhook if its signing secret cannot be stored.

- [ ] **Step 5: Deploy the exact verified commit**

Run:

```bash
git status --short --branch
git push
cd doodle && vercel --prod --yes
```

Confirm `https://doodle.samistudio.nl` resolves to the new deployment and remains public without password protection.

- [ ] **Step 6: Run real production authentication smoke tests**

In a normal browser session:

1. Open the purchase gate after the two free doodles.
2. Sign in with Google.
3. Confirm the scene remains present.
4. Sign out and sign in again; confirm the same balance.
5. Open a second browser profile; sign in to the same Google account and confirm the same balance.
6. Delete the account, confirm the cookie is invalid immediately, sign in again, and confirm a fresh zero-credit account.

- [ ] **Step 7: Run one live €4.99 purchase and credit smoke test**

1. Complete Checkout once.
2. Confirm exactly ten credits.
3. Replay the signed webhook and confirm the balance remains ten.
4. Generate one successful paid doodle and confirm the balance becomes nine.
5. Force a failed generation and confirm the balance stays nine.
6. Confirm the second browser profile also reports nine.
7. Refund the test payment in Stripe and delete the smoke-test account so no test credits remain.

- [ ] **Step 8: Run production visual and accessibility QA**

Capture mobile, narrow-mobile, desktop, Arabic RTL, and reduced-motion screenshots of composer, loading, result, enlarged image, purchase offer, Google sign-in, Checkout return, account menu, deletion warning, and success states. Verify the result preview and reference doodle both open larger; `Open in new tab` opens the native image directly.

- [ ] **Step 9: Verify production abuse controls and logs**

Confirm Vercel OIDC remains enabled, BotID returns a controlled response, the WAF 3/60 rule rejects bursts, Redis 20/client and 200/global limits remain atomic, and Vercel logs contain no secrets, raw Google IDs, prompts, generated images, or unhandled errors.

- [ ] **Step 10: Final verification and commit any evidence-driven fix**

If live QA reveals a defect, use systematic debugging, add one focused failing regression test, apply the smallest root-cause fix, rerun unit/type/lint/build/E2E, redeploy, and repeat only the affected production checks. Otherwise leave the verified commit unchanged.
