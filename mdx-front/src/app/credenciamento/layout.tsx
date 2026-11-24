import { Suspense } from "react";
import { CredenciamentoGate } from "@/components/credenciamento/gate";
import { credenciamentoToken } from "@/server/credenciamento-cookie";

export const instant = false;

export default function CredenciamentoLayout({ children }: LayoutProps<"/credenciamento">) {
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-brand-lilac" />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const token = await credenciamentoToken();
  if (!token) return <CredenciamentoGate />;
  return <div className="min-h-dvh bg-brand-lilac">{children}</div>;
}
