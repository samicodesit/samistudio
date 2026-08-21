# Doodle Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each browser two free successful doodles, then let customers sign in with Google or email OTP and buy ten more for one VAT-inclusive €4.99 payment.

**Architecture:** Keep the public page anonymous and use a signed HTTP-only browser cookie plus the existing Redis store for the two-use trial. Supabase Auth provides cookie-based Google/email sessions, PostgreSQL RPC functions own atomic paid-credit accounting, and Stripe-hosted Checkout owns payment and tax collection. The generation route reserves one free use or paid credit before calling OpenAI and refunds that reservation on every failure path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, native `<dialog>`, Supabase Auth/Postgres/SSR, Stripe Checkout/Tax/Webhooks, Upstash Redis REST, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-21-doodle-monetization-design.md`

## Global Constraints

- Two successful doodles are free per signed browser identity.
- Ten additional doodles cost exactly €4.99 once; EUR only, VAT-inclusive, no Adaptive Pricing.
- Google OAuth and six-digit email OTP are the only launch authentication methods.
- Failed, refused, timed-out, malformed, or rate-limited generations restore the reservation exactly once.
- Paid generations bypass the existing free daily budget but still pass same-origin, BotID, and Vercel burst protection.
- AutoLister shares only the Stripe account secret; its users, database, products, prices, and webhook remain untouched.
- Use native browser behavior and existing project patterns; add no state, form, dialog, animation, or icon dependency.
- All customer-facing copy ships in the existing ten locales, including complete Arabic RTL behavior.
- Secrets remain server-only; fixed localized redirects replace arbitrary callback URLs.

---

### Task 1: Install the payment/auth clients and create the credit schema

**Files:**
- Modify: `doodle/package.json`
- Modify: `doodle/package-lock.json`
- Modify: `doodle/.env.example`
- Create: `doodle/supabase/migrations/202608210001_doodle_credits.sql`

**Interfaces:**
- Consumes: Existing npm application and a dedicated Supabase project.
- Produces: PostgreSQL tables `credit_balances` and `credit_transactions`; RPCs `reserve_paid_credit(uuid, text)`, `refund_paid_credit(uuid, text)`, and `fulfill_credit_pack(uuid, text, text)`.

- [ ] **Step 1: Install only the required official clients**

Run:

```bash
cd doodle
npm install @supabase/ssr @supabase/supabase-js stripe
```

Expected: npm updates `package.json` and `package-lock.json` without adding UI, ORM, or auth-framework packages.

- [ ] **Step 2: Document the exact environment contract**

Append to `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_DOODLE_PRICE_ID=
```

Keep the existing OpenAI, Redis, and `SESSION_SECRET` entries. Never expose the service-role or Stripe values through `NEXT_PUBLIC_` variables.

- [ ] **Step 3: Write the database migration**

Create `supabase/migrations/202608210001_doodle_credits.sql` with this schema and fixed-value RPC contract:

```sql
create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'reserve', 'refund')),
  amount integer not null,
  external_id text not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create unique index credit_transactions_payment_intent_key
  on public.credit_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

create policy "users read own balance"
  on public.credit_balances for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.reserve_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  if exists (
    select 1 from public.credit_transactions
    where kind = 'reserve' and external_id = p_reservation_id and user_id = p_user_id
  ) then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  update public.credit_balances
    set balance = balance - 1, updated_at = now()
    where user_id = p_user_id and balance > 0
    returning balance into next_balance;
  if not found then return -1; end if;

  insert into public.credit_transactions (user_id, kind, amount, external_id)
  values (p_user_id, 'reserve', -1, p_reservation_id);
  return next_balance;
end;
$$;

create or replace function public.refund_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  if not exists (
    select 1 from public.credit_transactions
    where kind = 'reserve' and external_id = p_reservation_id and user_id = p_user_id
  ) then
    raise exception 'unknown reservation';
  end if;

  insert into public.credit_transactions (user_id, kind, amount, external_id)
  values (p_user_id, 'refund', 1, p_reservation_id)
  on conflict (kind, external_id) do nothing;
  if not found then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + 1, updated_at = now()
  returning balance into next_balance;
  return next_balance;
end;
$$;

create or replace function public.fulfill_credit_pack(
  p_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  insert into public.credit_transactions (
    user_id, kind, amount, external_id, stripe_payment_intent_id
  ) values (
    p_user_id, 'purchase', 10, p_checkout_session_id, p_payment_intent_id
  ) on conflict do nothing;
  if not found then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 10)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + 10, updated_at = now()
  returning balance into next_balance;
  return next_balance;
end;
$$;

revoke all on function public.reserve_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.fulfill_credit_pack(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_paid_credit(uuid, text) to service_role;
grant execute on function public.refund_paid_credit(uuid, text) to service_role;
grant execute on function public.fulfill_credit_pack(uuid, text, text) to service_role;
```

- [ ] **Step 4: Apply and smoke-check the migration in the dedicated Supabase project**

Run the migration in the Supabase SQL editor, then run:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('credit_balances', 'credit_transactions')
order by table_name;

select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name in ('reserve_paid_credit', 'refund_paid_credit', 'fulfill_credit_pack')
order by routine_name;
```

Expected: two table rows and three routine rows. In Auth settings, enable Google and Email, set email OTP expiry to 600 seconds, and change the email template to display `{{ .Token }}` as the six-digit code.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run typecheck
git add package.json package-lock.json .env.example supabase/migrations/202608210001_doodle_credits.sql
git commit -m "feat(doodle): add monetization storage"
```

Expected: typecheck passes and the commit contains only dependency, environment-contract, and migration files.

---

### Task 2: Add minimal Supabase session plumbing

**Files:**
- Create: `doodle/src/lib/supabase/browser.ts`
- Create: `doodle/src/lib/supabase/server.ts`
- Create: `doodle/src/lib/supabase/admin.ts`
- Create: `doodle/src/lib/supabase/session.ts`
- Create: `doodle/src/app/auth/callback/route.ts`
- Create: `doodle/src/app/auth/callback/route.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `getBrowserSupabase()`, `createServerSupabase()`, `getAdminSupabase()`, `getCurrentUser()`, and `GET(request)` for `/auth/callback`.

- [ ] **Step 1: Write the callback route tests first**

Before editing, read the repository-pinned Next 16 guidance at `doodle/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` and `doodle/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. The required behavior is asynchronous `cookies()`, cookie mutation only inside Route Handlers, and request-time/non-cached account responses.

Cover fixed redirects and code exchange in `route.test.ts`:

```ts
it("exchanges an OAuth code and returns only to a validated locale", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=ok&locale=de"));
  expect(exchangeCodeForSession).toHaveBeenCalledWith("ok");
  expect(response.headers.get("location")).toBe("https://doodle.test/de?auth=success");
});

it("does not accept an arbitrary redirect", async () => {
  const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=ok&locale=https://evil.test"));
  expect(response.headers.get("location")).toBe("https://doodle.test/?auth=success");
});

it("returns a fixed auth error when exchange fails", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
  const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=bad&locale=ar"));
  expect(response.headers.get("location")).toBe("https://doodle.test/ar?auth=error");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm test -- src/app/auth/callback/route.test.ts
```

Expected: FAIL because the route and Supabase helpers do not exist.

- [ ] **Step 3: Implement the three official Supabase client shapes**

Use `createBrowserClient` once in `browser.ts`; use `createServerClient` plus Next's asynchronous `cookies()` in `server.ts`; use `createClient` with `auth: { persistSession: false, autoRefreshToken: false }` in `admin.ts`. Centralize required environment reads with a small `required(name)` function that throws when a key is absent.

`session.ts` exposes this exact result so callers distinguish anonymous users from infrastructure failure:

```ts
export type SessionUser = { id: string; email: string | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
```

The server cookie adapter must call `cookieStore.getAll()` and apply every cookie from Supabase with `cookieStore.set(name, value, options)`.

- [ ] **Step 4: Implement the fixed-locale OAuth callback**

Read `code` and `locale`; accept only `SUPPORTED_LOCALES`; call `exchangeCodeForSession(code)`; redirect to `${localePath(locale)}?auth=success` or `?auth=error`. Never read or forward a `next`, `returnTo`, or absolute URL parameter.

- [ ] **Step 5: Run auth tests and typecheck**

Run:

```bash
npm test -- src/app/auth/callback/route.test.ts
npm run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase src/app/auth/callback
git commit -m "feat(doodle): add passwordless sessions"
```

---

### Task 3: Implement the two-use browser trial

**Files:**
- Create: `doodle/src/lib/generation/free-allowance.ts`
- Create: `doodle/src/lib/generation/free-allowance.test.ts`

**Interfaces:**
- Consumes: `SESSION_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and `NextRequest` cookies.
- Produces: `getTrialIdentity(request)`, `setTrialCookie(response, identity)`, `getFreeRemaining(identity)`, `reserveFreeDoodle(identity, reservationId)`, `finalizeFreeDoodle(identity, reservationId)`, and `refundFreeDoodle(identity, reservationId)`.

- [ ] **Step 1: Write failing identity and reservation tests**

```ts
it("issues and verifies a signed opaque browser id", () => {
  vi.stubEnv("SESSION_SECRET", "test-secret");
  const identity = getTrialIdentity(new NextRequest("https://doodle.test"));
  const response = NextResponse.json({ ok: true });
  setTrialCookie(response, identity);
  const value = response.cookies.get("doodle_trial")?.value;
  expect(value).toMatch(/^[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
  expect(getTrialIdentity(requestWithCookie(value!)).id).toBe(identity.id);
});

it("allows exactly two reservations", async () => {
  redisResult.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 0]);
  await expect(reserveFreeDoodle(identity, "one")).resolves.toMatchObject({ reserved: true, remaining: 1 });
  await expect(reserveFreeDoodle(identity, "two")).resolves.toMatchObject({ reserved: true, remaining: 0 });
  await expect(reserveFreeDoodle(identity, "three")).resolves.toMatchObject({ reserved: false, remaining: 0 });
});

it("refunds a failed reservation once", async () => {
  redisResult.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await expect(refundFreeDoodle(identity, "one")).resolves.toBe(1);
  await expect(refundFreeDoodle(identity, "one")).resolves.toBe(0);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- src/lib/generation/free-allowance.test.ts
```

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement signed identity without storing personal data**

Use `randomUUID()`, `createHmac("sha256", secret).digest("base64url")`, and `timingSafeEqual`. The cookie is `doodle_trial`, HTTP-only, SameSite=Lax, path `/`, secure in production, and expires after 31,536,000 seconds. Invalid signatures create a new identity.

- [ ] **Step 4: Implement three small Redis Lua operations**

Use keys `doodle:trial:used:{browserId}` and `doodle:trial:reservation:{browserId}:{reservationId}` with the same one-year TTL:

```lua
-- reserve: return {reserved, remaining}
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= 2 then return {0, 0} end
if not redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[1]) then return {0, 2 - used} end
used = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
return {1, 2 - used}
```

```lua
-- finalize: remove the pending marker without changing usage
return redis.call('DEL', KEYS[1])
```

```lua
-- refund: decrement only while the pending marker still exists
if redis.call('DEL', KEYS[2]) == 0 then return 0 end
local used = math.max(0, tonumber(redis.call('GET', KEYS[1]) or '0') - 1)
redis.call('SET', KEYS[1], used, 'EX', ARGV[1])
return 1
```

All malformed/non-2xx Redis responses throw; callers fail closed.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/lib/generation/free-allowance.test.ts
git add src/lib/generation/free-allowance.ts src/lib/generation/free-allowance.test.ts
git commit -m "feat(doodle): meter anonymous trial"
```

Expected: focused tests pass.

---

### Task 4: Add atomic paid-credit and Stripe pack services

**Files:**
- Create: `doodle/src/lib/billing/credits.ts`
- Create: `doodle/src/lib/billing/credits.test.ts`
- Create: `doodle/src/lib/billing/stripe.ts`
- Create: `doodle/src/lib/billing/checkout.ts`
- Create: `doodle/src/lib/billing/checkout.test.ts`

**Interfaces:**
- Consumes: Supabase RPCs from Task 1, admin client from Task 2, and `STRIPE_SECRET_KEY`/`STRIPE_DOODLE_PRICE_ID`.
- Produces: `getPaidBalance(userId)`, `reservePaidCredit(userId, reservationId)`, `refundPaidCredit(userId, reservationId)`, `createPackCheckout(input)`, and `fulfillCheckout(sessionId, expectedUserId?)`.

- [ ] **Step 1: Write failing credit wrapper tests**

```ts
it("maps -1 to an empty paid balance", async () => {
  rpc.mockResolvedValue({ data: -1, error: null });
  await expect(reservePaidCredit("user", "reservation")).resolves.toEqual({ reserved: false, remaining: 0 });
});

it("returns the balance after one reservation", async () => {
  rpc.mockResolvedValue({ data: 9, error: null });
  await expect(reservePaidCredit("user", "reservation")).resolves.toEqual({ reserved: true, remaining: 9 });
});

it("throws instead of guessing when Supabase fails", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("offline") });
  await expect(refundPaidCredit("user", "reservation")).rejects.toThrow("offline");
});
```

- [ ] **Step 2: Write failing Checkout service tests**

```ts
it("creates one fixed EUR pack with inclusive automatic tax", async () => {
  await createPackCheckout({ userId: "user", email: "buyer@example.com", locale: "de", origin: "https://doodle.test" });
  expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({
    mode: "payment",
    line_items: [{ price: "price_doodle", quantity: 1 }],
    automatic_tax: { enabled: true },
    adaptive_pricing: { enabled: false },
    allow_promotion_codes: false,
    client_reference_id: "user",
    metadata: { userId: "user", pack: "doodle_10" },
    success_url: "https://doodle.test/de?checkout={CHECKOUT_SESSION_ID}",
    cancel_url: "https://doodle.test/de?checkout=cancelled",
  }));
});

const USER_ID = "7d9ac733-9336-4c2a-93c1-5d597d0f7f8e";

it("fulfills one paid matching pack", async () => {
  sessions.retrieve.mockResolvedValue(paidMatchingSession);
  await expect(fulfillCheckout("cs_paid", USER_ID)).resolves.toBe(10);
  expect(fulfillCreditPack).toHaveBeenCalledWith(USER_ID, "cs_paid", "pi_paid");
});

it.each([
  ["unpaid", { ...paidMatchingSession, payment_status: "unpaid" }],
  ["wrong price", sessionWithPrice("price_other")],
  ["wrong user", { ...paidMatchingSession, metadata: { userId: "not-a-uuid", pack: "doodle_10" } }],
  ["missing payment intent", { ...paidMatchingSession, payment_intent: null }],
] as const)("rejects %s sessions", async (_label, session) => {
  sessions.retrieve.mockResolvedValue(session);
  await expect(fulfillCheckout("cs_bad", USER_ID)).rejects.toThrow();
  expect(fulfillCreditPack).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run both tests and confirm failure**

```bash
npm test -- src/lib/billing/credits.test.ts src/lib/billing/checkout.test.ts
```

Expected: FAIL because the billing modules are absent.

- [ ] **Step 4: Implement the minimal credit wrappers**

`credits.ts` calls the admin client's `rpc` methods with exact PostgreSQL argument names. Export these return types:

```ts
export type CreditReservation = { reserved: boolean; remaining: number };
export async function getPaidBalance(userId: string): Promise<number>;
export async function reservePaidCredit(userId: string, reservationId: string): Promise<CreditReservation>;
export async function refundPaidCredit(userId: string, reservationId: string): Promise<number>;
export async function fulfillCreditPack(userId: string, checkoutSessionId: string, paymentIntentId: string): Promise<number>;
```

Any Supabase error throws. Missing balance rows read as zero.

- [ ] **Step 5: Implement fixed Checkout creation and defensive fulfillment**

Create one lazy Stripe client in `stripe.ts` with the installed SDK's pinned API version. In `checkout.ts`, export:

```ts
export const PACK_CREDITS = 10;
export const PACK_PRICE = "€4.99";
export type CheckoutInput = { userId: string; email: string | null; locale: Locale; origin: string };
```

Checkout creation uses one configured Price, quantity one, `mode: "payment"`, Automatic Tax enabled, Adaptive Pricing disabled, promotion codes disabled, fixed localized URLs, `client_reference_id`, and metadata `{ userId, pack: "doodle_10" }`. Set Stripe's Checkout locale only when the Doodle locale has a direct Stripe locale; use `auto` otherwise.

Fulfillment retrieves the session with expanded line items, then requires all of:

```ts
session.payment_status === "paid"
session.metadata?.pack === "doodle_10"
session.metadata?.userId is a UUID
session.line_items.data.length === 1
session.line_items.data[0].price?.id === process.env.STRIPE_DOODLE_PRICE_ID
session.line_items.data[0].quantity === 1
typeof session.payment_intent === "string"
expectedUserId is absent or equals session.metadata.userId
```

Confirm the user still exists with `admin.auth.admin.getUserById` before calling `fulfillCreditPack`. Database uniqueness makes webhook/success retries idempotent.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- src/lib/billing/credits.test.ts src/lib/billing/checkout.test.ts
git add src/lib/billing
git commit -m "feat(doodle): add fixed credit pack"
```

---

### Task 5: Expose account, Checkout, confirmation, and webhook routes

**Files:**
- Create: `doodle/src/app/api/account/route.ts`
- Create: `doodle/src/app/api/account/route.test.ts`
- Create: `doodle/src/app/api/checkout/route.ts`
- Create: `doodle/src/app/api/checkout/route.test.ts`
- Create: `doodle/src/app/api/checkout/confirm/route.ts`
- Create: `doodle/src/app/api/stripe/webhook/route.ts`
- Create: `doodle/src/app/api/stripe/webhook/route.test.ts`

**Interfaces:**
- Consumes: Session, trial, credit, Checkout, same-origin, and BotID helpers.
- Produces: `AccountSummary`, `/api/account` GET/DELETE, `/api/checkout` POST, `/api/checkout/confirm` POST, and `/api/stripe/webhook` POST.

- [ ] **Step 1: Write account and Checkout route tests first**

```ts
it("reports anonymous free usage without requiring sign-in", async () => {
  getCurrentUser.mockResolvedValue(null);
  getFreeRemaining.mockResolvedValue(2);
  const response = await GET(request());
  expect(await response.json()).toEqual({ authenticated: false, email: null, balance: 0, freeRemaining: 2 });
});

it("reports the signed-in paid balance", async () => {
  getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  getPaidBalance.mockResolvedValue(7);
  const response = await GET(request());
  expect(await response.json()).toMatchObject({ authenticated: true, email: "buyer@example.com", balance: 7 });
});

it("requires auth before creating Checkout", async () => {
  getCurrentUser.mockResolvedValue(null);
  expect((await checkoutPOST(request("en"))).status).toBe(401);
  expect(createPackCheckout).not.toHaveBeenCalled();
});

it("rejects cross-origin and bot Checkout requests", async () => {
  expect((await checkoutPOST(crossOriginRequest())).status).toBe(403);
  checkBotId.mockResolvedValue({ isBot: true });
  expect((await checkoutPOST(request("en"))).status).toBe(403);
});

it("accepts only a known locale and returns Stripe's hosted URL", async () => {
  createPackCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  const response = await checkoutPOST(request("de"));
  expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/test" });
});
```

- [ ] **Step 2: Write webhook idempotency/security tests**

```ts
it("rejects a missing or invalid Stripe signature", async () => {
  constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
  expect((await POST(webhookRequest("payload", "bad"))).status).toBe(400);
  expect(fulfillCheckout).not.toHaveBeenCalled();
});

it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("fulfills %s", async (type) => {
  constructEvent.mockReturnValue({ type, data: { object: { id: "cs_paid" } } });
  expect((await POST(webhookRequest("payload", "valid"))).status).toBe(200);
  expect(fulfillCheckout).toHaveBeenCalledWith("cs_paid");
});

it("acknowledges unrelated events without fulfillment", async () => {
  constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });
  expect((await POST(webhookRequest("payload", "valid"))).status).toBe(200);
  expect(fulfillCheckout).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run route tests and confirm they fail**

```bash
npm test -- src/app/api/account/route.test.ts src/app/api/checkout/route.test.ts src/app/api/stripe/webhook/route.test.ts
```

Expected: FAIL because the routes do not exist.

- [ ] **Step 4: Implement account GET and irreversible deletion**

Export this shared response shape from the account route or a colocated `types.ts` only if both client and route need it:

```ts
export type AccountSummary = {
  authenticated: boolean;
  email: string | null;
  balance: number;
  freeRemaining: number | null;
};
```

GET reads/sets the trial cookie, reads the authenticated balance when present, and returns `Cache-Control: no-store`. DELETE requires same origin, `{ "confirm": true }`, and an authenticated user; call `admin.auth.admin.deleteUser(user.id)`. Cascades remove application rows while Stripe retains payment records.

- [ ] **Step 5: Implement Checkout and success confirmation**

Checkout POST order is same-origin, BotID, JSON locale validation, authenticated user, then `createPackCheckout`. Return only `{ url }`; return 401 for anonymous, 400 for invalid locale, 503 for billing configuration/service failure.

Confirmation POST accepts `{ sessionId }`, requires same origin and auth, calls `fulfillCheckout(sessionId, user.id)`, and returns `{ balance }`. It never trusts query parameters as payment proof.

- [ ] **Step 6: Implement raw-body webhook verification**

Set `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Read `await request.text()`, require the `stripe-signature` header, and call `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`. Fulfill only the two Checkout event types from the test; return 400 for signature errors and 500 for valid events whose fulfillment fails so Stripe retries.

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- src/app/api/account/route.test.ts src/app/api/checkout/route.test.ts src/app/api/stripe/webhook/route.test.ts
npm run typecheck
git add src/app/api/account src/app/api/checkout src/app/api/stripe
git commit -m "feat(doodle): expose purchase endpoints"
```

---

### Task 6: Reserve and refund usage around generation

**Files:**
- Modify: `doodle/src/app/api/generate/route.ts`
- Modify: `doodle/src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, paid-credit functions, free-allowance functions, and existing `checkGenerationLimit`.
- Produces: generation responses with `X-Doodle-Paid-Remaining` or `X-Doodle-Free-Remaining`, plus `402 { error: "payment_required" }` when no allowance remains.

- [ ] **Step 1: Extend the route tests with the accounting matrix**

Add focused tests for these exact branches:

```ts
it("uses paid credit first and bypasses the free daily limit", async () => {
  getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
  generateDoodle.mockResolvedValue(png);
  const response = await POST(request("Two cats hug"));
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Doodle-Paid-Remaining")).toBe("9");
  expect(checkGenerationLimit).not.toHaveBeenCalled();
});

it("uses free allowance when signed out or paid balance is empty", async () => {
  reserveFreeDoodle.mockResolvedValue({ reserved: true, remaining: 1 });
  expect((await POST(request("Two cats hug"))).headers.get("X-Doodle-Free-Remaining")).toBe("1");
});

it("returns payment_required before OpenAI after two free uses", async () => {
  reserveFreeDoodle.mockResolvedValue({ reserved: false, remaining: 0 });
  const response = await POST(request("Two cats hug"));
  expect(response.status).toBe(402);
  expect(await response.json()).toEqual({ error: "payment_required" });
  expect(generateDoodle).not.toHaveBeenCalled();
});

it.each(["refused", "timeout", "upstream", "malformed"])("refunds paid %s failures once", async (kind) => {
  reservePaidCredit.mockResolvedValue({ reserved: true, remaining: 9 });
  generateDoodle.mockRejectedValue(new GenerationError(kind, "failed"));
  await POST(request("Two cats hug"));
  expect(refundPaidCredit).toHaveBeenCalledTimes(1);
});

it("refunds a free reservation when the daily free budget rejects it", async () => {
  reserveFreeDoodle.mockResolvedValue({ reserved: true, remaining: 1 });
  checkGenerationLimit.mockResolvedValue("rate_limited");
  expect((await POST(request("Two cats hug"))).status).toBe(429);
  expect(refundFreeDoodle).toHaveBeenCalledTimes(1);
});
```

Also test malformed JSON/scene, same-origin failure, and BotID failure do not reserve anything; infrastructure failures return 503 without calling OpenAI.

- [ ] **Step 2: Run the route test and confirm failure**

```bash
npm test -- src/app/api/generate/route.test.ts
```

Expected: new accounting cases fail.

- [ ] **Step 3: Implement one reservation path in the route**

After scene validation, create `reservationId = randomUUID()` and identify the session. Attempt paid reservation first for an authenticated user. If paid is empty, reserve free allowance; only free reservations call the existing daily limiter. No allowance returns 402 without OpenAI.

Wrap `generateDoodle(scene)`, free finalization, and response construction in the failure handler. On PNG success, finalize a free reservation and send the remaining count header. If generation, free finalization, or response construction throws, attempt to refund the selected reservation exactly once before returning the mapped generation status or `{ error: "limit_unavailable" }` with 503. Reservation, session, Supabase, and Redis failures must never fall through to OpenAI.

- [ ] **Step 4: Run the complete generation test set**

```bash
npm test -- src/app/api/generate/route.test.ts src/lib/generation/free-allowance.test.ts src/lib/generation/generation-limit.test.ts
```

Expected: all pass and existing abuse controls remain covered.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts
git commit -m "feat(doodle): charge successful generations"
```

---

### Task 7: Build the compact purchase, passwordless auth, and account UI

**Files:**
- Modify: `doodle/src/lib/i18n.ts`
- Modify: `doodle/src/lib/i18n.test.ts`
- Create: `doodle/src/components/purchase-dialog.tsx`
- Create: `doodle/src/components/purchase-dialog.test.tsx`
- Create: `doodle/src/components/account-menu.tsx`
- Create: `doodle/src/components/account-menu.test.tsx`
- Modify: `doodle/src/components/scene-composer.tsx`
- Modify: `doodle/src/components/doodle-client.tsx`
- Modify: `doodle/src/components/doodle-client.test.tsx`
- Modify: `doodle/src/components/doodle-page.tsx`
- Modify: `doodle/src/components/doodle-page.test.tsx`
- Modify: `doodle/src/app/globals.css`

**Interfaces:**
- Consumes: `AccountSummary`, `/api/account`, `/api/checkout`, `/api/checkout/confirm`, `getBrowserSupabase`, and generation balance headers.
- Produces: `PurchaseDialog`, `AccountMenu`, preserved-scene return handling, localized trial/balance copy, and an updated paid WebApplication offer.

- [ ] **Step 1: Add failing purchase-dialog interaction tests**

```tsx
it("shows one honest offer and no subscription language", () => {
  render(<PurchaseDialog open account={anonymousAccount} scene="A cat" locale="en" copy={copy} onClose={onClose} onAccountChange={onAccountChange} />);
  expect(screen.getByRole("heading", { name: "Keep doodling" })).toBeVisible();
  expect(screen.getByText("10 more doodles")).toBeVisible();
  expect(screen.getByText("€4.99")).toBeVisible();
  expect(screen.getByText("One payment. No subscription.")).toBeVisible();
  expect(screen.queryByText(/discount|most popular|per month/i)).not.toBeInTheDocument();
});

it("offers Google and email code only after an anonymous buyer continues", async () => {
  await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Continue with email" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Apple/ })).not.toBeInTheDocument();
});

it("sends and verifies a six-digit email code", async () => {
  await user.type(screen.getByLabelText("Email address"), "buyer@example.com");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  expect(signInWithOtp).toHaveBeenCalledWith({ email: "buyer@example.com", options: { shouldCreateUser: true } });
  await user.type(screen.getByLabelText("Six-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify code" }));
  expect(verifyOtp).toHaveBeenCalledWith({ email: "buyer@example.com", token: "123456", type: "email" });
});

it("saves the scene and redirects an authenticated buyer to Stripe", async () => {
  checkoutFetch.mockResolvedValue(json({ url: "https://checkout.stripe.com/test" }));
  await user.click(screen.getByRole("button", { name: "Get 10 doodles" }));
  expect(sessionStorage.getItem("doodle:return")).toContain("A cat");
  expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/test");
});
```

- [ ] **Step 2: Add failing client/account tests**

```tsx
it("opens purchase without losing the scene on payment_required", async () => {
  fetch.mockResolvedValueOnce(accountResponse).mockResolvedValueOnce(new Response('{"error":"payment_required"}', { status: 402 }));
  renderClient();
  await user.type(screen.getByRole("textbox"), "Keep this exact scene");
  await user.click(screen.getByRole("button", { name: "Create doodle" }));
  expect(screen.getByRole("dialog", { name: "Keep doodling" })).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue("Keep this exact scene");
});

it("updates remaining usage from generation headers", async () => {
  fetch.mockResolvedValueOnce(accountResponse).mockResolvedValueOnce(imageResponse({ "X-Doodle-Free-Remaining": "1" }));
  renderClient();
  await createDoodle();
  expect(screen.getByText("1 free doodle left")).toBeVisible();
});

it("confirms a returned Checkout session once and shows success", async () => {
  history.replaceState({}, "", "/?checkout=cs_paid");
  sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A cat", intent: "checkout" }));
  fetch.mockResolvedValueOnce(accountResponse).mockResolvedValueOnce(json({ balance: 10 }));
  renderClient();
  expect(await screen.findByText("10 doodles added")).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue("A cat");
});
```

Account-menu tests cover showing email/balance, sign-out through `supabase.auth.signOut()`, the explicit unused-credit warning, same-origin DELETE with `{ confirm: true }`, and canceling deletion.

- [ ] **Step 3: Run component tests and verify failure**

```bash
npm test -- src/components/purchase-dialog.test.tsx src/components/account-menu.test.tsx src/components/doodle-client.test.tsx
```

Expected: FAIL because the monetization UI is absent.

- [ ] **Step 4: Extend the locale contract and all ten dictionaries**

Add these exact sections to `DoodleCopy`:

```ts
usage: {
  firstTwoFree: string;
  freeLeft: (count: number) => string;
  paidLeft: (count: number) => string;
};
purchase: {
  label: string;
  title: string;
  quantity: string;
  price: string;
  reassurance: string;
  failedDontCount: string;
  buy: string;
  cancel: string;
  restore: string;
  added: string;
  startDrawing: string;
  checkoutError: string;
};
auth: {
  google: string;
  email: string;
  emailLabel: string;
  sendCode: string;
  codeLabel: string;
  verifyCode: string;
  invalidCode: string;
  authError: string;
};
account: {
  label: string;
  balance: (count: number) => string;
  signOut: string;
  delete: string;
  deleteWarning: string;
  confirmDelete: string;
  cancelDelete: string;
};
```

English offer copy is exactly the approved text: `Keep doodling`, `10 more doodles`, `€4.99`, `One payment. No subscription.`, `Failed generations don't count.`, `Get 10 doodles`, `Not now`, `Already bought? Sign in`, `10 doodles added`, and `Start drawing`. Keep `€4.99` and `10` literal in every locale; write natural native-language sentences rather than translating English word order. Add i18n tests that call every count function with `1` and `2`, assert every locale has non-empty keys, and assert Arabic contains no Latin placeholder copy other than `Doodle`, `€4.99`, and numerals.

- [ ] **Step 5: Implement the native purchase dialog**

Follow the existing `ResultDialog` showModal/Escape/backdrop pattern. State progression is `offer -> signIn -> emailCode -> checkout -> success`; keep it local to the component. Google calls:

```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${location.origin}/auth/callback?locale=${locale}` },
});
```

Email uses the exact calls in the test. Auth success refreshes `/api/account` and returns to `offer`; authenticated purchase POSTs `{ locale }` to `/api/checkout`. Before OAuth or Checkout, save `{ scene, intent }` under `doodle:return` in `sessionStorage`.

- [ ] **Step 6: Implement account state and return recovery in `DoodleClient`**

On mount, GET `/api/account`. Show `firstTwoFree` beside the create action until one succeeds, then show the returned free count; when authenticated with credits, show paid balance. Map 402 to opening `PurchaseDialog`, not to a sticky-note error.

When the URL contains `auth=success`, restore the scene and reopen the offer. When it contains `checkout=cancelled`, restore the scene without erasing it. When `checkout=cs_...`, POST the session ID to confirmation, show the success state, update balance, then remove the query parameter and `doodle:return` with `history.replaceState`. Do not put the prompt in a URL or server payload except the existing generation request.

- [ ] **Step 7: Implement the compact account menu and styling**

Render `AccountMenu` quietly near usage information only when authenticated. Use `<details>` for the menu and native `<dialog>` for deletion confirmation. After successful deletion, call `supabase.auth.signOut()`, replace the local account with the anonymous summary returned by a fresh `/api/account` GET, and close the menu. Update `globals.css` using the current graphite/moss/sticky/paper variables; mobile purchase dialog is full-width at the viewport bottom, desktop is a compact centered card. Buttons remain at least 44px, backdrop/Escape/focus behavior remains accessible, and reduced-motion disables the short paper entrance. Add no SVG, card-brand art, pricing table, fake badge, or permanent header counter.

- [ ] **Step 8: Update structured data and run component coverage**

Change `DoodlePage`'s `offers` to truthful visible offers:

```ts
offers: [
  { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "First 2 doodles free" },
  { "@type": "Offer", price: "4.99", priceCurrency: "EUR", description: "10 doodles" },
]
```

Run:

```bash
npm test -- src/lib/i18n.test.ts src/components/purchase-dialog.test.tsx src/components/account-menu.test.tsx src/components/doodle-client.test.tsx src/components/doodle-page.test.tsx
npm run typecheck
npm run lint
```

Expected: all pass with no untranslated missing keys, overflow regressions, or lint/type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/i18n.ts src/lib/i18n.test.ts src/components src/app/globals.css
git commit -m "feat(doodle): add compact purchase experience"
```

---

### Task 8: Verify complete workflows and configure production

**Files:**
- Modify: `doodle/e2e/doodle.spec.ts`
- Modify: `doodle/README.md`

**Interfaces:**
- Consumes: Complete Tasks 1-7, Stripe test mode, Supabase Auth, Vercel environment, BotID/WAF.
- Produces: Browser regression coverage, deployment instructions, and a live verified purchase path.

- [ ] **Step 1: Add browser tests for the public gate and UI resilience**

Mock account, generation, auth, Checkout, and confirmation routes in Playwright. Add scenarios that verify:

```ts
test("two free successes then purchase without losing the scene", async ({ page }) => {
  // generation calls 1 and 2 return PNG with remaining 1 and 0;
  // call 3 returns 402.
  await expect(page.getByText("1 free doodle left")).toBeVisible();
  await expect(page.getByText("0 free doodles left")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Keep doodling" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("A cat under an umbrella");
});

test("purchase UI fits mobile, desktop, reduced motion, and Arabic RTL", async ({ page }) => {
  await page.goto("/ar");
  await openPurchaseDialog(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoOverflow(page);
  await expect(page.getByRole("dialog")).toBeInViewport();
});
```

Also test keyboard focus reaches offer, Google, email, cancel, account, and deletion controls; Checkout cancellation restores the scene; successful confirmation shows ten credits; and a mocked paid generation changes ten to nine.

- [ ] **Step 2: Run all automated verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Expected: all commands pass. Inspect Playwright screenshots at 390×844 and 1440×1000; the dialog must not overflow, obscure its close action, or create unintended horizontal scrolling.

- [ ] **Step 3: Configure the external services without coupling AutoLister**

In the dedicated Supabase project:

- Add `https://doodle.samistudio.nl/auth/callback` and `http://localhost:3000/auth/callback` to allowed redirects.
- Configure Google OAuth using a Doodle-specific Google client whose authorized callback is Supabase's provider callback URL.
- Keep email OTP enabled and passwords unused.

In the existing Stripe account, test mode first:

- Create product `Doodle — 10 doodles`.
- Create one recurring-disabled Price: EUR 4.99, tax behavior inclusive.
- Create a Doodle webhook endpoint at `https://doodle.samistudio.nl/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Copy this Price ID and endpoint-specific signing secret into Doodle's Vercel environment. Do not reuse AutoLister's Price ID or webhook secret.
- Ensure Stripe Tax has the Slovakia business origin and the actual active tax registrations; Automatic Tax calculates only from configured registrations.

- [ ] **Step 4: Update operational documentation**

Add README sections listing the six new environment variables, Supabase Google/email setup, migration application, Stripe product/webhook setup, test-mode purchase command, and the fact that refunds/disputes require manual remaining-credit adjustment at launch. State clearly that Adaptive Pricing is disabled and customer-facing currency is always EUR.

- [ ] **Step 5: Deploy and perform the paid smoke test**

Deploy production only after test-mode Checkout, signed webhook delivery, and replay pass. Then:

1. Generate two anonymous doodles and confirm a failed generation does not reduce the remaining count.
2. Use Google sign-in and complete one live €4.99 purchase.
3. Replay the successful webhook and confirm the balance remains ten.
4. Generate one paid doodle and confirm the balance becomes nine.
5. Sign in in another browser and confirm the same balance appears.
6. Verify Arabic RTL and a 390×844 mobile viewport visually.
7. Refund the live test payment in Stripe and manually remove the remaining nine credits from the test user.
8. Confirm Vercel BotID and the existing 3-per-60-second WAF rule still reject automated/burst traffic.

- [ ] **Step 6: Commit the verification/docs changes**

```bash
git add e2e/doodle.spec.ts README.md
git commit -m "test(doodle): verify monetized workflow"
```

Expected: clean worktree and production purchase path verified end to end.
