# Task 7 report: polished localized purchase/auth/account UI

Date: 2026-08-21  
Worktree: `/home/mests/projects/samistudio/.worktrees/doodle-monetization`  
Application: `doodle/`

## Outcome

Task 7 adds a compact, localized refill purchase flow, passwordless Google/email authentication, account controls, usage balances, return recovery, and localized structured offers without adding a state library, UI dependency, or non-native modal primitive.

The implementation keeps the existing canvas/paper/graphite/moss/sticky/coral palette and Bricolage Grotesque, IBM Plex Sans, and Alexandria typography. The purchase surface is a stationery refill slip with a single torn paper edge, a strong quantity/price lockup, one 180ms entrance, a bottom-sheet mobile layout, and a compact centered desktop layout.

## Delivered behavior

- Added serializable plural-category templates to `DoodleCopy` and a small `Intl.PluralRules` formatter. No functions cross the RSC boundary.
- Completed usage, purchase, auth, and account copy for all ten locales.
- Included Arabic `zero`, `one`, `two`, `few`, `many`, and `other` forms, natural Modern Standard Arabic copy, full RTL layout, and Alexandria for Arabic utility labels as well as display/body roles.
- Added `PurchaseDialog` using native `<dialog>`, including Escape, backdrop, initial focus, focus changes across auth steps, and focus restoration to the live Create button.
- Implemented the single `10 more doodles / €4.99` offer, Google OAuth, email OTP send/verify, checkout creation, local error states, and server-confirmed success.
- Preserved the exact scene in `sessionStorage` through 402, OAuth, Checkout cancellation, and paid success. The scene is never added to auth/checkout URLs or payloads.
- Added account loading, localized free/paid usage, generation-header balance updates, and stale account-fetch protection.
- Added a quiet account `<details>` menu with email, balance, sign-out, and an explicit native deletion confirmation dialog.
- Added localized free and paid `WebApplication` structured-data offers sourced directly from copy.

## TDD record

### Baseline

Before Task 7 changes, the full suite passed with 24 files, 132 passing tests, and one intentionally skipped real-provider test.

### Initial RED

The component/client/i18n tests were written before production implementation and run with:

```bash
npm test -- src/lib/i18n.test.ts src/components/purchase-dialog.test.tsx src/components/account-menu.test.tsx src/components/doodle-client.test.tsx src/components/doodle-page.test.tsx
```

Result: **RED** — 5 files failed; 9 tests failed and 12 passed. Failures covered the absent locale contract/plural formatter, purchase/auth interactions, account controls, 402 return handling, usage updates, Checkout confirmation, and structured offers.

### Primary GREEN

After the minimum implementation, the same focused command passed:

```text
5 test files passed
31 tests passed
```

### Self-review regression cycles

Several issues found during review were each reproduced before their production fix:

1. Purchase-dialog Escape focus restoration: the focused client test failed because focus landed on `<body>` after the 402 dialog closed. A live Create-button focus target made the 14-test client file pass.
2. Signed-in zero balance: the new focused test failed because authenticated zero-credit users saw anonymous trial copy. Usage now chooses paid plural copy for every authenticated balance, including zero; the 15-test client file passed.
3. Auth-step focus: the passwordless test failed when the removed offer action left focus on `<body>`. A step-aware focus effect now moves focus to Google, then email, then the six-digit code field; all 6 purchase-dialog tests passed.
4. A stale mount account response could overwrite a newer generation-header balance. A monotonic remaining-balance revision preserves the newer count while still applying account identity.

### Lint/type feedback

- `npm run typecheck`: passed.
- `npm run lint`: initially exposed effect-state issues; return restoration was moved behind the account request and closed dialogs are now unmounted.
- A later exhaustive-deps warning on live-ref cleanup was removed with a stable focus-restoration callback.
- Final lint run: passed with no warnings or errors.

### Final verification

```bash
npm test
```

Result: **PASS** — 26 test files passed, 1 real-provider file skipped; 149 tests passed, 1 skipped.

```bash
npm run build
```

Result: **PASS** — Next.js 16.3.1 compiled, typechecked, generated all 15 static pages, and finalized successfully.

The final whitespace/error gate is run after this report is saved and before commit.

## Implementation notes

### Serializable localization

`PluralTemplates` stores strings only. `formatCount(locale, templates, count)` selects a category with `Intl.PluralRules` and substitutes `#`. Tests JSON-round-trip every locale dictionary, exercise counts 1 and 2 for all pluralized fields, exercise every Arabic plural category, and reject Latin placeholder copy in Arabic apart from the Doodle product name.

### Purchase and auth state

The dialog keeps `offer`, `signIn`, `emailCode`, and `checkout` state locally. Paid success is supplied only after `DoodleClient` posts the returned `cs_…` session to `/api/checkout/confirm` and validates a non-negative integer balance. No optimistic balance update or success message occurs before that server response.

OAuth and checkout save `{ scene, intent }` under `doodle:return`. Email authentication stays in the dialog, refreshes `/api/account`, and returns to the offer. Google uses the required localized callback URL; Checkout posts only `{ locale }`.

### Account and allowance state

The client fetches `/api/account` on mount. Anonymous users see first-two-free copy until server usage indicates otherwise; authenticated users see paid balance copy, including the localized zero form. Successful generation and 402 responses consume the authoritative remaining-balance headers.

Account deletion requires an explicit `{ confirm: true }` same-origin DELETE. Only a successful deletion triggers Supabase sign-out and a fresh account GET.

## Visual self-review

The final browser review used local Chromium with mocked account/generation endpoints at desktop, mobile, narrow mobile, Arabic mobile, and reduced-motion settings.

Measured results:

- Desktop 1280×900: dialog width 440px, centered at x=420, no horizontal overflow.
- Mobile 390×844: dialog width 390px, bottom gap 0, no horizontal overflow.
- Arabic 390×844: RTL direction, Alexandria computed for dialog and utility label, bottom gap 0, no horizontal overflow.
- Narrow account menus at 320px in both English and Arabic: no horizontal overflow.
- Entrance: `paper-settle`, 0.18s; reduced motion: animation name `none`.
- Initial purchase focus: primary purchase action.
- Auth transitions: Google action, then email input.
- Purchase Escape: dialog closed and focus returned to Create.
- Delete dialog: cancel action received initial focus and Escape closed the native dialog.

### Design critique and corrections

The result stays specific to Doodle rather than reading as a generic SaaS pricing card: the refill label, decisive quantity/price rule, restrained physical edge, existing paper geometry, and absence of pricing tiers or payment-brand decoration do the identity work.

Review found and corrected four polish defects:

- A broad `.composer-footer button` selector leaked primary green depth into account actions; direct-child selectors now isolate the Create action.
- Purchase focus restoration initially targeted a detached pre-402 button; it now resolves the live Create control.
- Auth subview replacement initially dropped keyboard focus; each new step now receives deliberate focus.
- Arabic utility text could fall through the monospace stack; RTL utility labels now resolve to Alexandria.

The sheet is intentionally restrained. Its only decorative gesture is the lower paper edge; there are no gradients, SVG ornaments, card-brand graphics, crossed prices, badges, pricing tables, dashboards, or permanent header counters.

### Accessibility repair

The native account-deletion dialog now retains its Delete account trigger before opening and restores focus to that live trigger when Escape, backdrop cancellation, or component cleanup closes the dialog. The cleanup also cancels the pending initial-focus frame before closing the native dialog.

Focused verification after the repair:

```bash
npm test -- src/components/account-menu.test.tsx
```

Result: **PASS** — 1 file, 5 tests.

```bash
CI=1 npx playwright test e2e/doodle.spec.ts -g 'Task 7 purchase and account QA'
```

Result: **PASS** — 2 Chromium tests. At both 390×844 and 320×700, all three auth actions had an intentional gap of at least 8px and the purchase sheet stayed inside the viewport. The native account-delete Escape path restored focus to Delete account.

### Fix round 2: async auth and Checkout recovery

Four independent-review findings were reproduced with focused component tests and fixed at their shared state boundaries:

- Every account snapshot mutation now advances one revision, so a delayed pre-auth account request cannot overwrite a newer authenticated identity, email, or balance.
- Returned Checkout sessions are marked handled only after successful confirmation. A transient failure preserves both the query session and `doodle:return`; the localized Try again action retries confirmation without creating another Checkout, while an in-flight guard prevents duplicate confirmation requests.
- OTP verification and account refresh now have distinct failure paths. Once Supabase accepts a code, a failed account refresh shows the sign-in recovery error and retries only the refresh.
- Arabic-Indic and Persian OTP digits are normalized to ASCII before local validation and Supabase verification.

Verification:

```bash
npm test -- src/components/doodle-client.test.tsx src/components/purchase-dialog.test.tsx
npm run typecheck
npm run lint
```

Result: **PASS** — 2 files, 26 tests; TypeScript and ESLint completed with no errors.

### Fix round 3: independent identity and usage freshness

The single account revision from round 2 was too coarse: a generation response could make the initial account response stale for balance purposes without making its authenticated identity and email stale. DoodleClient now tracks identity replacement and usage freshness independently.

- Generation headers advance only usage freshness.
- OTP, sign-out, and deletion account replacements advance both identity and usage freshness.
- Checkout confirmation advances both because it authoritatively changes authentication state and paid balance.
- A delayed initial account response merges each half only when that half is still current.

Focused verification:

```bash
npm test -- src/components/doodle-client.test.tsx
npm run typecheck
npm run lint
```

Result: **PASS** — 1 file, 18 tests; TypeScript and ESLint completed with no errors. The new regression preserves a paid remaining balance of 7 from the generation header while adopting the delayed authenticated email; the existing OTP regression confirms an explicit newer account replacement still rejects stale initial identity.

## Files changed

- `doodle/src/lib/i18n.ts`
- `doodle/src/lib/i18n.test.ts`
- `doodle/src/components/purchase-dialog.tsx`
- `doodle/src/components/purchase-dialog.test.tsx`
- `doodle/src/components/account-menu.tsx`
- `doodle/src/components/account-menu.test.tsx`
- `doodle/src/components/scene-composer.tsx`
- `doodle/src/components/doodle-client.tsx`
- `doodle/src/components/doodle-client.test.tsx`
- `doodle/src/components/doodle-page.tsx`
- `doodle/src/components/doodle-page.test.tsx`
- `doodle/src/app/globals.css`
