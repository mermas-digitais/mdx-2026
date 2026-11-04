"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { CpfField, PhoneField } from "@/components/public/masked-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fieldApplies,
  fixedFields,
  formIssues,
  registrationCategories,
  registrationSchema,
  type FormFieldConfig,
  type RegistrationCategory,
} from "@/server/form-schema";
import { inscrever } from "@/server/events";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export const categoryLabel: Record<RegistrationCategory, string> = {
  VISITOR: "Visitante",
  SCHOOL: "Escola",
  COMPETITOR: "Competidora",
  STAFF: "Equipe",
};

export function RegistrationForm({
  fields,
  slug,
  preview = false,
  closed = false,
  defaultName = "",
  defaultEmail = "",
  buttonStyle,
}: {
  fields: FormFieldConfig[];
  slug?: string;
  preview?: boolean;
  closed?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  buttonStyle?: CSSProperties;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [category, setCategory] = useState<RegistrationCategory>("VISITOR");
  const [answers, setAnswers] = useState<Record<string, string | boolean | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [passport, setPassport] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = useMemo(
    () => fields.filter((field) => fieldApplies(field, category)),
    [fields, category],
  );

  function setAnswer(id: string, value: string | boolean | string[]) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const payload = {
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
    const parsed = registrationSchema(fields).safeParse(payload);
    if (!parsed.success) {
      setErrors(formIssues(parsed.error));
      setMessage(null);
      return;
    }
    setErrors({});
    if (preview || !slug) {
      setMessage("Pré-visualização válida. Nada foi enviado.");
      return;
    }
    if (closed) {
      setMessage("As inscrições deste evento estão encerradas.");
      return;
    }
    setPending(true);
    const result = await inscrever(slug, parsed.data);
    setPending(false);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      setMessage(result.message);
      return;
    }
    setPassport(result.data.passportCode);
    setMessage(null);
  }

  if (passport) {
    return (
      <p role="status" className="rounded-xl bg-brand-lilac px-4 py-4 text-brand-ink">
        Inscrição confirmada. Seu código é <strong>{passport}</strong>.
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(formEvent) => void submit(formEvent)}>
      <Field label={fixedFields[0].label} htmlFor="reg-name" hint={fixedFields[0].help} error={errors.name} required>
        <Input id="reg-name" value={name} onChange={(item) => setName(item.target.value)} required />
      </Field>
      <Field label={fixedFields[1].label} htmlFor="reg-email" hint={fixedFields[1].help} error={errors.email} required>
        <Input id="reg-email" type="email" value={email} onChange={(item) => setEmail(item.target.value)} required />
      </Field>
      <Field label={fixedFields[2].label} htmlFor="reg-cpf" hint={fixedFields[2].help} error={errors.cpf} required>
        <CpfField id="reg-cpf" value={cpf} onChange={setCpf} invalid={Boolean(errors.cpf)} className="h-11 rounded-lg border border-input px-3 md:text-sm" />
      </Field>
      <Field label={fixedFields[3].label} htmlFor="reg-phone" hint={fixedFields[3].help} error={errors.phone} required>
        <PhoneField id="reg-phone" value={phone} onChange={setPhone} invalid={Boolean(errors.phone)} className="h-11 rounded-lg border border-input px-3 md:text-sm" />
      </Field>
      <Field label={fixedFields[4].label} htmlFor="reg-institution" hint={fixedFields[4].help} error={errors.institution}>
        <Input id="reg-institution" value={institution} onChange={(item) => setInstitution(item.target.value)} />
      </Field>
      <Field label={fixedFields[5].label} htmlFor="reg-category" hint={fixedFields[5].help} error={errors.category} required>
        <select
          id="reg-category"
          className={selectClass}
          value={category}
          onChange={(item) => setCategory(item.target.value as RegistrationCategory)}
        >
          {registrationCategories.map((item) => (
            <option key={item} value={item}>{categoryLabel[item]}</option>
          ))}
        </select>
      </Field>
      {visible.map((field) => (
        <CustomField
          key={field.id}
          field={field}
          value={answers[field.id]}
          error={errors[`answers.${field.id}`]}
          onChange={(value) => setAnswer(field.id, value)}
        />
      ))}
      {message ? <p role="alert" className="text-sm text-brand-pink-dark">{message}</p> : null}
      {message === "Entre na sua conta para se inscrever." && slug ? (
        <Link href={`/entrar?callbackUrl=/e/${slug}`} className="text-sm text-brand-pink-dark underline">
          Entrar
        </Link>
      ) : null}
      <Button type="submit" disabled={pending || closed} style={buttonStyle}>
        {preview ? "Testar validação" : "Enviar inscrição"}
      </Button>
    </form>
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
      <Field label={field.label} htmlFor={id} hint={field.help} error={error} required={field.required}>
        <Textarea id={id} value={typeof value === "string" ? value : ""} onChange={(item) => onChange(item.target.value)} />
      </Field>
    );
  }
  if (field.type === "SELECT") {
    return (
      <Field label={field.label} htmlFor={id} hint={field.help} error={error} required={field.required}>
        <select
          id={id}
          className={selectClass}
          value={typeof value === "string" ? value : ""}
          onChange={(item) => onChange(item.target.value)}
        >
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
        <label className="flex items-center gap-2 text-sm" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            className="size-4 accent-[#EC4899]"
            checked={value === true}
            onChange={(item) => onChange(item.target.checked)}
          />
          {field.label}{field.required ? " *" : ""}
        </label>
        {field.help ? <p className="text-sm text-brand-purple">{field.help}</p> : null}
        {error ? <p className="text-sm text-brand-pink-dark">{error}</p> : null}
      </div>
    );
  }
  if (field.type === "CHECKBOX") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</legend>
        {field.help ? <p className="text-sm text-brand-purple">{field.help}</p> : null}
        {field.options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[#EC4899]"
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
        {error ? <p className="text-sm text-brand-pink-dark">{error}</p> : null}
      </fieldset>
    );
  }
  return (
    <Field label={field.label} htmlFor={id} hint={field.help} error={error} required={field.required}>
      <Input
        id={id}
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
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}{required ? " *" : ""}
      </label>
      {children}
      {hint ? <p className="text-sm text-brand-purple">{hint}</p> : null}
      {error ? <p className="text-sm text-brand-pink-dark">{error}</p> : null}
    </div>
  );
}
