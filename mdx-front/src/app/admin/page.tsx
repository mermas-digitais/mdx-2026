import type { Metadata } from "next";
import { InscriptionDesk } from "@/components/admin/inscription-desk";
import { listarInscricoes } from "@/server/events";

export const metadata: Metadata = {
  title: "Inscrições",
};

export const instant = false;

export default async function AdminPage() {
  const board = await listarInscricoes("mdx-2026");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8">
      {!board.ok ? <p className="font-heading text-[#330043]">{board.message}</p> : <InscriptionDesk initial={board.data} />}
    </main>
  );
}
