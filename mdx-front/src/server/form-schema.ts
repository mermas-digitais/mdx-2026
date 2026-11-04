import { z } from "zod";

export const fieldTypes = ["TEXT", "LONGTEXT", "SELECT", "CHECKBOX", "NUMBER"] as const;
export type FieldType = (typeof fieldTypes)[number];

export const registrationCategories = ["VISITOR", "SCHOOL", "COMPETITOR", "STAFF"] as const;
export type RegistrationCategory = (typeof registrationCategories)[number];

export const fixedFields = [
  { key: "name", label: "Nome", help: "O nome que aparece na credencial." },
  { key: "email", label: "E-mail", help: "Usamos para confirmar a inscrição." },
  { key: "cpf", label: "CPF", help: "Obrigatório. É o dado que junta sua conta com uma equipe." },
  { key: "phone", label: "Telefone", help: "Com DDD, para aviso de mudança." },
  { key: "institution", label: "Instituição", help: "Opcional para quem só participa do evento." },
  { key: "category", label: "Categoria", help: "Algumas perguntas só aparecem para uma categoria." },
] as const;

export function cpfDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function cpfError(value: string): string | null {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return "Informe um CPF válido.";
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  if (check(9) !== Number(digits[9]) || check(10) !== Number(digits[10])) {
    return "Informe um CPF válido.";
  }
  return null;
}

export function cpfFromSeed(seed: number): string {
  let nine = String(Math.abs(Math.trunc(seed)) % 1_000_000_000).padStart(9, "0");
  if (/^(\d)\1{8}$/.test(nine)) nine = `${nine.slice(0, 8)}${(Number(nine[8]) + 1) % 10}`;
  const digits = nine.split("").map(Number);
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += digits[index] * (length + 1 - index);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  digits.push(check(9));
  digits.push(check(10));
  return digits.join("");
}

export type FormFieldConfig = {
  id: string;
  label: string;
  help: string;
  type: FieldType;
  required: boolean;
  options: string[];
  categories: RegistrationCategory[];
  displayOrder: number;
};

const optionSchema = z
  .string()
  .trim()
  .min(1, "A opção não pode ficar vazia.")
  .max(80, "A opção pode ter no máximo 80 caracteres.");

export const formFieldSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(2, "Informe o rótulo do campo.")
      .max(120, "O rótulo pode ter no máximo 120 caracteres."),
    help: z.string().trim().max(240, "A ajuda pode ter no máximo 240 caracteres.").optional(),
    type: z.enum(fieldTypes, "Escolha o tipo do campo."),
    required: z.boolean().optional(),
    options: z.array(optionSchema).max(20, "Use no máximo 20 opções.").optional(),
    categories: z.array(z.enum(registrationCategories)).max(4).optional(),
  })
  .superRefine((value, ctx) => {
    const options = value.options ?? [];
    if (value.type === "SELECT" && options.length < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Informe ao menos uma opção.",
      });
    }
  });

export const formFieldPatchSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  help: z.string().trim().max(240).optional(),
  type: z.enum(fieldTypes).optional(),
  required: z.boolean().optional(),
  options: z.array(optionSchema).max(20).optional(),
  categories: z.array(z.enum(registrationCategories)).max(4).optional(),
});

export const reorderSchema = z.object({
  ids: z
    .array(
      z.string().regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "Campo inválido.",
      ),
    )
    .min(1, "Informe a ordem dos campos."),
});

export const competitorQuestions = [
  {
    label: "Nome da equipe",
    help: "Como a equipe aparece na chave.",
    type: "TEXT" as const,
    required: true,
  },
  {
    label: "Prova",
    help: "A competição em que a equipe entra.",
    type: "SELECT" as const,
    required: true,
  },
  {
    label: "Número de integrantes",
    help: "Quantas pessoas estão na equipe.",
    type: "NUMBER" as const,
    required: true,
  },
];

export function fieldApplies(field: FormFieldConfig, category: RegistrationCategory): boolean {
  return field.categories.length === 0 || field.categories.includes(category);
}

export function registrationSchema(fields: FormFieldConfig[]) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Informe o nome.")
        .max(80, "O nome pode ter no máximo 80 caracteres."),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Informe um e-mail válido."),
      cpf: z.string().trim().refine((value) => cpfError(value) === null, "Informe um CPF válido."),
      phone: z
        .string()
        .trim()
        .max(20, "O telefone pode ter no máximo 20 caracteres.")
        .refine((value) => {
          const digits = value.replace(/\D/g, "").length;
          return digits === 10 || digits === 11;
        }, "Informe o telefone com DDD."),
      institution: z
        .string()
        .trim()
        .max(120, "A instituição pode ter no máximo 120 caracteres.")
        .refine(
          (value) => value.length === 0 || value.length >= 2,
          "Informe a instituição ou deixe em branco.",
        ),
      category: z.enum(registrationCategories, "Escolha a categoria."),
      answers: z.record(z.string(), z.unknown()).optional(),
    })
    .superRefine((value, ctx) => {
      const answers = value.answers ?? {};
      for (const field of fields) {
        if (!fieldApplies(field, value.category)) continue;
        const message = answerError(field, answers[field.id]);
        if (!message) continue;
        ctx.addIssue({
          code: "custom",
          path: ["answers", field.id],
          message,
        });
      }
    });
}

export function answerError(field: FormFieldConfig, value: unknown): string | null {
  if (field.type === "CHECKBOX" && field.options.length === 0) {
    if (field.required && value !== true) return "Marque esta opção.";
    if (value !== undefined && value !== null && value !== "" && value !== true && value !== false) {
      return "Marque ou deixe em branco.";
    }
    return null;
  }
  if (field.type === "CHECKBOX") {
    if (value === undefined || value === null || value === "") {
      return field.required ? "Escolha ao menos uma opção." : null;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !field.options.includes(item))) {
      return "Escolha as opções da lista.";
    }
    if (field.required && value.length === 0) return "Escolha ao menos uma opção.";
    return null;
  }
  if (field.type === "SELECT") {
    if (value === undefined || value === null || value === "") {
      return field.required ? "Escolha uma opção." : null;
    }
    if (typeof value !== "string" || !field.options.includes(value)) return "Escolha uma opção da lista.";
    return null;
  }
  if (field.type === "NUMBER") {
    if (value === undefined || value === null || value === "") {
      return field.required ? "Informe um número." : null;
    }
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return "Informe um número.";
    return null;
  }
  if (typeof value !== "string") {
    return field.required ? "Preencha este campo." : null;
  }
  const text = value.trim();
  if (!text) return field.required ? "Preencha este campo." : null;
  if (field.type === "TEXT" && text.length > 160) return "Use no máximo 160 caracteres.";
  if (text.length > 2000) return "Use no máximo 2000 caracteres.";
  return null;
}

export function formIssues(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function storedAnswers(
  fields: FormFieldConfig[],
  input: {
    name: string;
    email: string;
    phone: string;
    institution: string;
    category: RegistrationCategory;
    answers?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const answers: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    institution: input.institution,
  };
  for (const field of fields) {
    if (!fieldApplies(field, input.category)) continue;
    const value = input.answers?.[field.id];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "NUMBER") {
      answers[field.id] = typeof value === "number" ? value : Number(value);
      continue;
    }
    if (field.type === "TEXT" || field.type === "LONGTEXT") {
      answers[field.id] = typeof value === "string" ? value.trim() : value;
      continue;
    }
    answers[field.id] = value;
  }
  return answers;
}
