import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type NativeIconName =
  | "photo"
  | "create"
  | "ideas"
  | "settings"
  | "download"
  | "share"
  | "more"
  | "redraw"
  | "report"
  | "close"
  | "back"
  | "account"
  | "signIn"
  | "signOut"
  | "delete"
  | "addCircle"
  | "check"
  | "support"
  | "language"
  | "chevronForward"
  | "chevronUp"
  | "chevronDown"
  | "expand";

const ICONS: { [key in NativeIconName]: IoniconName } = {
  photo: "image-outline",
  create: "pencil-outline",
  ideas: "bulb-outline",
  settings: "settings-outline",
  download: "download-outline",
  share: "share-outline",
  more: "ellipsis-horizontal",
  redraw: "refresh-outline",
  report: "flag-outline",
  close: "close",
  back: "arrow-back",
  account: "person-circle-outline",
  signIn: "log-in-outline",
  signOut: "log-out-outline",
  delete: "trash-outline",
  addCircle: "add-circle-outline",
  check: "checkmark",
  support: "help-circle-outline",
  language: "globe-outline",
  chevronForward: "chevron-forward",
  chevronUp: "chevron-up",
  chevronDown: "chevron-down",
  expand: "expand-outline",
};

export function NativeIcon({ name, size = 22, color }: { name: NativeIconName; size?: number; color: string }) {
  return <Ionicons name={ICONS[name]} size={size} color={color} />;
}
