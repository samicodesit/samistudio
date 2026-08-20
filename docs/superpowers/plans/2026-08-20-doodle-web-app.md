# Doodle Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private, mobile-first Doodle app at `doodle.samistudio.nl`, generating one downloadable sticky-note doodle from a short scene through the OpenAI Image API.

**Architecture:** Add an isolated Next.js App Router application under `doodle/` and deploy that directory as its own Vercel project. Route handlers own authentication and generation; focused domain modules own scenes, prompt profiles, authorization, and the OpenAI adapter. The browser keeps the current prompt and image only in memory.

**Tech Stack:** Next.js App Router, React, TypeScript, plain CSS, OpenAI Node SDK, Vitest, Testing Library, Playwright, Vercel Node.js Functions.

**Spec:** `docs/superpowers/specs/2026-08-20-doodle-web-app-design.md`

## Global Constraints

- Do not change the existing root Sami Studio site or its deployment behavior.
- The Doodle app lives entirely under `doodle/` and uses npm.
- The only visible generation profile is `simple`; do not build dormant medium or detailed UI.
- Scene input is trimmed, non-empty, and at most 180 characters.
- One explicit action produces exactly one `1024x1024` image.
- Default model is `gpt-image-1-mini`; default quality is `low`.
- Never automatically retry a generation request.
- Never persist prompts, generated images, or uploaded content.
- Keep authentication/authorization separate from generation so a later paywall can replace it.
- Keep OpenAI access behind a generation adapter so photo conversion can be added later.
- No accounts, database, Stripe, usage ledger, uploads, analytics, or upload moderation in this MVP.
- Use the project-scoped `doodle-vercel` key only through `OPENAI_API_KEY`.
- Verify at 390x844 mobile and 1440x1000 desktop viewports with no overflow or overlap.

## File Map

- `doodle/src/app/`: layout, page, global styles, and API route handlers.
- `doodle/src/components/`: client workflow and focused UI components.
- `doodle/src/lib/scenes/`: scene validation and the 42 curated suggestions.
- `doodle/src/lib/generation/`: profile selection, prompt construction, and OpenAI adapter.
- `doodle/src/lib/auth/`: passphrase session and authorization boundary.
- `doodle/src/test/`: Vitest setup and shared test helpers.
- `doodle/e2e/`: Playwright user-flow tests.
- `doodle/scripts/`: explicitly invoked real-API smoke and prompt-evaluation scripts.
- `doodle/public/references/`: approved initial reference image.

---

### Task 1: Scaffold The Isolated Application And Test Harness

**Files:**
- Create: `doodle/package.json`
- Create: `doodle/tsconfig.json`
- Create: `doodle/next.config.ts`
- Create: `doodle/eslint.config.mjs`
- Create: `doodle/vitest.config.ts`
- Create: `doodle/src/test/setup.ts`
- Create: `doodle/src/lib/app-config.ts`
- Test: `doodle/src/lib/app-config.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `APP_NAME`, `MAX_SCENE_LENGTH`, `SESSION_TTL_SECONDS`, and npm test/build commands used by every later task.

- [ ] **Step 1: Scaffold the app and install the minimum dependencies**

Run from the repository root:

```bash
npx create-next-app@latest doodle --typescript --eslint --app --src-dir --use-npm --no-tailwind --import-alias '@/*'
cd doodle
npm install openai lucide-react
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Keep the generated lockfile. Remove generated promotional content and Tailwind references if the current template still adds any despite `--no-tailwind`.

- [ ] **Step 2: Add the failing configuration test**

```ts
// doodle/src/lib/app-config.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME, MAX_SCENE_LENGTH, SESSION_TTL_SECONDS } from "./app-config";

describe("app config", () => {
  it("exports the approved product limits", () => {
    expect(APP_NAME).toBe("Doodle");
    expect(MAX_SCENE_LENGTH).toBe(180);
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
```

- [ ] **Step 3: Configure Vitest and verify the test fails**

```ts
// doodle/vitest.config.ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
```

```ts
// doodle/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

Add these scripts to `doodle/package.json`, then run:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

```bash
cd doodle && npm test -- src/lib/app-config.test.ts
```

Expected: FAIL because `app-config.ts` does not exist.

- [ ] **Step 4: Implement the constants and environment example**

```ts
// doodle/src/lib/app-config.ts
export const APP_NAME = "Doodle";
export const MAX_SCENE_LENGTH = 180;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
```

Create `doodle/.env.example` containing names only:

```dotenv
DOODLE_PASSWORD=
SESSION_SECRET=
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1-mini
OPENAI_IMAGE_QUALITY=low
```

Add `doodle/.env.local`, `doodle/test-results/`, `doodle/playwright-report/`, and `doodle/tmp/` to `.gitignore`.

- [ ] **Step 5: Run the foundation checks**

```bash
cd doodle && npm test -- src/lib/app-config.test.ts
cd doodle && npm run typecheck
cd doodle && npm run lint
```

Expected: all commands pass.

- [ ] **Step 6: Commit the scaffold**

```bash
git add .gitignore doodle
git commit -m "chore: scaffold Doodle application"
```

---

### Task 2: Implement Scene Validation, Suggestions, And The Simple Profile

**Files:**
- Create: `doodle/src/lib/scenes/scene.ts`
- Create: `doodle/src/lib/scenes/suggestions.ts`
- Create: `doodle/src/lib/generation/profile.ts`
- Create: `doodle/src/lib/generation/prompt.ts`
- Test: `doodle/src/lib/scenes/scene.test.ts`
- Test: `doodle/src/lib/scenes/suggestions.test.ts`
- Test: `doodle/src/lib/generation/prompt.test.ts`

**Interfaces:**
- Produces: `normalizeScene(input: unknown): string`.
- Produces: `pickSuggestions(random?: () => number): readonly [string, string, string]`.
- Produces: `GenerationProfile` and `SIMPLE_PROFILE`.
- Produces: `buildDoodlePrompt(scene: string, profile?: GenerationProfile): string`.

- [ ] **Step 1: Write failing scene and suggestion tests**

```ts
import { describe, expect, it } from "vitest";
import { SceneValidationError, normalizeScene } from "./scene";

describe("normalizeScene", () => {
  it("trims a valid scene", () => expect(normalizeScene("  Two cats hug  ")).toBe("Two cats hug"));
  it.each([undefined, null, 12, "   "])("rejects invalid input %s", (value) => {
    expect(() => normalizeScene(value)).toThrow(SceneValidationError);
  });
  it("rejects more than 180 characters", () => {
    expect(() => normalizeScene("a".repeat(181))).toThrowError(/180/);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { SCENE_SUGGESTIONS, pickSuggestions } from "./suggestions";

describe("suggestions", () => {
  it("contains exactly 42 approved scenes", () => expect(SCENE_SUGGESTIONS).toHaveLength(42));
  it("selects three distinct suggestions", () => {
    const result = pickSuggestions(() => 0.25);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    expect(result.every((scene) => SCENE_SUGGESTIONS.includes(scene))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

```bash
cd doodle && npm test -- src/lib/scenes
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement validation and the complete suggestion collection**

```ts
// doodle/src/lib/scenes/scene.ts
import { MAX_SCENE_LENGTH } from "@/lib/app-config";

export class SceneValidationError extends Error {
  constructor(readonly code: "empty" | "too_long") {
    super(code === "empty" ? "Enter a scene to draw." : `Keep the scene under ${MAX_SCENE_LENGTH} characters.`);
  }
}

export function normalizeScene(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) throw new SceneValidationError("empty");
  const scene = input.trim();
  if (scene.length > MAX_SCENE_LENGTH) throw new SceneValidationError("too_long");
  return scene;
}
```

```ts
// doodle/src/lib/scenes/suggestions.ts
export const SCENE_SUGGESTIONS = [
  "Two friends baking pancakes",
  "A sleepy astronaut resting on the moon",
  "A grandparent teaching a child to fish",
  "A cat in a raincoat sharing an umbrella with a tiny bird",
  "A dog offering a small flower to a cat",
  "Two siblings building a blanket fort",
  "A person warming both hands around a steaming mug",
  "A child running with a kite",
  "Two cats recreating an upside-down superhero kiss",
  "A tiny chef stirring a giant soup pot",
  "A bear reading a bedtime story to a rabbit",
  "A couple dancing in the kitchen",
  "A penguin carrying a birthday cake",
  "A parent tying a child's shoelace",
  "Two friends taking a silly selfie",
  "A cat watering three small flowers",
  "A dog sleeping under a desk",
  "A person giving someone a warm scarf",
  "Two children jumping in one puddle",
  "A rabbit painting a tiny picture",
  "A superhero making breakfast",
  "A person waving from a train window",
  "Two friends sharing one pair of headphones",
  "A cat reaching for a falling leaf",
  "A child hugging a large teddy bear",
  "A couple watching stars from a rooftop",
  "A dog waiting beside a picnic basket",
  "A person planting a small tree",
  "Two birds building a nest together",
  "A baker presenting one perfect cupcake",
  "A child helping a snail cross a path",
  "Two friends playing a board game",
  "A cat sleeping on an open book",
  "A person carrying groceries in the rain",
  "A tiny ghost drinking hot chocolate",
  "A dog wearing a party hat",
  "A child mailing a heart-shaped letter",
  "Two people high-fiving after finishing a puzzle",
  "A rabbit holding a lantern at night",
  "A person teaching a robot to dance",
  "A cat and dog sharing a sunny windowsill",
  "A child making a snow angel",
] as const;

export function pickSuggestions(random: () => number = Math.random): readonly [string, string, string] {
  const shuffled = [...SCENE_SUGGESTIONS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return [shuffled[0], shuffled[1], shuffled[2]];
}
```

- [ ] **Step 4: Write the failing profile and prompt tests**

```ts
import { describe, expect, it } from "vitest";
import { SIMPLE_PROFILE } from "./profile";
import { buildDoodlePrompt } from "./prompt";

describe("buildDoodlePrompt", () => {
  it("delimits scene content and preserves simple-profile rules", () => {
    const prompt = buildDoodlePrompt("Two cats hug");
    expect(prompt).toContain("<scene>Two cats hug</scene>");
    expect(prompt).toContain("copy by hand in under two minutes");
    expect(prompt).toContain("no text, labels, captions, signatures, borders, or speech bubbles");
    expect(SIMPLE_PROFILE.id).toBe("simple");
    expect(SIMPLE_PROFILE.model).toBe("gpt-image-1-mini");
  });
});
```

- [ ] **Step 5: Implement the single profile and prompt builder**

```ts
// doodle/src/lib/generation/profile.ts
export type ImageQuality = "low" | "medium" | "high";

export interface GenerationProfile {
  id: string;
  model: string;
  quality: ImageQuality;
  size: "1024x1024";
}

const configuredQuality = process.env.OPENAI_IMAGE_QUALITY || "low";
if (!(["low", "medium", "high"] as const).includes(configuredQuality as ImageQuality)) {
  throw new Error("OPENAI_IMAGE_QUALITY must be low, medium, or high");
}

export const SIMPLE_PROFILE: GenerationProfile = {
  id: "simple",
  model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini",
  quality: configuredQuality as ImageQuality,
  size: "1024x1024",
};
```

Create `prompt.ts` from the exact prompt block in the approved spec. Its final line must be `<scene>${scene}</scene>`, and it must accept `profile = SIMPLE_PROFILE` even though the simple profile is the only current implementation.

- [ ] **Step 6: Run domain tests and commit**

```bash
cd doodle && npm test -- src/lib/scenes src/lib/generation/prompt.test.ts
cd doodle && npm run typecheck
git add doodle/src/lib
git commit -m "feat: add Doodle scene and prompt domain"
```

Expected: tests and typecheck pass.

---

### Task 3: Implement Passphrase Sessions And Authorization Boundary

**Files:**
- Create: `doodle/src/lib/auth/session.ts`
- Create: `doodle/src/lib/auth/authorize-generation.ts`
- Create: `doodle/src/app/api/session/route.ts`
- Test: `doodle/src/lib/auth/session.test.ts`
- Test: `doodle/src/app/api/session/route.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE_NAME`, `createSessionToken(secret, now?)`, and `verifySessionToken(token, secret, now?)`.
- Produces: `authorizeGeneration(request: NextRequest): Promise<AuthorizationResult>`.
- Produces: `POST /api/session` and `DELETE /api/session`.

- [ ] **Step 1: Write failing session tests**

```ts
import { describe, expect, it } from "vitest";
import { createSessionToken, verifyPassphrase, verifySessionToken } from "./session";

describe("session", () => {
  it("accepts the configured passphrase", () => expect(verifyPassphrase("secret", "secret")).toBe(true));
  it("rejects a different passphrase", () => expect(verifyPassphrase("wrong", "secret")).toBe(false));
  it("accepts a signed unexpired token", () => {
    const token = createSessionToken("signing-secret", 1_000);
    expect(verifySessionToken(token, "signing-secret", 1_001)).toBe(true);
  });
  it("rejects tampered and expired tokens", () => {
    const token = createSessionToken("signing-secret", 1_000);
    expect(verifySessionToken(`${token}x`, "signing-secret", 1_001)).toBe(false);
    expect(verifySessionToken(token, "signing-secret", 1_000 + 60 * 60 * 24 * 7 + 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
cd doodle && npm test -- src/lib/auth/session.test.ts
```

Expected: FAIL because the session module does not exist.

- [ ] **Step 3: Implement constant-time passphrase checks and signed tokens**

Use `node:crypto` SHA-256 before `timingSafeEqual`, and sign `doodle:<expiry>` with HMAC-SHA256. `now` and `expiry` are Unix seconds; production defaults to `Math.floor(Date.now() / 1000)`. Encode signatures with base64url. Export cookie options with `httpOnly: true`, `sameSite: "strict"`, `secure` in production, `path: "/"`, and seven-day `maxAge`.

```ts
export const SESSION_COOKIE_NAME = "doodle_session";

export interface AuthorizationResult {
  authorized: boolean;
  subject: "private-owner" | null;
}
```

`authorizeGeneration` reads the cookie from `NextRequest`, verifies it with `SESSION_SECRET`, and returns `{ authorized: true, subject: "private-owner" }` or `{ authorized: false, subject: null }`. Generation code must depend on this function rather than reading cookies itself.

- [ ] **Step 4: Write route tests for login and logout**

Test `POST` with the correct password returns 200 plus a secure `Set-Cookie`; the wrong password returns 401 without a cookie; a cross-origin `Origin` header returns 403; and `DELETE` expires the cookie.

```bash
cd doodle && npm test -- src/app/api/session/route.test.ts
```

Expected before implementation: FAIL.

- [ ] **Step 5: Implement the session route**

Use `NextResponse.json`, `response.cookies.set`, and `await request.json()`. Compare `Origin` host with the request `Host` header when Origin is present. Do not log submitted passwords. Return only `{ authenticated: true }` or a stable `{ error: "invalid_passphrase" }` response.

- [ ] **Step 6: Run auth checks and commit**

```bash
cd doodle && npm test -- src/lib/auth src/app/api/session
cd doodle && npm run typecheck
git add doodle/src/lib/auth doodle/src/app/api/session
git commit -m "feat: add private Doodle sessions"
```

---

### Task 4: Implement The OpenAI Adapter And Protected Generation Route

**Files:**
- Create: `doodle/src/lib/generation/generate-doodle.ts`
- Create: `doodle/src/app/api/generate/route.ts`
- Test: `doodle/src/lib/generation/generate-doodle.test.ts`
- Test: `doodle/src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `normalizeScene`, `buildDoodlePrompt`, `SIMPLE_PROFILE`, and `authorizeGeneration`.
- Produces: `generateDoodle(scene: string, client?: ImageClient): Promise<GeneratedDoodle>`.
- Produces: binary `POST /api/generate` response with `image/png` content type.

- [ ] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { generateDoodle } from "./generate-doodle";

describe("generateDoodle", () => {
  it("requests one low-quality square and decodes it", async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: Buffer.from("png").toString("base64") }] });
    const result = await generateDoodle("Two cats hug", { generate });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ n: 1, size: "1024x1024", quality: "low" }));
    expect(Buffer.from(result.bytes).toString()).toBe("png");
    expect(result.mimeType).toBe("image/png");
  });

  it("rejects a missing image payload", async () => {
    await expect(generateDoodle("Two cats hug", { generate: vi.fn().mockResolvedValue({ data: [{}] }) }))
      .rejects.toMatchObject({ kind: "malformed" });
  });
});
```

- [ ] **Step 2: Implement the adapter with a narrow interface**

```ts
export interface ImageClient {
  generate(input: {
    model: string;
    prompt: string;
    n: 1;
    size: "1024x1024";
    quality: "low" | "medium" | "high";
  }): Promise<{ data: Array<{ b64_json?: string | null }> }>;
}

export interface GeneratedDoodle {
  bytes: Uint8Array;
  mimeType: "image/png";
}
```

The production adapter wraps `new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 }).images.generate`. Normalize moderation or policy rejection to `kind: "refused"`, connection timeout to `kind: "timeout"`, absent image data to `kind: "malformed"`, and remaining API failures to `kind: "upstream"`. Never log the prompt or returned bytes.

- [ ] **Step 3: Write failing generation route tests**

Cover unauthorized 401, empty/long scene 400 without calling OpenAI, successful PNG response with `Cache-Control: no-store`, refusal 422, timeout 504, and upstream/malformed 502. Mock `authorizeGeneration` and `generateDoodle` at module boundaries.

- [ ] **Step 4: Implement the generation route**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
```

The route parses `{ scene }`, validates it, calls the authorization boundary, invokes `generateDoodle`, and returns `new Response(Buffer.from(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } })`. It performs no retry.

- [ ] **Step 5: Run service and route tests, then commit**

```bash
cd doodle && npm test -- src/lib/generation src/app/api/generate
cd doodle && npm run typecheck
git add doodle/src/lib/generation doodle/src/app/api/generate
git commit -m "feat: generate protected Doodle images"
```

---

### Task 5: Build The Unlock And Generation Workflow

**Files:**
- Create: `doodle/src/components/doodle-client.tsx`
- Create: `doodle/src/components/unlock-form.tsx`
- Create: `doodle/src/components/scene-composer.tsx`
- Create: `doodle/src/components/doodle-stage.tsx`
- Create: `doodle/src/components/result-actions.tsx`
- Modify: `doodle/src/app/page.tsx`
- Test: `doodle/src/components/doodle-client.test.tsx`
- Test: `doodle/src/components/unlock-form.test.tsx`

**Interfaces:**
- Consumes: `pickSuggestions`, session cookie verification, and `/api/generate`.
- Produces: `DoodleClient({ initialAuthenticated, suggestions })` preserving scene state across re-authentication.

- [ ] **Step 1: Write failing unlock component tests**

Test empty submit prevention, incorrect-passphrase copy, and `onUnlocked` after a 200 response. Mock `fetch` with exact `/api/session` calls.

- [ ] **Step 2: Implement `UnlockForm`**

Use one password input, one submit button, an inline error, and an `aria-live="polite"` status. Never retain the passphrase after success. Use `autocomplete="current-password"`.

- [ ] **Step 3: Write failing workflow tests**

Test these transitions with mocked fetch and mocked `URL.createObjectURL`/`URL.revokeObjectURL`:

```text
idle -> generating -> ready
ready -> generating via Try again
ready -> idle with blank scene via New scene
generating -> error while preserving scene
generating -> locked on 401 while preserving scene -> idle after unlock
```

Also assert a suggestion fills the textarea without calling fetch.

- [ ] **Step 4: Implement the client state machine**

Use the explicit state type:

```ts
type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; error: null }
  | { status: "error"; imageUrl: null; error: string };
```

`DoodleClient` owns `scene`, `authenticated`, and `GenerationState`. Revoke the previous object URL before replacement and on unmount. A 401 changes only `authenticated`; it must not clear `scene`. Do not automatically resume the failed request after unlocking.

- [ ] **Step 5: Implement focused child components**

- `SceneComposer`: controlled textarea, 180-character `maxLength`, counter only from 150 onward, disabled create while empty/generating.
- `DoodleStage`: approved reference in idle, fixed square loading state in generating, generated image in ready, error copy in error.
- `ResultActions`: Download, Try again, and New scene using Lucide icons and visible labels where needed.
- `page.tsx`: read `cookies()` asynchronously, verify the session, choose three suggestions server-side, and pass both values to `DoodleClient`.

- [ ] **Step 6: Run component tests and commit**

```bash
cd doodle && npm test -- src/components
cd doodle && npm run typecheck
git add doodle/src/components doodle/src/app/page.tsx
git commit -m "feat: add Doodle creation workflow"
```

---

### Task 6: Apply The Approved Visual System And Assets

**Files:**
- Modify: `doodle/src/app/layout.tsx`
- Modify: `doodle/src/app/globals.css`
- Modify: files under `doodle/src/components/` for approved class names
- Create: `doodle/public/references/doodle-reference-kiss.png`
- Test: `doodle/src/components/doodle-client.test.tsx`

**Interfaces:**
- Consumes: component behavior from Task 5.
- Produces: the approved single-column composition and stable responsive dimensions.

- [ ] **Step 1: Copy the approved reference asset**

```bash
mkdir -p doodle/public/references
cp docs/superpowers/specs/assets/doodle-reference-kiss.png doodle/public/references/doodle-reference-kiss.png
```

- [ ] **Step 2: Add visual assertions before styling**

Extend component tests to assert the reference alt text, a single H1, absence of removed copy (`One tiny moment`, `Private space`, and the privacy footer), visible focusable suggestions, and icon button accessible names.

- [ ] **Step 3: Implement the global design tokens and layout**

Use these exact foundations in `globals.css`:

```css
:root {
  --page: #f3f5f1;
  --surface: #ffffff;
  --ink: #1f241f;
  --muted: #626b62;
  --line: #d8ddd7;
  --green: #207058;
  --green-pressed: #144c3b;
  --focus: rgba(32, 112, 88, 0.14);
}

* { box-sizing: border-box; }
html { background: var(--page); }
body { margin: 0; min-width: 320px; overflow-x: hidden; background: var(--page); color: var(--ink); }
button, textarea, input { font: inherit; }
button { min-height: 44px; }
.doodle-main { width: min(610px, calc(100vw - 40px)); margin: 0 auto; padding: 46px 0 54px; }
.doodle-stage { width: 190px; aspect-ratio: 1; margin: 0 auto 30px; }
.doodle-composer { min-height: 166px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
@media (max-width: 640px) {
  .doodle-main { width: calc(100vw - 36px); padding: 34px 0 38px; }
  .doodle-stage { width: 152px; margin-bottom: 25px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Complete the component styles from the approved mockup: white 68/62-pixel header, `Doodle.` wordmark, centered heading, framed reference/result, green primary action with subtle pressed depth, one bordered suggestion list, zero letter spacing, 6-8 pixel radii, and visible keyboard focus. Add no decorative strokes, gradients, blobs, extra copy, or dark mode.

- [ ] **Step 4: Add metadata and no-index behavior**

Set title `Doodle`, description `Turn a tiny scene into an easy-to-copy sticky-note doodle.`, and `robots: { index: false, follow: false }`. Use a local/system font stack or `next/font`; do not add runtime font requests.

- [ ] **Step 5: Verify tests and build, then commit**

```bash
cd doodle && npm test -- src/components
cd doodle && npm run lint
cd doodle && npm run typecheck
cd doodle && npm run build
git add doodle
git commit -m "feat: apply Doodle visual design"
```

---

### Task 7: Add Browser-Level Workflow And Responsive Coverage

**Files:**
- Create: `doodle/playwright.config.ts`
- Create: `doodle/e2e/doodle.spec.ts`
- Modify: `doodle/package.json`

**Interfaces:**
- Consumes: complete local application.
- Produces: reproducible browser verification at approved viewports.

- [ ] **Step 1: Configure Playwright**

Use Chromium, `baseURL: "http://127.0.0.1:3100"`, trace on first retry, and a web server command `npm run dev -- --port 3100`. Supply test-only environment values through the web server config:

```ts
env: {
  DOODLE_PASSWORD: "test-passphrase",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  OPENAI_API_KEY: "test-key-not-used-because-generation-is-mocked",
}
```

- [ ] **Step 2: Write the mobile happy-path test**

At 390x844: unlock, choose a suggestion, intercept `/api/generate` with the approved reference PNG, click Create, assert stable loading text, assert the result, trigger a download, try again once, and start a new scene. Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` after each state.

- [ ] **Step 3: Add failure and session-expiry tests**

Cover incorrect passphrase, 422 refusal, 504 timeout, 502 temporary error, and 401 during generation. Confirm the scene value remains after each error and after re-authentication.

- [ ] **Step 4: Add desktop, keyboard, and reduced-motion checks**

At 1440x1000, verify the content remains one column and centered. Tab through every control and assert visible focus. Emulate reduced motion and assert the workflow still completes. Capture screenshots to Playwright's test output for create, loading, result, and error states; do not commit screenshots as baselines in the MVP.

- [ ] **Step 5: Run browser verification and commit**

```bash
cd doodle && npx playwright install chromium
cd doodle && npm run test:e2e
git add doodle/playwright.config.ts doodle/e2e doodle/package.json doodle/package-lock.json
git commit -m "test: cover Doodle browser workflow"
```

Expected: all browser tests pass at both viewports with no overflow.

---

### Task 8: Add Explicit Real-API Smoke And Prompt Evaluation Commands

**Files:**
- Create: `doodle/src/lib/generation/generate-doodle.real.test.ts`
- Create: `doodle/scripts/evaluate-prompt.mts`
- Modify: `doodle/package.json`
- Modify: `doodle/README.md`

**Interfaces:**
- Consumes: project-scoped `OPENAI_API_KEY` and `generateDoodle`.
- Produces: opt-in model access check and eight-scene manual evaluation output.

- [ ] **Step 1: Add an opt-in real API test**

Gate the suite with `RUN_REAL_IMAGE_TEST === "1"`. Generate `A cat holding one small umbrella`, assert `image/png`, non-empty bytes, and the PNG signature bytes `89 50 4e 47`. The normal `npm test` run must skip it.

- [ ] **Step 2: Add the eight-scene evaluation script**

Use the exact eight scenes from the spec. Create `doodle/tmp/prompt-eval/<ISO timestamp>/`, generate sequentially to avoid rate-limit bursts, and write numbered PNGs plus `manifest.json` containing scene, model, quality, and filename. Do not include the API key or full server-owned prompt in the manifest.

- [ ] **Step 3: Add safe scripts and documentation**

```json
{
  "test:real": "RUN_REAL_IMAGE_TEST=1 vitest run src/lib/generation/generate-doodle.real.test.ts",
  "eval:prompt": "node --import tsx scripts/evaluate-prompt.mts"
}
```

Add `tsx` as a dev dependency. Document that both commands incur API cost and are never run by CI or the default test command.

- [ ] **Step 4: Run one real smoke test only after the key is configured**

```bash
cd doodle && npm run test:real
```

Expected: one passing test, one Doodle project image charge, and no image written to the repository.

- [ ] **Step 5: Commit the opt-in tooling**

```bash
git add doodle/src/lib/generation/generate-doodle.real.test.ts doodle/scripts doodle/package.json doodle/package-lock.json doodle/README.md
git commit -m "test: add Doodle prompt evaluation tools"
```

---

### Task 9: Harden, Deploy, And Verify Production

**Files:**
- Modify: `doodle/next.config.ts`
- Modify: `doodle/README.md`
- Create: `doodle/vercel.json` only if the Vercel project cannot infer the Next.js root configuration

**Interfaces:**
- Consumes: complete application and Vercel Pro account.
- Produces: private production app at `doodle.samistudio.nl` using the dedicated OpenAI project key.

- [ ] **Step 1: Add production headers**

Configure `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Do not add a Content Security Policy in this MVP; introduce one later as a separately tested hardening change rather than shipping an unverified policy.

- [ ] **Step 2: Run the full local release gate**

```bash
cd doodle && npm test
cd doodle && npm run test:e2e
cd doodle && npm run lint
cd doodle && npm run typecheck
cd doodle && npm run build
```

Expected: every command passes from a clean checkout with test environment values.

- [ ] **Step 3: Create and link the Vercel project**

Create a Vercel project named `doodle` with repository root directory `doodle/`, Next.js framework preset, Fluid Compute enabled, and the existing Pro team selected. Link the local directory with `npx vercel link` if the CLI is authenticated.

- [ ] **Step 4: Configure secrets without exposing them**

Add `OPENAI_API_KEY`, `DOODLE_PASSWORD`, and a newly generated 32-byte-or-longer `SESSION_SECRET` to Preview and Production through Vercel's encrypted environment settings. Add `OPENAI_IMAGE_MODEL=gpt-image-1-mini` and `OPENAI_IMAGE_QUALITY=low`. Do not paste any secret into source, chat, shell history, or the plan.

- [ ] **Step 5: Deploy and attach the subdomain**

Deploy production, add `doodle.samistudio.nl` in Vercel Project Settings > Domains, and apply the exact DNS record Vercel displays. Do not alter the apex `samistudio.nl` record or the existing site's project settings.

- [ ] **Step 6: Perform production smoke checks**

Verify incorrect and correct passphrases, one real generation, download, Try again confirmation, New scene, mobile layout, and a direct unauthenticated call to `/api/generate` returning 401. Confirm the generation appears under the OpenAI `doodle` project's usage rather than `quick-vint`.

- [ ] **Step 7: Document production settings and commit**

Record non-secret Vercel project name, root directory, domain, model, quality, and verification date in `doodle/README.md`.

```bash
git add doodle/next.config.ts doodle/README.md doodle/vercel.json
git commit -m "docs: document Doodle production deployment"
```

If `vercel.json` was not needed, omit it from `git add`.

## Final Verification

Run after all tasks:

```bash
git status --short
cd doodle && npm test
cd doodle && npm run test:e2e
cd doodle && npm run lint
cd doodle && npm run typecheck
cd doodle && npm run build
```

Expected: clean worktree, all checks pass, production generation succeeds once, and OpenAI attributes that request to the `doodle` project.
