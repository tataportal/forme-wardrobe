"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountCredits } from "./account-credits";

export function PublicAccount() {
  const [account, setAccount] = useState<{ credits?: number; creditsUsed?: number } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => { if (active && data?.user) setAccount(data.user); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <div className="public-account-actions">{account && <AccountCredits {...account} onTutorial={() => { window.location.href = "/closet?onboarding=1"; }} />}<Link className="public-account-entry" href="/perfil">Mi cuenta</Link></div>;
}
