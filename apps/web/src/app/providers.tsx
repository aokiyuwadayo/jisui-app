"use client";

import { api } from "@jisui/backend/api";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useState } from "react";
import { AuthGate } from "@/components/AuthGate";

export function Providers({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));

  if (!client) {
    return (
      <p className="p-6 text-sm text-mute">
        NEXT_PUBLIC_CONVEX_URL が設定されていません。
      </p>
    );
  }

  return (
    <ConvexAuthProvider
      client={client}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      <AuthGate>{children}</AuthGate>
    </ConvexAuthProvider>
  );
}
