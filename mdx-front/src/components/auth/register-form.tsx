"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { CpfField } from "@/components/public/masked-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      cpf,
      password: String(data.get("password") ?? ""),
    };
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${api}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      setPending(false);
      setError(
        typeof body?.message === "string"
          ? body.message
          : "Confira os dados. A senha precisa ter pelo menos 8 caracteres e o CPF precisa ser válido.",
      );
      return;
    }

    const result = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError("Conta criada. Entre com o e-mail e a senha.");
      return;
    }
    const callback = params.get("callbackUrl") ?? "/conta";
    router.push(callback.startsWith("/") ? callback : "/conta");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          Nome
        </label>
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="cpf" className="text-sm font-medium">
          CPF
        </label>
        <CpfField id="cpf" value={cpf} onChange={setCpf} required />
        <p className="text-sm text-brand-purple">
          Obrigatório. Se você for aluna de uma equipe, use o mesmo CPF que o orientador informou.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="senha-ajuda"
        />
        <p id="senha-ajuda" className="text-sm text-brand-purple">
          Pelo menos 8 caracteres.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-brand-pink-dark">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Criando conta…" : "Cadastrar"}
      </Button>
      <p className="text-sm text-brand-purple">
        <Link href="/entrar" className="underline-offset-4 hover:underline">
          Já tenho conta
        </Link>
      </p>
    </form>
  );
}
