import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./access";

describe("isAllowedEmail", () => {
  it("大文字小文字と空白を無視して照合する", () => {
    expect(isAllowedEmail("Me@Example.com", " me@example.com , other@x.jp")).toBe(true);
  });
  it("リストにない・未設定なら拒否", () => {
    expect(isAllowedEmail("x@example.com", "me@example.com")).toBe(false);
    expect(isAllowedEmail("me@example.com", undefined)).toBe(false);
    expect(isAllowedEmail(undefined, "me@example.com")).toBe(false);
    expect(isAllowedEmail("me@example.com", " , ")).toBe(false);
  });
});
