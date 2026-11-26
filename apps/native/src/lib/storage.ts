import type { TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";

/** SecureStore のキーに使える文字（英数字・. - _）だけにそろえる */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

/** ログインのトークンを端末の安全な領域に保存する */
export const secureStorage: TokenStorage = {
  getItem: (key) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(safeKey(key)),
};
