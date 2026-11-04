"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GradientButton, StepHeading } from "@/components/public/form-chrome";
import { CpfField, inscriptionInputClass, PhoneField, formatCpf } from "@/components/public/masked-fields";
import {
  answerError,
  fieldApplies,
  fixedFields,
  formIssues,
  registrationSchema,
  type FormFieldConfig,
} from "@/server/form-schema";
import { inscrever } from "@/server/events";

const selectClass =
  "h-14 w-full rounded-full border-0 bg-white px-5 text-base text-[#330043] shadow-[0_10px_28px_rgba(88,28,135,0.08)] ring-1 ring-[#F6E9FF] outline-none focus:ring-2 focus:ring-[#FF4A97]";

export function SteppedRegistration({
  fields,
  slug,
  preview = false,
  closed = false,
  defaultName = "",
  defaultEmail = "",
  accountCpf = "",
  prepareAccount,
  checkCpf,
  onBack,
}: {
  fields: FormFieldConfig[];
  slug?: string;
  preview?: boolean;
  closed?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  accountCpf?: string;
  prepareAccount?: (name: string, cpf: string) => Promise<string | null>;
  checkCpf?: (cpf: string) => Promise<string | null>;
  onBack?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const email = defaultEmail;
  const [cpf, setCpf] = useState(() => formatCpf(accountCpf));
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const category = "VISITOR" as const;
  const [answers, setAnswers] = useState<Record<string, string | boolean | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [passport, setPassport] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = useMemo(
    () => fields.filter((field) => fieldApplies(field, category)),
    [fields, category],
  );
  const stages: Array<"voce" | "perguntas" | "confirmar"> = visible.length > 0
    ? ["voce", "perguntas", "confirmar"]
    : ["voce", "confirmar"];
  const current = stages[Math.min(step, stages.length - 1)] ?? "voce";

  useEffect(() => {
    document.getElementById("inscricao-card")?.scrollTo({ top: 0 });
  }, [step]);

  function payload() {
    return {
      name,
      email,
      cpf,
      phone,
      institution,
      category,
      answers: Object.fromEntries(
        visible.map((field) => {
          const value = answers[field.id];
          if (field.type === "NUMBER") return [field.id, value === "" || value === undefined ? "" : Number(value)];
          if (field.type === "CHECKBOX" && field.options.length > 0) return [field.id, value ?? []];
          if (field.type === "CHECKBOX") return [field.id, value === true];
          return [field.id, value ?? ""];
        }),
      ),
    };
  }

  function issues() {
    const parsed = registrationSchema(fields).safeParse(payload());
    return parsed.success ? {} : formIssues(parsed.error);
  }

  async function next() {
    const found = issues();
    const keys =
      current === "voce"
        ? ["name", "email", "cpf", "phone", "institution"]
        : current === "perguntas"
          ? visible.map((field) => `answers.${field.id}`)
          : [];
    const stepErrors = Object.fromEntries(Object.entries(found).filter(([key]) => keys.includes(key)));
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (current === "voce" && checkCpf) {
      setPending(true);
      const cpfMessage = await checkCpf(cpf);
      setPending(false);
      if (cpfMessage) {
        setErrors({ cpf: cpfMessage });
        document.getElementById("reg-cpf")?.scrollIntoView({ block: "center" });
        return;
      }
    }
    setErrors({});
    setStep((value) => Math.min(value + 1, stages.length - 1));
  }

  async function submit() {
    const found = issues();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      if (found.name || found.email || found.cpf || found.phone || found.institution) setStep(0);
      else if (Object.keys(found).some((key) => key.startsWith("answers."))) {
        const perguntas = stages.indexOf("perguntas");
        if (perguntas >= 0) setStep(perguntas);
      }
      return;
    }
    setErrors({});
    setPending(true);
    if (prepareAccount) {
      const accountError = await prepareAccount(name, cpf);
      if (accountError) {
        setPending(false);
        if (/cpf/i.test(accountError)) {
          setStep(0);
          setErrors({ cpf: accountError });
          setMessage(null);
          return;
        }
        setMessage(accountError);
        return;
      }
    }
    if (preview || !slug) {
      setPending(false);
      setMessage("Pré-visualização válida. Nada foi enviado.");
      return;
    }
    if (closed) {
      setPending(false);
      setMessage("As inscrições deste evento estão encerradas.");
      return;
    }
    const result = await inscrever(slug, payload());
    setPending(false);
    if (!result.ok) {
      const fields = result.fields ?? {};
      if (fields.cpf || /cpf/i.test(result.message)) {
        setStep(0);
        setErrors({ ...fields, cpf: fields.cpf ?? result.message });
        setMessage(null);
        return;
      }
      setErrors(fields);
      setMessage(result.message);
      return;
    }
    setPassport(result.data.passportCode);
    setMessage(null);
  }

  if (passport) {
    return (
      <div role="status" className="rounded-3xl border-4 border-[#330043] bg-[#FFCD34] p-6 text-[#330043] shadow-[6px_6px_0_#330043]">
        <p className="font-heading text-3xl">Inscrição confirmada</p>
        <p className="mt-3 text-lg">
          Seu código é <strong className="font-heading text-2xl">{passport}</strong>. Guarda ele para o credenciamento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        step={stages.indexOf(current) + 1}
        total={stages.length}
        kicker={current === "voce" ? "Sobre você" : current === "perguntas" ? "Mais um pouco" : "Quase lá"}
        title={current === "voce" ? "Conte um pouco sobre quem você é" : current === "perguntas" ? "Responde rapidinho" : "Confere e envia"}
      />

      {current === "voce" ? (
        <fieldset className="flex flex-col gap-4">
          <p className="text-center text-sm text-[#8B7C99]">E-mail confirmado: <strong className="text-[#330043]">{email}</strong></p>
          <Field label={fixedFields[0].label} htmlFor="reg-name" error={errors.name} required>
            <Input id="reg-name" className={inscriptionInputClass} value={name} onChange={(item) => setName(item.target.value)} autoComplete="name" aria-invalid={errors.name ? true : undefined} />
          </Field>
          <Field label={fixedFields[2].label} htmlFor="reg-cpf" error={errors.cpf} required>
            <CpfField id="reg-cpf" value={cpf} onChange={setCpf} readOnly={accountCpf.length > 0} invalid={Boolean(errors.cpf)} />
          </Field>
          <Field label={fixedFields[3].label} htmlFor="reg-phone" error={errors.phone} required>
            <PhoneField id="reg-phone" value={phone} onChange={setPhone} invalid={Boolean(errors.phone)} />
          </Field>
          <Field label={fixedFields[4].label} htmlFor="reg-institution" error={errors.institution}>
            <Input id="reg-institution" className={inscriptionInputClass} value={institution} onChange={(item) => setInstitution(item.target.value)} aria-invalid={errors.institution ? true : undefined} />
          </Field>
        </fieldset>
      ) : null}

      {current === "perguntas" ? (
        <fieldset className="flex flex-col gap-4">
          {visible.map((field) => (
            <CustomField
              key={field.id}
              field={field}
              value={answers[field.id]}
              error={errors[`answers.${field.id}`]}
              onChange={(value) => setAnswers((currentAnswers) => ({ ...currentAnswers, [field.id]: value }))}
            />
          ))}
        </fieldset>
      ) : null}

      {current === "confirmar" ? (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-3 rounded-3xl bg-[#FFF6FB] p-4">
            <Review label="Nome" value={name} />
            <Review label="E-mail" value={email} />
            <Review label="CPF" value={cpf} />
            <Review label="Telefone" value={phone} />
            <Review label="Instituição" value={institution || "—"} />
            {visible.map((field) => (
              <Review key={field.id} label={field.label} value={showAnswer(field, answers[field.id])} />
            ))}
          </dl>
          {closed && !preview ? <p className="font-semibold">Inscrições encerradas.</p> : null}
        </div>
      ) : null}

      {message ? <p role="alert" className="text-sm font-semibold text-[#BE185D]">{message}</p> : null}
      {message === "Entre na sua conta para se inscrever." && slug ? (
        <Link href={`/entrar?callbackUrl=/e/${slug}/inscricao`} className="font-bold text-[#BE185D] underline">
          Entrar
        </Link>
      ) : null}

      <div className="flex flex-col gap-3">
        {current === "confirmar" ? (
          <GradientButton onClick={() => void submit()} disabled={pending || (closed && !preview)}>
            {pending ? "Enviando…" : preview ? "Testar validação" : "Enviar"}
          </GradientButton>
        ) : (
          <GradientButton onClick={() => void next()} disabled={pending}>Enviar</GradientButton>
        )}
        {stages.indexOf(current) > 0 || onBack ? (
          <button
            type="button"
            onClick={() => {
              setErrors({});
              if (stages.indexOf(current) === 0) onBack?.();
              else setStep((value) => Math.max(0, value - 1));
            }}
            className="h-11 text-sm text-[#A398AE]"
          >
            Voltar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function showAnswer(field: FormFieldConfig, value: string | boolean | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === undefined || value === "") return "—";
  const message = answerError(field, value);
  if (message && field.type === "NUMBER") return String(value);
  return String(value);
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-[#4C1D95]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CustomField({
  field,
  value,
  error,
  onChange,
}: {
  field: FormFieldConfig;
  value: string | boolean | string[] | undefined;
  error?: string;
  onChange: (value: string | boolean | string[]) => void;
}) {
  const id = `field-${field.id}`;
  if (field.type === "LONGTEXT") {
    return (
      <Field label={field.label} htmlFor={id} error={error} required={field.required}>
        <Textarea id={id} className="min-h-28 rounded-3xl border-0 bg-white px-5 py-4 text-base text-[#330043] shadow-[0_10px_28px_rgba(88,28,135,0.08)] ring-1 ring-[#F6E9FF] md:text-base" value={typeof value === "string" ? value : ""} onChange={(item) => onChange(item.target.value)} />
      </Field>
    );
  }
  if (field.type === "SELECT") {
    return (
      <Field label={field.label} htmlFor={id} error={error} required={field.required}>
        <select id={id} className={selectClass} value={typeof value === "string" ? value : ""} onChange={(item) => onChange(item.target.value)}>
          <option value="">Escolha</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.type === "CHECKBOX" && field.options.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-center gap-2 font-semibold" htmlFor={id}>
          <input id={id} type="checkbox" className="size-5 accent-[#BE185D]" checked={value === true} onChange={(item) => onChange(item.target.checked)} />
          {field.label}{field.required ? " *" : ""}
        </label>
        {error ? <p className="text-sm font-semibold text-[#BE185D]">{error}</p> : null}
      </div>
    );
  }
  if (field.type === "CHECKBOX") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">{field.label}{field.required ? " *" : ""}</legend>
        {field.options.map((option) => (
          <label key={option} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-[#BE185D]"
              checked={selected.includes(option)}
              onChange={(item) => {
                const next = item.target.checked
                  ? [...selected, option]
                  : selected.filter((current) => current !== option);
                onChange(next);
              }}
            />
            {option}
          </label>
        ))}
        {error ? <p className="text-sm font-semibold text-[#BE185D]">{error}</p> : null}
      </fieldset>
    );
  }
  return (
    <Field label={field.label} htmlFor={id} error={error} required={field.required}>
      <Input
        id={id}
        className={inscriptionInputClass}
        type={field.type === "NUMBER" ? "number" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(item) => onChange(item.target.value)}
      />
    </Field>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#330043]">
        {label}{required ? "*" : ""}:
      </label>
      {children}
      {error ? <p className="text-sm font-semibold text-[#BE185D]">{error}</p> : null}
    </div>
  );
}
