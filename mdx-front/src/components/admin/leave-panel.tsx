"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { leavePanel } from "@/server/panel-session";

export function LeavePanel() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void leavePanel().then(() => router.refresh());
      }}
      className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-60"
    >
      <span>{pending ? "Saindo…" : "Sair"}</span>
    </button>
  );
}
