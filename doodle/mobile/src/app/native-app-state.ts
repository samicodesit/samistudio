import type { PaperColorId } from "../../../src/lib/generation/paper-colors";
import type { DetailLevel } from "../../../src/lib/generation/detail-level";
import type {
  NativeAccountModalState,
  NativeAccountUi,
  NativeContentModal,
  NativeGenerationUiState,
  NativeLocale,
  NativePurchaseUi,
  NativeSceneSource,
  NativeTab,
} from "../ui/types";
import type { AccountSummary } from "../contracts/native";

export interface NativeAppState {
  locale: NativeLocale;
  paperColor: PaperColorId;
  paperReady: boolean;
  detailLevel: DetailLevel;
  detailReady: boolean;
  tab: NativeTab;
  scene: string;
  sceneSource: NativeSceneSource;
  revision: number;
  generation: NativeGenerationUiState;
  account: NativeAccountUi;
  accountModal: NativeAccountModalState;
  modal: NativeContentModal;
  purchase?: NativePurchaseUi;
  usage: { status: "loading" | "ready" | "error"; label: string };
  freeRemaining: number | null;
  paidRemaining: number | null;
}

export function resultUsage(state: NativeAppState) {
  return { ...state.usage, lastFree: state.generation.status === "ready" && !!state.generation.freeExhausted && !(state.paidRemaining !== null && state.paidRemaining > 0) };
}

export function isNativeCreditExhausted(freeRemaining: number | null, paidRemaining: number | null) {
  // An unknown trial balance still needs to be resolved by the server. Signing
  // in before the first drawing must not turn an uninitialized trial into zero.
  return freeRemaining === 0 && (paidRemaining === null || paidRemaining === 0);
}

export const initialAppState: NativeAppState = {
  locale: "en",
  paperColor: "yellow",
  paperReady: false,
  detailLevel: "medium",
  detailReady: false,
  tab: "create",
  scene: "",
  sceneSource: "empty",
  revision: 0,
  generation: { status: "idle" },
  account: { status: "loading", balanceLabel: "" },
  accountModal: "closed",
  modal: "none",
  usage: { status: "loading", label: "" },
  freeRemaining: null,
  paidRemaining: null,
};

export type NativeAppAction =
  | { type: "paperColorLoaded"; paperColor: PaperColorId }
  | { type: "paperColorChanged"; paperColor: PaperColorId }
  | { type: "pendingPurchaseEnded" }
  | { type: "detailLevelLoaded"; detailLevel: DetailLevel }
  | { type: "detailLevelChanged"; detailLevel: DetailLevel }
  | { type: "sceneChanged"; scene: string }
  | { type: "generationStarted"; loadingMessages: readonly string[]; statusLabel: string }
  | { type: "generationIdle" }
  | { type: "generationRestored"; generation: NativeGenerationUiState }
  | { type: "generationReady"; imageUri: string; imageAlt: string; freeRemaining?: number; paidRemaining?: number }
  | { type: "generationFailed"; message: string; retryLabel?: string }
  | { type: "resultBack" }
  | { type: "newScene" }
  | { type: "ideaSelected"; scene: string }
  | { type: "tabChanged"; tab: NativeTab }
  | { type: "modalChanged"; modal: NativeContentModal }
  | { type: "accountModalChanged"; modal: NativeAccountModalState }
  | { type: "accountLoading"; provider?: "google" | "apple" }
  | { type: "accountError" }
  | { type: "accountLoaded"; account: AccountSummary; balanceLabel?: string }
  | { type: "usageChanged"; label: string; freeRemaining?: number; paidRemaining?: number }
  | { type: "purchaseChanged"; purchase: Partial<NativePurchaseUi> | null }
  | { type: "localeChanged"; locale: NativeLocale };

export function appReducer(state: NativeAppState, action: NativeAppAction): NativeAppState {
  switch (action.type) {
    case "paperColorLoaded": return { ...state, paperColor: action.paperColor, paperReady: true };
    case "paperColorChanged": return state.generation.status === "waiting" ? state : { ...state, paperColor: action.paperColor };
    case "detailLevelLoaded":
      return { ...state, detailLevel: action.detailLevel, detailReady: true };
    case "detailLevelChanged":
      return state.generation.status === "waiting" ? state : { ...state, detailLevel: action.detailLevel };
    case "sceneChanged": {
      const sceneSource: NativeSceneSource = state.sceneSource === "idea" || state.sceneSource === "result"
        ? state.sceneSource
        : action.scene.trim().length === 0
          ? "empty"
          : "typed";
      return { ...state, scene: action.scene, sceneSource, revision: state.revision + 1 };
    }
    case "generationStarted":
      return {
        ...state,
        generation: { status: "waiting", loadingMessages: action.loadingMessages, loadingMessageIndex: 0, statusLabel: action.statusLabel },
        modal: "none",
      };
    case "generationIdle":
      return { ...state, generation: { status: "idle" }, modal: state.modal === "purchase" ? state.modal : "none" };
    case "generationRestored":
      return { ...state, generation: action.generation };
    case "generationReady":
      return {
        ...state,
        generation: { status: "ready", imageUri: action.imageUri, imageAlt: action.imageAlt, ...(action.freeRemaining === 0 ? { freeExhausted: true } : {}) },
        freeRemaining: action.freeRemaining ?? state.freeRemaining,
        paidRemaining: action.paidRemaining ?? state.paidRemaining,
        modal: "none",
      };
    case "generationFailed":
      return {
        ...state,
        generation: { status: "error", message: action.message, retryLabel: action.retryLabel ?? "Try again" },
        modal: "none",
      };
    case "resultBack":
      if (state.generation.status !== "ready") return state;
      return { ...state, sceneSource: "result", generation: { status: "idle" }, modal: "none" };
    case "newScene":
      return { ...state, scene: "", sceneSource: "empty", revision: state.revision + 1, generation: { status: "idle" }, modal: "none", purchase: undefined };
    case "ideaSelected":
      if (state.generation.status === "waiting") return state;
      return { ...state, scene: action.scene, sceneSource: "idea", revision: state.revision + 1, generation: { status: "idle" }, tab: "create", modal: "none" };
    case "tabChanged":
      return { ...state, tab: action.tab };
    case "modalChanged":
      return { ...state, modal: action.modal };
    case "accountModalChanged":
      return { ...state, accountModal: action.modal };
    case "accountLoading":
      return { ...state, account: { ...state.account, status: "loading", balanceLabel: "", pendingProvider: action.provider }, usage: { status: "loading", label: "" } };
    case "accountError":
      return { ...state, account: { ...state.account, status: "error", balanceLabel: "", pendingProvider: undefined }, usage: { status: "error", label: "" } };
    case "accountLoaded":
      return {
        ...state,
        account: toAccountUi(action.account, action.balanceLabel ?? String(action.account.balance)),
        usage: { status: "ready", label: action.balanceLabel ?? String(action.account.balance) },
        freeRemaining: action.account.freeRemaining,
        paidRemaining: action.account.authenticated ? action.account.balance : null,
      };
    case "usageChanged":
      return {
        ...state,
        account: { ...state.account, balanceLabel: action.label },
        usage: { status: "ready", label: action.label },
        freeRemaining: action.freeRemaining ?? state.freeRemaining,
        paidRemaining: action.paidRemaining ?? state.paidRemaining,
      };
    case "pendingPurchaseEnded":
      return state.purchase?.mode === "pending" ? { ...state, purchase: { ...state.purchase, mode: "offer", busy: false }, modal: "purchase" } : state;
    case "purchaseChanged":
      if (!action.purchase) return { ...state, purchase: undefined, modal: state.modal === "purchase" ? "none" : state.modal };
      return { ...state, purchase: { ...emptyPurchaseUi, ...state.purchase, ...action.purchase, visible: true }, modal: "purchase" };
    case "localeChanged":
      return { ...state, locale: action.locale };
  }
}

export function toAccountUi(account: AccountSummary, balanceLabel: string): NativeAccountUi {
  if (!account.authenticated) return { status: "signedOut", balanceLabel };
  const first = Array.from(account.email ?? "")[0];
  return { status: "signedIn", email: account.email ?? undefined, initial: first?.toUpperCase(), balanceLabel };
}

const emptyPurchaseUi: NativePurchaseUi = {
  visible: true,
  mode: "offer",
  title: "",
  body: "",
  quantityLabel: "",
  termsLabel: "",
  cancelLabel: "",
  busy: false,
};
