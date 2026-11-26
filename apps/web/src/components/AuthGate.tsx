"use client";

import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="grid min-h-dvh place-items-center text-sm text-mute">
          抽出中…
        </div>
      </AuthLoading>
      <Unauthenticated>
        <LoginScreen />
      </Unauthenticated>
      <Authenticated>
        <AppShell>{children}</AppShell>
      </Authenticated>
    </>
  );
}
