"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { entrarRobotica } from "@/server/robotica-access";

export function RoboticaGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const message = await entrarRobotica(password);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setPassword("");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F0FF] px-4 font-heading text-[#1E1033]">
      <form
        onSubmit={(event) => void submit(event)}
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-md ring-1 ring-[#4C1D95]/15"
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#7C3AED] uppercase">Mermãs Digitais</p>
          <h1 className="text-3xl font-bold text-[#4C1D95]">Desafio de Robótica</h1>
          <p className="mt-2 text-base font-semibold text-[#4C1D95]">Digite a senha para abrir o placar.</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="h-12 rounded-2xl border-2 border-[#4C1D95]/20 px-4 text-base font-semibold outline-none focus:border-[#7C3AED]"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-bold text-[#BE185D]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="h-12 cursor-pointer rounded-full bg-[#EC4899] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
