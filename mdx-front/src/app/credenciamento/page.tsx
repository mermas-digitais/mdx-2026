import type { Metadata } from "next";
import { CredenciamentoDesk } from "@/components/credenciamento/desk";
import { listarCredenciamento } from "@/server/credenciamento";

export const metadata: Metadata = {
  title: "Credenciamento",
};

export const instant = false;

export default async function CredenciamentoPage() {
  const board = await listarCredenciamento("mdx-2026");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8">
      {!board.ok ? (
        <p className="font-heading text-[#330043]">{board.message}</p>
      ) : (
        <CredenciamentoDesk initial={board.data} />
      )}
    </main>
  );
}
