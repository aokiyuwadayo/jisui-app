import { Suspense } from "react";
import { AuthorizeView } from "@/components/connect/AuthorizeView";

export default function AuthorizePage() {
  return (
    <Suspense>
      <AuthorizeView />
    </Suspense>
  );
}
