export type NativeLocale = "en" | "nl" | "de" | "fr" | "es" | "pt-br" | "it" | "ja" | "ko" | "ar";
export type NativeDirection = "ltr" | "rtl";
export type NativeTab = "create" | "ideas" | "settings";
export type NativeSceneSource = "empty" | "typed" | "idea" | "result";
export type NativeImageSource = string | number;

export interface NativePluralTemplates {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface NativeDoodleUiCopy {
  localeLabel: string;
  header: { languageLabel: string };
  footer: { privacy: string; terms: string; refunds: string; contact: string };
  composer: {
    title: string;
    hint: string;
    label: string;
    placeholder: string;
    create: string;
    drawing: string;
  };
  errors: { refused: string; timeout: string; general: string; unavailable: string; rateLimited: string };
  suggestions: { title: string; items: readonly string[] };
  stage: {
    loadingPrimary: string;
    loadingSr: string;
    generatedAlt: string;
    viewLarger: string;
    referenceAria: string;
    referenceAlt: string;
  };
  actions: { download: string; tryAgain: string; redraw: string; newScene: string };
  dialog: { label: string; close: string; imageAlt: string; download: string };
  usage: { firstTwoFree: string; freeLeft: NativePluralTemplates; paidLeft: NativePluralTemplates };
  purchase: {
    label: string;
    title: string;
    quantity: string;
    reassurance: string;
    failedDontCount: string;
    buy: string;
    cancel: string;
    restore: string;
    added: string;
    startDrawing: string;
    checkoutError: string;
  };
  auth: { signIn: string; google: string; loading: string; authError: string };
  account: {
    label: string;
    signOut: string;
    delete: string;
    deleteWarning: string;
    confirmDelete: string;
    cancelDelete: string;
  };
  navigation: { create: string; ideas: string; settings: string; appLabel: string };
  ideas: { title: string; hint: string; tryIdea: string };
  settings: { title: string; supportTitle: string };
  result: { share: string; more: string; report: string };
  report: {
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
  };
}

export interface NativeDraftUi {
  scene: string;
  sceneSource: NativeSceneSource;
  revision: number;
  hasContent: boolean;
  maxLength: number;
  usedLength: number;
  remainingLength: number;
  characterCountLabel: string;
}

export interface NativeGenerationIdle {
  status: "idle";
}

export interface NativeGenerationWaiting {
  status: "waiting";
  loadingMessages: readonly string[];
  loadingMessageIndex: number;
  statusLabel: string;
}

export interface NativeGenerationReady {
  status: "ready";
  imageUri: NativeImageSource;
  imageAlt: string;
}

export interface NativeGenerationError {
  status: "error";
  message: string;
  retryLabel: string;
}

export type NativeGenerationUiState =
  | NativeGenerationIdle
  | NativeGenerationWaiting
  | NativeGenerationReady
  | NativeGenerationError;

export interface NativeAccountUi {
  status: "loading" | "signedOut" | "signedIn" | "error";
  email?: string;
  balanceLabel: string;
  initial?: string;
}

export type NativeAccountModalState = "closed" | "menu" | "signIn" | "deleteConfirm";

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

export interface NativeIdea {
  id: string;
  imageUri: NativeImageSource;
  prompt: string;
  actionLabel: string;
}

export interface NativeLocaleOption {
  value: NativeLocale;
  label: string;
}

export interface NativeSupportLink {
  id: "contact" | "privacy" | "terms" | "refunds";
  label: string;
}

export interface NativeReportSubmission {
  reason: string;
  details: string;
  includeContent: boolean;
}

export interface NativeReportUiState {
  pending: boolean;
  error?: string;
}

export const NATIVE_REPORT_DETAILS_MAX_LENGTH = 500;

export type NativeContentModal = "none" | "more" | "image" | "purchase" | "report";

export interface NativeDoodleUiProps {
  locale: NativeLocale;
  direction: NativeDirection;
  tab: NativeTab;
  copy: NativeDoodleUiCopy;
  draft: NativeDraftUi;
  generation: NativeGenerationUiState;
  usage: { status: "loading" | "ready"; label: string };
  account: NativeAccountUi;
  accountModal: NativeAccountModalState;
  ideas: readonly NativeIdea[];
  referenceImageUri: NativeImageSource;
  locales: readonly NativeLocaleOption[];
  supportLinks: readonly NativeSupportLink[];
  purchase?: NativePurchaseUi;
  reportState: NativeReportUiState;
  modal: NativeContentModal;
  /**
   * These callbacks are the only service boundary. The adapter owns all
   * network, auth, billing, report submission, and account mutations. The
   * native view only emits user intent and renders the next supplied state.
   */
  onTabChange(tab: NativeTab): void;
  onSceneChange(scene: string): void;
  onCreate(): void;
  onRetry(): void;
  onSelectIdea(id: string): void;
  onDownload(): void;
  onShare(): void;
  onNewScene(): void;
  onResultBack(): void;
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
  onLocaleChange(locale: NativeLocale): void;
  onSupportLink(id: NativeSupportLink["id"]): void;
}
