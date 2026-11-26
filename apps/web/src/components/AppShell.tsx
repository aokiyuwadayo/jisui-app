"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { href: "/", label: "冷蔵庫" },
  { href: "/suggest", label: "提案" },
  { href: "/recipes", label: "レシピ" },
  { href: "/settings", label: "設定" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-baseline justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
        <Link href="/" className="font-serif text-2xl font-bold">
          jisui
        </Link>
        <SignOutButton />
      </header>

      <main className="flex-1 px-5 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {tabs.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-3 text-xs ${
                    active ? "text-espresso font-bold" : "text-mute"
                  }`}
                >
                  <span
                    className={`h-1 w-1 rounded-full ${active ? "bg-terracotta" : "bg-transparent"}`}
                  />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="text-xs text-mute underline-offset-4 hover:underline"
    >
      ログアウト
    </button>
  );
}
