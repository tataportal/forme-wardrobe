"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountCredits } from "./account-credits";

export function PublicAccount() {
  const [account, setAccount] = useState<{ credits: number; creditsUsed: number; onboardingCompleted: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (active && result?.user) setAccount({
          credits: result.user.credits ?? 0,
          creditsUsed: result.user.creditsUsed ?? 0,
          onboardingCompleted: Boolean(result.user.onboardingCompleted),
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return <div className="public-account-actions">
    {account && <AccountCredits {...account} onTutorial={() => { window.location.href = "/closet?onboarding=1"; }} />}
    <Link className="public-account-entry" href="/perfil">Mi cuenta</Link>
  </div>;
}
