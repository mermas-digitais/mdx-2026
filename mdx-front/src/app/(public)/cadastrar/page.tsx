import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Cadastrar",
};

export default function CadastrarPage() {
  return (
    <AuthCard
      title="Cadastrar"
      description="A conta pede nome, e-mail, CPF e senha. Quem organiza um evento recebe o papel dentro dele."
    >
      <Suspense fallback={<p>Carregando o formulário…</p>}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
