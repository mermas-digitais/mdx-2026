import { Suspense } from "react";
import { RoboticaGate } from "@/components/robotica/gate";
import { roboticaAutorizada } from "@/server/robotica-access";

export const instant = false;

export default function DesafioRoboticaLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F5F0FF]" />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const allowed = await roboticaAutorizada();
  if (!allowed) return <RoboticaGate />;
  return children;
}
