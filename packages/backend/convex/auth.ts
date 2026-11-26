import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { components, internal } from "./_generated/api";

const core = setupConvexAuth({ component: components.auth });

export const { signOut, refreshSession, isAuthenticated } = core;

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(
  core,
  {
    component: components.authGoogle,
    // カンマ区切り。例: https://jisui.example.com,http://localhost:3000
    allowedRedirectOrigins: (process.env.ALLOWED_REDIRECT_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
).attachUserCallbacks({
  createUser: internal.users.createUserGoogle,
  onSignIn: internal.users.onSignInGoogle,
});
