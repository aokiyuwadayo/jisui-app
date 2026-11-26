import { Platform } from "react-native";

/** Web 版と同じ色（サードウェーブ系カフェ） */
export const colors = {
  cream: "#f6f1e9",
  paper: "#fffdf9",
  oat: "#ece3d5",
  line: "#e2d6c4",
  espresso: "#2e2219",
  roast: "#6b4a33",
  mute: "#8a7a6a",
  terracotta: "#c2673f",
  sage: "#7f9271",
  alert: "#b5482f",
} as const;

/** 見出しは明朝 */
export const serif = Platform.select({ ios: "Hiragino Mincho ProN", default: "serif" });
