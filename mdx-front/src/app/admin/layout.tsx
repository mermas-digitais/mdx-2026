import { Suspense } from "react";
import { PanelGate } from "@/components/admin/panel-gate";
import { AdminShell } from "@/components/layout/admin-shell";
import { panelToken } from "@/server/panel-cookie";

export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-brand-lilac" />}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  );
}

async function PanelFrame({ children }: { children: React.ReactNode }) {
  const token = await panelToken();
  if (!token) return <PanelGate />;
  return <AdminShell>{children}</AdminShell>;
}
