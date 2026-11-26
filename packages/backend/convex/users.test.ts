import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { ALLOWED, setup } from "./test.setup";

const profile = (email: string, emailVerified = true) => ({
  name: "google" as const,
  profile: { id: "sub-1", email, emailVerified },
});

describe("Google ログインの許可リスト", () => {
  it("許可されたメールならユーザーを作る", async () => {
    const t = await setup();
    const id = await t.mutation(internal.users.createUserGoogle, { method: profile(ALLOWED) });
    expect(id).toBeTruthy();
  });

  it("許可されていない・未確認のメールは拒否する", async () => {
    const t = await setup();
    await expect(
      t.mutation(internal.users.createUserGoogle, { method: profile("x@example.com") }),
    ).rejects.toThrow("このアカウントではログインできません");
    await expect(
      t.mutation(internal.users.createUserGoogle, { method: profile(ALLOWED, false) }),
    ).rejects.toThrow();
  });
});
