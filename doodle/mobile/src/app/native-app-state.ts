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
  tab: NativeTab;
  scene: string;
  sceneSource: NativeSceneSource;
  revision: number;
  generation: NativeGenerationUiState;
  account: NativeAccountUi;
  accountModal: NativeAccountModalState;
  modal: NativeContentModal;
  purchase?: NativePurchaseUi;
  usage: { status: "loading" | "ready"; label: string };
  freeRemaining: number | null;
  paidRemaining: number | null;
}

export const initialAppState: NativeAppState = {
  locale: "en",
  tab: "create",
  scene: "",
  sceneSource: "empty",
  revision: 0,
  generation: { status: "idle" },
  account: { status: "signedOut", balanceLabel: "" },
  accountModal: "closed",
  modal: "none",
  usage: { status: "ready", label: "First 2 doodles free" },
  freeRemaining: null,
  paidRemaining: null,
};

export type NativeAppAction =
  | { type: "sceneChanged"; scene: string }
  | { type: "generationStarted"; loadingMessages: readonly string[]; statusLabel: string }
  | { type: "generationIdle" }
  | { type: "generationReady"; imageUri: string; imageAlt: string; freeRemaining?: number; paidRemaining?: number }
  | { type: "generationFailed"; message: string; retryLabel?: string }
  | { type: "resultBack" }
  | { type: "newScene" }
  | { type: "ideaSelected"; scene: string }
  | { type: "tabChanged"; tab: NativeTab }
  | { type: "modalChanged"; modal: NativeContentModal }
  | { type: "accountModalChanged"; modal: NativeAccountModalState }
  | { type: "accountLoading" }
  | { type: "accountError" }
  | { type: "accountLoaded"; account: AccountSummary; balanceLabel?: string }
  | { type: "usageChanged"; label: string; freeRemaining?: number; paidRemaining?: number }
  | { type: "purchaseChanged"; purchase: Partial<NativePurchaseUi> | null }
  | { type: "localeChanged"; locale: NativeLocale };

export function appReducer(state: NativeAppState, action: NativeAppAction): NativeAppState {
  switch (action.type) {
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
    case "generationReady":
      return {
        ...state,
        generation: { status: "ready", imageUri: action.imageUri, imageAlt: action.imageAlt },
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
      return { ...state, account: { ...state.account, status: "loading" } };
    case "accountError":
      return { ...state, account: { ...state.account, status: "error" } };
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
        usage: { status: "ready", label: action.label },
        freeRemaining: action.freeRemaining ?? state.freeRemaining,
        paidRemaining: action.paidRemaining ?? state.paidRemaining,
      };
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
  return { status: "signedIn", email: account.email ?? undefined, initial: first?.toUpperCase() ?? "?", balanceLabel };
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
