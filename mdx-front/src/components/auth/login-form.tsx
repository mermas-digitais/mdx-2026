"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

const fieldClass =
  "h-12 w-full rounded-2xl border border-[#E7E0EE] bg-white px-4 text-base text-[#330043] outline-none placeholder:text-[#B7A9C4] focus:border-[#B457FC]";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const callback = params.get("callbackUrl") ?? "/conta";
  const registerHref = params.get("callbackUrl")
    ? `/cadastrar?callbackUrl=${encodeURIComponent(params.get("callbackUrl") ?? "")}`
    : "/cadastrar";

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${api}/api/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
      devCode?: string;
      cooldown?: boolean;
    } | null;
    setPending(false);

    if (response.status === 429) {
      setError("Muitas tentativas. Espere alguns minutos e tente de novo.");
      return;
    }
    if (!response.ok) {
      setError(typeof body?.message === "string" ? body.message : "Não foi possível enviar o código.");
      return;
    }

    setDevCode(typeof body?.devCode === "string" ? body.devCode : null);
    setStep("code");
  }

  async function confirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      code,
      redirect: false,
    });
    setPending(false);

    if (result?.code === "rate_limit") {
      setError("Muitas tentativas. Espere alguns minutos e tente de novo.");
      return;
    }
    if (result?.error) {
      setError("Código incorreto ou vencido.");
      return;
    }

    router.push(callback.startsWith("/") ? callback : "/conta");
    router.refresh();
  }

  if (step === "code") {
    return (
      <form className="flex flex-col gap-4" onSubmit={(event) => void confirmCode(event)}>
        <div className="text-center">
          <h1 className="font-heading text-[1.7rem] text-[#1E1033]">Confira o e-mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8B7C99]">
            Enviamos um código de 6 dígitos para <span className="font-semibold text-[#330043]">{email}</span>.
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="sr-only">Código de 6 dígitos</span>
          <input
            value={code}
            onChange={(item) => setCode(item.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="000000"
            aria-invalid={error ? true : undefined}
            className={`${fieldClass} text-center text-2xl font-bold tracking-[0.45em]`}
          />
        </label>
        {devCode ? (
          <p className="rounded-2xl bg-[#F6F0FF] px-4 py-3 text-sm text-[#4C1D95]">
            O envio de e-mail ainda não está configurado neste ambiente. Seu código é <strong>{devCode}</strong>.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-center text-sm font-semibold text-[#BE185D]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || code.length < 6}
          className="h-12 rounded-full bg-gradient-to-r from-[#FF4A97] to-[#B457FC] text-base font-bold text-white shadow-[0_10px_24px_rgba(180,87,252,0.35)] disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-[#8B7C99]"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void requestCode(event)}>
      <div className="text-center">
        <h1 className="font-heading text-[1.7rem] text-[#1E1033]">Bem-vinda =)</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8B7C99]">
          Entre com o e-mail da sua conta. A gente envia um código para confirmar.
        </p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="sr-only">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(item) => setEmail(item.target.value)}
          autoComplete="email"
          required
          placeholder="Seu e-mail"
          aria-invalid={error ? true : undefined}
          className={fieldClass}
        />
      </label>
      {error ? (
        <p role="alert" className="text-center text-sm font-semibold text-[#BE185D]">
          {error}{" "}
          {error.includes("Não encontramos") ? (
            <Link href={registerHref} className="underline">
              Criar conta
            </Link>
          ) : null}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-gradient-to-r from-[#FF4A97] to-[#B457FC] text-base font-bold text-white shadow-[0_10px_24px_rgba(180,87,252,0.35)] disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Receber código"}
      </button>
      <Link
        href={registerHref}
        className="flex h-12 items-center justify-center rounded-full border border-[#E7E0EE] text-base font-semibold text-[#330043]"
      >
        Criar conta
      </Link>
    </form>
  );
}
