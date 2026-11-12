import { z } from "zod";
import { cpfDigits, cpfError } from "./form-schema.js";

const uuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  "Escolha uma modalidade válida.",
);

export const roboticsTeamSchema = z
  .object({
    advisorName: z.string().trim().min(2, "Informe o nome do orientador.").max(80),
    advisorEmail: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Informe um e-mail válido."),
    advisorPhone: z.string().trim().min(8, "Informe o WhatsApp com DDD.").max(20),
    advisorCpf: z.string().trim().optional(),
    institution: z
      .string()
      .trim()
      .min(2, "Informe a instituição de ensino.")
      .max(120, "A instituição pode ter no máximo 120 caracteres."),
    teamName: z
      .string()
      .trim()
      .min(2, "Informe o nome da equipe.")
      .max(80, "O nome da equipe pode ter no máximo 80 caracteres."),
    modalityIds: z.array(uuid).min(1, "Escolha ao menos uma modalidade.").max(3),
    members: z
      .array(
        z.object({
          fullName: z.string().trim().min(2, "Informe o nome da integrante.").max(80),
          cpf: z.string().trim(),
          birthDate: z.string().trim(),
        }),
      )
      .min(3, "A equipe precisa de 3 a 5 integrantes.")
      .max(5, "A equipe precisa de 3 a 5 integrantes."),
    girlsDeclaration: z.boolean(),
    rulesAccepted: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.girlsDeclaration !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["girlsDeclaration"],
        message: "Confirme que as integrantes são meninas matriculadas.",
      });
    }
    if (value.rulesAccepted !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["rulesAccepted"],
        message: "Aceite o regulamento para inscrever a equipe.",
      });
    }
    const modalities = new Set<string>();
    value.modalityIds.forEach((id, index) => {
      if (modalities.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["modalityIds", index],
          message: "Escolha cada modalidade uma vez.",
        });
      }
      modalities.add(id);
    });

    const cpfs = new Set<string>();
    value.members.forEach((member, index) => {
      const message = cpfError(member.cpf);
      if (message) {
        ctx.addIssue({ code: "custom", path: ["members", index, "cpf"], message });
      } else {
        const digits = cpfDigits(member.cpf);
        if (cpfs.has(digits)) {
          ctx.addIssue({
            code: "custom",
            path: ["members", index, "cpf"],
            message: "Cada estudante só pode estar uma vez na equipe.",
          });
        }
        cpfs.add(digits);
      }
      const birth = birthDateError(member.birthDate);
      if (birth) {
        ctx.addIssue({ code: "custom", path: ["members", index, "birthDate"], message: birth });
      }
    });

    if (value.advisorCpf && cpfError(value.advisorCpf)) {
      ctx.addIssue({ code: "custom", path: ["advisorCpf"], message: "Informe um CPF válido." });
    }
  });

export type RoboticsTeamInput = z.infer<typeof roboticsTeamSchema>;

export const roboticsTeamUpdateSchema = z
  .object({
    teamName: z
      .string()
      .trim()
      .min(2, "Informe o nome da equipe.")
      .max(80, "O nome da equipe pode ter no máximo 80 caracteres."),
    advisorName: z.string().trim().min(2, "Informe o nome do orientador.").max(80),
    advisorPhone: z.string().trim().min(8, "Informe o WhatsApp com DDD.").max(20),
    advisorCpf: z.string().trim(),
    institution: z
      .string()
      .trim()
      .min(2, "Informe a instituição de ensino.")
      .max(120, "A instituição pode ter no máximo 120 caracteres."),
    members: z
      .array(
        z.object({
          id: uuid,
          fullName: z.string().trim().min(2, "Informe o nome da integrante.").max(80),
          cpf: z.string().trim(),
          birthDate: z.string().trim(),
        }),
      )
      .min(3, "A equipe precisa de 3 a 5 integrantes.")
      .max(5, "A equipe precisa de 3 a 5 integrantes."),
  })
  .superRefine((value, ctx) => {
    const phoneDigits = value.advisorPhone.replace(/\D/g, "").length;
    if (phoneDigits !== 10 && phoneDigits !== 11) {
      ctx.addIssue({ code: "custom", path: ["advisorPhone"], message: "Informe o WhatsApp com DDD." });
    }
    if (cpfError(value.advisorCpf)) {
      ctx.addIssue({ code: "custom", path: ["advisorCpf"], message: "Informe um CPF válido." });
    }
    const advisorDigits = cpfDigits(value.advisorCpf);
    const cpfs = new Set<string>();
    value.members.forEach((member, index) => {
      const message = cpfError(member.cpf);
      if (message) {
        ctx.addIssue({ code: "custom", path: ["members", index, "cpf"], message });
        return;
      }
      const digits = cpfDigits(member.cpf);
      if (digits === advisorDigits) {
        ctx.addIssue({
          code: "custom",
          path: ["members", index, "cpf"],
          message: "O CPF do orientador não entra como integrante.",
        });
      }
      if (cpfs.has(digits)) {
        ctx.addIssue({
          code: "custom",
          path: ["members", index, "cpf"],
          message: "Cada estudante só pode estar uma vez na equipe.",
        });
      }
      cpfs.add(digits);
      const birth = birthDateError(member.birthDate);
      if (birth) {
        ctx.addIssue({ code: "custom", path: ["members", index, "birthDate"], message: birth });
      }
    });
  });

export type RoboticsTeamUpdate = z.infer<typeof roboticsTeamUpdateSchema>;

export const roboticsAdminUpdateSchema = z
  .object({
    teamName: z
      .string()
      .trim()
      .min(2, "Informe o nome da equipe.")
      .max(80, "O nome da equipe pode ter no máximo 80 caracteres."),
    advisorName: z.string().trim().min(2, "Informe o nome do orientador.").max(80),
    advisorEmail: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Informe um e-mail válido."),
    advisorPhone: z.string().trim().min(8, "Informe o WhatsApp com DDD.").max(20),
    advisorCpf: z.string().trim(),
    institution: z
      .string()
      .trim()
      .min(2, "Informe a instituição de ensino.")
      .max(120, "A instituição pode ter no máximo 120 caracteres."),
    members: z
      .array(
        z.object({
          id: uuid,
          fullName: z.string().trim().min(2, "Informe o nome da integrante.").max(80),
          cpf: z.string().trim(),
          birthDate: z.string().trim(),
        }),
      )
      .max(5, "A equipe precisa de 3 a 5 integrantes."),
  })
  .superRefine((value, ctx) => {
    const phoneDigits = value.advisorPhone.replace(/\D/g, "").length;
    if (phoneDigits !== 10 && phoneDigits !== 11) {
      ctx.addIssue({ code: "custom", path: ["advisorPhone"], message: "Informe o WhatsApp com DDD." });
    }
    if (cpfError(value.advisorCpf)) {
      ctx.addIssue({ code: "custom", path: ["advisorCpf"], message: "Informe um CPF válido." });
    }
    const advisorDigits = cpfDigits(value.advisorCpf);
    const cpfs = new Set<string>();
    value.members.forEach((member, index) => {
      const message = cpfError(member.cpf);
      if (message) {
        ctx.addIssue({ code: "custom", path: ["members", index, "cpf"], message });
        return;
      }
      const digits = cpfDigits(member.cpf);
      if (digits === advisorDigits) {
        ctx.addIssue({
          code: "custom",
          path: ["members", index, "cpf"],
          message: "O CPF do orientador não entra como integrante.",
        });
      }
      if (cpfs.has(digits)) {
        ctx.addIssue({
          code: "custom",
          path: ["members", index, "cpf"],
          message: "Cada estudante só pode estar uma vez na equipe.",
        });
      }
      cpfs.add(digits);
      const birth = birthDateError(member.birthDate);
      if (birth) {
        ctx.addIssue({ code: "custom", path: ["members", index, "birthDate"], message: birth });
      }
    });
  });

export type RoboticsAdminUpdate = z.infer<typeof roboticsAdminUpdateSchema>;

export function birthDateError(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Informe a data de nascimento.";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "Informe uma data válida.";
  }
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() > today) return "A data de nascimento não pode ser no futuro.";
  if (year < 1990) return "Confira a data de nascimento.";
  return null;
}
