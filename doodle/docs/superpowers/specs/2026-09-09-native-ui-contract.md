# Doodle native UI contract

**Date:** 2026-09-09
**Scope:** Expo and React Native presentation for Android, with an iOS-safe layout. This contract records the current Doodle web experience as the visual and interaction baseline. It does not define networking, auth providers, image generation, or billing implementation. The native UI ownership boundary is `mobile/src/ui/**` and `mobile/assets/**`; package, app-shell, SDK, and service changes belong to the foundation and service owners.

## Source of truth

The inventory was taken from the current source, QA documents, and the checked-in phone and Android captures.

| Surface | Source evidence |
| --- | --- |
| Type, color, breakpoints, loading geometry | [`src/app/root-document.tsx`](../../../src/app/root-document.tsx), [`src/app/globals.css`](../../../src/app/globals.css) |
| Create, generation, result and errors | [`src/components/doodle-client.tsx`](../../../src/components/doodle-client.tsx), [`src/components/scene-composer.tsx`](../../../src/components/scene-composer.tsx), [`src/components/doodle-stage.tsx`](../../../src/components/doodle-stage.tsx) |
| Installed shell, Ideas, Settings and account slot | [`src/components/mobile-app-workspace.tsx`](../../../src/components/mobile-app-workspace.tsx), [`src/components/mobile-app-workspace.css`](../../../src/components/mobile-app-workspace.css) |
| Result actions and larger viewer | [`src/components/result-actions.tsx`](../../../src/components/result-actions.tsx), [`src/components/result-dialog.tsx`](../../../src/components/result-dialog.tsx) |
| Account, sign-in and refill | [`src/components/account-menu.tsx`](../../../src/components/account-menu.tsx), [`src/components/google-sign-in-button.tsx`](../../../src/components/google-sign-in-button.tsx), [`src/components/purchase-dialog.tsx`](../../../src/components/purchase-dialog.tsx) |
| Localized copy and locale direction | [`src/lib/i18n.ts`](../../../src/lib/i18n.ts) |
| Ideas and image order | [`src/lib/doodle-ideas.ts`](../../../src/lib/doodle-ideas.ts), [`public/ideas`](../../../public/ideas) |
| Mobile behavior and loading decisions | [`docs/mobile-app-experience.md`](../../mobile-app-experience.md), [`docs/loading-flow-qa.md`](../../loading-flow-qa.md), [`docs/account-ui-qa.md`](../../account-ui-qa.md) |
| Rendered references | [`store-assets/README.md`](../../../store-assets/README.md), [`store-assets/android-captures`](../../../store-assets/android-captures), [`store-assets/phone-drafts`](../../../store-assets/phone-drafts) |

The rendered references show a pale green canvas, a white paper composer, large graphite headings, moss actions, a generous yellow waiting card, an image-first result, two-column idea cards, a full-screen larger image, and a three-item bottom navigation. The Android captures are a verified TWA reference, not native Expo output. They establish geometry and hierarchy only.

## Screen and state contract

### App shell

Use a portrait-first native screen with safe-area insets and a three-item bottom tab bar: **Create**, **Ideas**, and **Settings**. Keep the account action in a stable top-right slot on every tab. Preserve tab state when switching tabs so an in-progress draft, result, or error can be revisited. The native shell has no web header, language dropdown, SEO block, footer, browser toolbar, or install prompt.

The canonical test widths are 320, 360, and 390 dp in portrait. Check 640, 720, and 800 dp landscape widths as well. Prompt content needs visible breathing space around the heading, hint, composer, and account slot. The keyboard must not cover the prompt or the primary action.

### Create, idle and error

The idle screen is deliberately small and clear:

- Heading: `What should we doodle?`
- Hint: `Keep it small and clear.`
- Placeholder: `A small moment...`
- Primary action: `Create doodle`
- Maximum prompt length: 180 characters. The counter starts at 150 characters.
- Suggestions are localized, selectable examples. Current English examples include a warm scarf, a couple dancing in a kitchen, and a dog in a party hat.

The composer owns the scene value and exposes a visible, labelled multiline text field. Trimmed empty input is disabled or rejected with a clear error. Errors remain in the same stage area and preserve the scene so the user can correct or retry.

### Waiting

The waiting state is a large yellow card using `#f6df75`, with a translucent paper note and a stable text area inside the card. The primary line is `Drawing your doodle...`; the screen-reader status says `This can take up to two minutes.` Rotate through the existing localized loading messages, including clearing a fresh note, sketching the main shapes, keeping the lines simple, and adding the last little details. Reserve the same message height on every frame so the card does not jump.

Keep the rotating messages inside the card. Do not add a repeated heading, prompt quote, eyebrow, or explanatory paragraph below it. Respect reduced-motion settings by keeping one message and removing decorative animation while retaining the card and its status.

### Result

Show the generated square image first, with generous space around it. Keep the result hierarchy quiet and uncrowded:

- First row: `Download`, `Share doodle`.
- Second row: `Draw something else`, plus a compact `More options` control.
- More options contains `Redraw this idea` and `Report this doodle`.
- Keep `Draw something else` and `Redraw this idea` distinct. The former clears the scene and starts a fresh prompt. The latter repeats the current idea and is a secondary utility action.
- Do not repeat the ready eyebrow or the full scene text beside the image.
- Keep the usage label below the actions. Do not show an incorrect anonymous free-use label while account data is loading.

`Download` and `Share doodle` are presentation callbacks. Sharing may use the platform share sheet, while the data adapter supplies the file or URI. The UI must not construct a browser tab or a web tracking URL.

### Larger image

Open the result in a full-screen, safe-area-aware viewer. Focus the close control on open, provide an accessible image description and a full-width `Download` action, and close on the platform back action. Restore focus to the invoking control on close. There is no `Open in new tab` action in the native viewer.

### Ideas

Ideas uses a scrollable two-column grid at phone widths. Keep the existing eight images and order:

1. `thank-you-mug.webp`
2. `cat-note.webp`
3. `birthday-dog.webp`
4. `warm-hug.webp`
5. `super-banana.webp`
6. `lunch-high-five.webp`
7. `pencil-helps-eraser.webp`
8. `school-snail.webp`

Each card is one labelled button with the localized prompt and a clear action. Selecting one fills the composer and returns to Create. There is no separate image viewer modal for an idea card.

### Settings and language

Settings exposes language selection, support, privacy, terms, and refund links. The supported locales and labels are:

| Locale | Label | Direction |
| --- | --- | --- |
| `en` | English | LTR |
| `nl` | Nederlands | LTR |
| `de` | Deutsch | LTR |
| `fr` | Français | LTR |
| `es` | Español | LTR |
| `pt-br` | Português (Brasil) | LTR |
| `it` | Italiano | LTR |
| `ja` | 日本語 | LTR |
| `ko` | 한국어 | LTR |
| `ar` | العربية | RTL |

Only Arabic is RTL in the current contract. Apply RTL to layout order, alignment, icon placement where directional, and text shaping. Do not simulate Arabic by rotating or scaling Latin text.

### Account, auth and refill

The account action must remain discoverable in the top-right slot, including on Ideas and Settings. A signed-out user sees a clearly labelled `Sign in` action. A signed-in user sees the email, balance, refill action, sign out, and delete account. Refill must be offered before a zero-balance retry fails. A 402 generation response keeps the current scene and opens the refill offer.

Keep offer, sign-in, checkout, success, and error as separate presentation states. Show the platform price and availability supplied by billing. Preserve the current terms: `One payment. No subscription.` and `Failed generations don't count.` Do not hardcode the web reference price in native UI. If the user starts checkout while signed out, show the neutral sign-in state first, then require a fresh purchase action after auth.

Delete account requires an explicit confirmation. Preserve the warning that unused doodles are also removed and that deletion cannot be undone. Modal close and platform back restore focus to the account control. Google sign-in is a provider callback and state from the adapter; the UI owns localized labels, loading, timeout, and error presentation.

## Visual system

Use the current CSS token values as native constants:

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#eef1ea` | Screen background |
| Paper | `#fcfcf8` | Composer, sheets, cards |
| Graphite | `#20231f` | Headings and primary text |
| Moss | `#195c47` | Primary actions, links, selected states |
| Sticky | `#f4d85e` | Brand note accent |
| Loading yellow | `#f6df75` | Waiting card |
| Coral | `#b65248` | Destructive or report emphasis |
| Muted | `#687068` | Secondary text |
| Line | `rgba(32, 35, 31, 0.14)` | Borders and dividers |
| Soft line | `rgba(32, 35, 31, 0.08)` | Quiet separators |
| Focus | `rgba(25, 92, 71, 0.22)` | Focus ring |

Headings use **Bricolage Grotesque**. Body text and controls use **IBM Plex Sans**. Arabic uses **Alexandria**. The web source declares these through `next/font/google`; the native implementation must load and verify actual native TTF files from the official Google Fonts sources, include their license files, and cover every glyph needed by the supported locales. `marketing-assets/demo/fonts/bricolage-grotesque-latin.woff2` and `marketing-assets/demo/fonts/ibm-plex-sans-latin.woff2` are checked-in local web references only. No authoritative Alexandria asset was found in `public`, `src`, `android`, `store-assets`, or `marketing-assets`; add the reviewed Alexandria TTF and license under `mobile/assets` before shipping Arabic. Do not replace any of these brand families with system fonts, and do not use `.next/static/media` build output as the source asset. Where Bricolage, IBM Plex Sans, or Alexandria do not contain a supported script, add a licensed script fallback without changing the brand family used for its supported glyphs.

Use `/public/ideas/*.webp` as the eight idea assets and `/public/references/doodle-reference-kiss.png` for the idle reference. Preserve their existing crop and square aspect ratio. Native icons should be platform vectors or a native SVG library. Avoid copying web-only inline SVG filters, CSS `backdrop-filter`, `clip-path` paper edges, or transforms that affect readable labels. Only the decorative waiting note may animate.

## Presentational boundary

The native screen component receives resolved copy, display data, and callbacks. It has no fetch, billing SDK, auth SDK, or image-generation knowledge. An adapter outside this component maps the backend and platform services into this model.

```ts
import type { DoodleCopy, Locale } from "@/lib/i18n";

export type NativeTab = "create" | "ideas" | "settings";
export type NativeDirection = "ltr" | "rtl";

export type GenerationUiState =
  | { status: "idle" }
  | {
      status: "waiting";
      loadingMessages: readonly string[];
      loadingMessageIndex: number;
      statusLabel: string;
    }
  | { status: "ready"; imageUri: string; imageAlt: string }
  | { status: "error"; message: string; retryLabel: string };

export interface NativeReportCopy {
  title: string;
  intro: string;
  reasonLabel: string;
  chooseReason: string;
  detailsOptional: string;
  detailsRequired: string;
  detailsPlaceholder: string;
  includeContent: string;
  submit: string;
  cancel: string;
  close: string;
  success: string;
  reference: string;
  error: string;
  reasons: {
    sexual: string;
    violence: string;
    hate: string;
    "self-harm": string;
    other: string;
  };
}

export interface NativeDoodleUiCopy {
  localeLabel: DoodleCopy["localeLabel"];
  header: Pick<DoodleCopy["header"], "languageLabel">;
  footer: DoodleCopy["footer"];
  composer: DoodleCopy["composer"];
  errors: DoodleCopy["errors"];
  suggestions: DoodleCopy["suggestions"];
  stage: DoodleCopy["stage"];
  actions: DoodleCopy["actions"];
  dialog: DoodleCopy["dialog"];
  usage: DoodleCopy["usage"];
  purchase: DoodleCopy["purchase"];
  auth: DoodleCopy["auth"];
  account: DoodleCopy["account"];
  navigation: { create: string; ideas: string; settings: string; appLabel: string };
  ideas: { title: string; hint: string; tryIdea: string };
  settings: { title: string; supportTitle: string };
  result: { share: string; more: string; report: string };
  report: NativeReportCopy;
}

export interface NativeDraftUi {
  scene: string;
  revision: number;
  hasContent: boolean;
  maxLength: number;
  usedLength: number;
  remainingLength: number;
  characterCountLabel: string;
}

export interface NativeAccountUi {
  status: "loading" | "signedOut" | "signedIn";
  email?: string;
  balanceLabel: string;
  initial?: string;
}

export type NativeAccountModalState = "closed" | "menu" | "signIn" | "deleteConfirm";

export interface NativeReportSubmission {
  reason: string;
  details: string;
  includeContent: boolean;
}

export interface NativePurchaseUi {
  visible: boolean;
  mode: "offer" | "signIn" | "checkout" | "success" | "error";
  title: string;
  body: string;
  quantityLabel: string;
  priceLabel?: string;
  termsLabel: string;
  failedGenerationsLabel?: string;
  buyLabel?: string;
  signInLabel?: string;
  cancelLabel: string;
  restoreLabel?: string;
  errorLabel?: string;
  busy: boolean;
}

export interface NativeDoodleUiProps {
  locale: Locale;
  direction: NativeDirection;
  tab: NativeTab;
  copy: NativeDoodleUiCopy;
  draft: NativeDraftUi;
  generation: GenerationUiState;
  usage: { status: "loading" | "ready"; label: string };
  account: NativeAccountUi;
  accountModal: NativeAccountModalState;
  ideas: readonly {
    id: string;
    imageUri: string | number;
    prompt: string;
    actionLabel: string;
  }[];
  referenceImageUri: string | number;
  locales: readonly { value: Locale; label: string }[];
  supportLinks: readonly { id: "contact" | "privacy" | "terms" | "refunds"; label: string }[];
  purchase?: NativePurchaseUi;
  modal: "none" | "more" | "image" | "purchase" | "report";
  onTabChange(tab: NativeTab): void;
  onSceneChange(scene: string): void;
  onCreate(): void;
  onRetry(): void;
  onSelectIdea(id: string): void;
  onDownload(): void;
  onShare(): void;
  onNewScene(): void;
  onRedraw(): void;
  onOpenMore(): void;
  onOpenReport(): void;
  onReportSubmit(report: NativeReportSubmission): void;
  onOpenLarger(): void;
  onCloseModal(): void;
  onOpenAccount(): void;
  onCloseAccount(): void;
  onSignIn(): void;
  onRefill(): void;
  onPurchase(): void;
  onRestore(): void;
  onCancelPurchase(): void;
  onSignOut(): void;
  onDeleteRequest(): void;
  onDeleteConfirm(): void;
  onLocaleChange(locale: Locale): void;
  onSupportLink(id: "contact" | "privacy" | "terms" | "refunds"): void;
}
```

`copy` is a property-typed native projection of the existing nested `DoodleCopy`, with native-only navigation, Ideas, result, Settings, and report labels. The implementation should keep this type adaptable when the service adapter maps web copy into native copy. `priceLabel`, `balanceLabel`, image URIs, and auth status are already resolved before rendering. The UI may own local modal focus, tab selection, character counting, and deterministic waiting-message rotation, but it must not decide whether a request, purchase, restore, report, or account mutation succeeds.

## Acceptance checks

- At 320 x 640, 360 x 640, and 390 x 844 dp, there is no horizontal overflow, clipped heading, hidden primary action, or bottom-tab overlap. The prompt and result have visible breathing space.
- At 640 x 360 and 720 x 400 dp, safe areas and keyboard behavior remain usable. If the prompt keyboard is open, the tab bar may hide or move so the composer remains reachable.
- All actionable controls are at least 48 dp high and have a visible native focus or pressed state. Text scales without truncating the primary action or modal title.
- Waiting keeps the yellow card, animated note, rotating in-card copy, fixed message slot, and polite status. Reduced motion removes decoration without removing feedback.
- Result shows the image, Download and Share first, then the distinct new-idea action and More. Redraw and Report are reachable through More and are absent from the primary action row.
- Larger image, More, purchase, sign-in, report, and delete modals trap focus appropriately, close on platform back, and restore focus to their invoking control.
- Signed-out users can find Sign in from the account slot. Signed-in users can reach refill before balance reaches a failed retry. Purchase UI shows the adapter-supplied store price and terms before payment.
- Ideas selection returns to Create with the selected prompt. Settings exposes all ten locales, marks the selected locale, and renders Arabic RTL with Alexandria.
- Screen-reader output includes labelled tabs with selected state, a labelled prompt and character limit, a polite waiting status, meaningful image alternatives, labelled icon buttons, and destructive confirmation text.
- Font QA verifies rendered family and Arabic shaping on an actual Android device or emulator. Asset QA verifies the eight idea files and reference image load from the native bundle. iOS should use the same tokens and assets even though this pass targets Android.

This contract is the handoff boundary for native UI implementation. It records the existing experience and leaves service decisions to the architecture and backend owners.
