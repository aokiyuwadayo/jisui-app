import { describe, expect, it } from "vitest";
import { addDays, daysUntil, expiryStatus, parseDate, todayInTokyo } from "./expiry";

describe("parseDate", () => {
  it("正しい日付を読める", () => {
    expect(parseDate("2026-11-26")).toBe(Date.UTC(2026, 10, 26));
  });
  it("存在しない日付や形式違いは null", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("2026/11/26")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("月またぎ・過去を数えられる", () => {
    expect(daysUntil("2026-12-01", "2026-11-26")).toBe(5);
    expect(daysUntil("2026-11-25", "2026-11-26")).toBe(-1);
  });
});

describe("expiryStatus", () => {
  const today = "2026-11-26";
  it.each([
    [undefined, "none"],
    ["2026-11-25", "expired"],
    ["2026-11-26", "today"],
    ["2026-11-28", "soon"],
    ["2026-11-29", "ok"],
    ["broken", "none"],
  ] as const)("%s → %s", (expiresOn, expected) => {
    expect(expiryStatus(expiresOn, today)).toBe(expected);
  });
});

describe("todayInTokyo", () => {
  it("UTCの夕方は日本では翌日", () => {
    expect(todayInTokyo(new Date("2026-11-26T16:00:00Z"))).toBe("2026-11-27");
  });
});

describe("addDays", () => {
  it("日数を足せる", () => {
    expect(addDays("2026-11-30", 3)).toBe("2026-12-03");
    expect(addDays("bad", 1)).toBeNull();
  });
});
