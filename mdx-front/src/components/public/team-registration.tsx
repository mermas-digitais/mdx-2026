"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { GradientButton, StepHeading } from "@/components/public/form-chrome";
import { CpfField, inscriptionInputClass, PhoneField, formatCpf } from "@/components/public/masked-fields";
import { cpfError } from "@/server/form-schema";
import { inscreverEquipe, type RoboticsTeam } from "@/server/events";

type Modality = {
  id: string;
  name: string;
  slotLimit: number;
  confirmed: number;
  waitlist: number;
};

type MemberDraft = {
  fullName: string;
  cpf: string;
  birthDate: string;
  document: File | null;
};

const emptyMember = (): MemberDraft => ({
  fullName: "",
  cpf: "",
  birthDate: "",
  document: null,
});

export function TeamRegistration({
  slug,
  modalities,
  closed,
  advisorName,
  advisorEmail,
  advisorCpf,
  prepareAccount,
  checkCpf,
  onBack,
  onRegistered,
}: {
  slug: string;
  modalities: Modality[];
  closed: boolean;
  advisorName: string;
  advisorEmail: string;
  advisorCpf: string;
  prepareAccount?: (name: string, cpf: string) => Promise<string | null>;
  checkCpf?: (cpf: string) => Promise<string | null>;
  onBack?: () => void;
  onRegistered: (team: RoboticsTeam) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(advisorName);
  const email = advisorEmail;
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState(() => formatCpf(advisorCpf));
  const [institution, setInstitution] = useState("");
  const [advisorDocument, setAdvisorDocument] = useState<File | null>(null);
  const [teamName, setTeamName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberDraft[]>([emptyMember(), emptyMember(), emptyMember()]);
  const [noticed, setNoticed] = useState(false);
  const [girls, setGirls] = useState(false);
  const [rules, setRules] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const stages = ["orientador", "equipe", "integrantes", "aceite", "revisar"] as const;
  const current = stages[step] ?? "orientador";

  useEffect(() => {
    document.getElementById("inscricao-card")?.scrollTo({ top: 0 });
  }, [step, noticed]);

  function updateMember(index: number, patch: Partial<MemberDraft>) {
    setMembers((currentMembers) =>
      currentMembers.map((member, memberIndex) => (memberIndex === index ? { ...member, ...patch } : member)),
    );
  }

  function localIssues(): Record<string, string> {
    const found: Record<string, string> = {};
    if (current === "orientador" || current === "revisar") {
      if (name.trim().length < 2) found.advisorName = "Informe o nome do orientador.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.advisorEmail = "Informe um e-mail válido.";
      const phoneDigits = phone.replace(/\D/g, "").length;
      if (phoneDigits !== 10 && phoneDigits !== 11) found.advisorPhone = "Informe o WhatsApp com DDD.";
      if (cpfError(cpf)) found.advisorCpf = "Informe um CPF válido.";
      if (institution.trim().length < 2) found.institution = "Informe a instituição de ensino.";
      if (!advisorDocument) found.advisorDocument = "Envie o documento de vínculo.";
    }
    if (current === "equipe" || current === "revisar") {
      if (teamName.trim().length < 2) found.teamName = "Informe o nome da equipe.";
      if (selected.length === 0) found.modalityIds = "Escolha ao menos uma modalidade.";
    }
    if (current === "integrantes" || current === "revisar") {
      if (members.length < 3 || members.length > 5) found.members = "A equipe precisa de 3 a 5 integrantes.";
      members.forEach((member, index) => {
        if (member.fullName.trim().length < 2) found[`members.${index}.fullName`] = "Informe o nome da integrante.";
        if (cpfError(member.cpf)) found[`members.${index}.cpf`] = "Informe um CPF válido.";
        if (!member.birthDate) found[`members.${index}.birthDate`] = "Informe a data de nascimento.";
        if (!member.document) found[`members.${index}.document`] = "Envie o documento de vínculo.";
      });
    }
    if (current === "aceite" || current === "revisar") {
      if (!girls) found.girlsDeclaration = "Confirme que as integrantes são meninas matriculadas.";
      if (!rules) found.rulesAccepted = "Aceite o regulamento para inscrever a equipe.";
    }
    return found;
  }

  async function next() {
    const found = localIssues();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    if (current === "orientador" && checkCpf) {
      setPending(true);
      const cpfMessage = await checkCpf(cpf);
      setPending(false);
      if (cpfMessage) {
        setErrors({ advisorCpf: cpfMessage });
        document.getElementById("advisor-cpf")?.scrollIntoView({ block: "center" });
        return;
      }
    }
    setErrors({});
    setStep((value) => Math.min(value + 1, stages.length - 1));
  }

  async function submit() {
    const found = localIssues();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    if (closed) {
      setMessage("As inscrições deste evento estão encerradas.");
      return;
    }
    setPending(true);
    if (prepareAccount) {
      const accountError = await prepareAccount(name, cpf);
      if (accountError) {
        setPending(false);
        if (/cpf/i.test(accountError)) {
          setStep(0);
          setErrors({ advisorCpf: accountError });
          setMessage(null);
          return;
        }
        setMessage(accountError);
        return;
      }
    }
    const body = new FormData();
    body.set(
      "payload",
      JSON.stringify({
        advisorName: name,
        advisorEmail: email,
        advisorPhone: phone,
        advisorCpf: cpf,
        institution,
        teamName,
        modalityIds: selected,
        members: members.map((member) => ({
          fullName: member.fullName,
          cpf: member.cpf,
          birthDate: member.birthDate,
        })),
        girlsDeclaration: girls,
        rulesAccepted: rules,
      }),
    );
    if (advisorDocument) body.set("advisorDocument", advisorDocument);
    members.forEach((member, index) => {
      if (member.document) body.set(`memberDocument${index}`, member.document);
    });
    const result = await inscreverEquipe(slug, body);
    setPending(false);
    if (!result.ok) {
      const fields = result.fields ?? {};
      setErrors(fields);
      const keys = Object.keys(fields);
      setMessage(keys.length > 0 ? null : result.message);
      if (keys.some((key) => key.startsWith("advisor") || key === "institution" || key === "advisorDocument")) setStep(0);
      else if (keys.some((key) => key.startsWith("team") || key.startsWith("modality"))) setStep(1);
      else if (keys.some((key) => key.startsWith("members"))) setStep(2);
      else if (keys.some((key) => key === "girlsDeclaration" || key === "rulesAccepted")) setStep(3);
      return;
    }
    onRegistered(result.data);
  }

  if (!noticed) {
    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!rules) {
            setErrors({ rulesAccepted: "Aceite o regulamento para continuar." });
            return;
          }
          setErrors({});
          setNoticed(true);
        }}
      >
        <div>
          <p className="text-sm font-bold tracking-widest text-[#FF4A97] uppercase">Atenção, mermã!</p>
          <h2 className="mt-2 font-heading text-3xl leading-tight text-[#330043]">Informações importantes antes de iniciar a inscrição</h2>
        </div>
        <ul className="list-disc pl-5 text-[#330043]">
          <li>Apenas o orientador da equipe deverá efetuar a inscrição e pode orientar uma ou mais equipes.</li>
        </ul>
        <label className="flex items-start gap-3 text-[#330043]">
          <input type="checkbox" className="mt-1 size-5 accent-[#FF4A97]" checked={rules} onChange={(item) => setRules(item.target.checked)} />
          <span>
            Concordo que li e aceito os termos do{" "}
            <a
              href="/marca/regulamento-robotica.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#2563EB] underline"
            >
              regulamento
            </a>{" "}
            de robótica.
          </span>
        </label>
        {errors.rulesAccepted ? <p className="text-sm font-semibold text-[#BE185D]">{errors.rulesAccepted}</p> : null}
        <GradientButton type="submit">Enviar</GradientButton>
        {onBack ? (
          <button type="button" onClick={onBack} className="h-11 text-sm text-[#A398AE]">
            Voltar
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        step={step + 1}
        total={stages.length}
        kicker={current === "orientador" ? "Orientador" : current === "equipe" ? "Equipe" : current === "integrantes" ? "Integrantes" : current === "aceite" ? "Aceite" : "Revisão"}
        title={current === "orientador" ? "Quem orienta a equipe" : current === "equipe" ? "Nome e modalidades" : current === "integrantes" ? "Quem compete" : current === "aceite" ? "Declarações" : "Confere e envia"}
      />

      {current === "orientador" ? (
        <fieldset className="flex flex-col gap-4">
          <p className="text-center text-sm text-[#8B7C99]">E-mail confirmado: <strong className="text-[#330043]">{email}</strong></p>
          <Field label="Nome completo" htmlFor="advisor-name" error={errors.advisorName} required>
            <Input id="advisor-name" className={inscriptionInputClass} value={name} onChange={(item) => setName(item.target.value)} autoComplete="name" aria-invalid={errors.advisorName ? true : undefined} />
          </Field>
          <Field label="WhatsApp" htmlFor="advisor-phone" error={errors.advisorPhone} required>
            <PhoneField id="advisor-phone" value={phone} onChange={setPhone} invalid={Boolean(errors.advisorPhone)} />
          </Field>
          <Field label="CPF" htmlFor="advisor-cpf" error={errors.advisorCpf} required>
            <CpfField id="advisor-cpf" value={cpf} onChange={setCpf} readOnly={advisorCpf.length > 0} invalid={Boolean(errors.advisorCpf)} />
          </Field>
          <Field label="Instituição de ensino" htmlFor="advisor-school" error={errors.institution} required>
            <Input id="advisor-school" className={inscriptionInputClass} value={institution} onChange={(item) => setInstitution(item.target.value)} aria-invalid={errors.institution ? true : undefined} />
          </Field>
          <Field label="Documento de vínculo" htmlFor="advisor-document" error={errors.advisorDocument} required>
            <FilePick id="advisor-document" file={advisorDocument} onPick={setAdvisorDocument} />
          </Field>
        </fieldset>
      ) : null}

      {current === "equipe" ? (
        <fieldset className="flex flex-col gap-4">
          <Field label="Nome da equipe" htmlFor="team-name" error={errors.teamName} required>
            <Input id="team-name" className={inscriptionInputClass} value={teamName} onChange={(item) => setTeamName(item.target.value)} aria-invalid={errors.teamName ? true : undefined} />
          </Field>
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Modalidades*:</p>
            {modalities.map((modality) => {
              const checked = selected.includes(modality.id);
              return (
                <label key={modality.id} className="flex min-h-14 items-center gap-3 rounded-2xl border-4 border-[#330043] bg-white px-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-[#BE185D]"
                    checked={checked}
                    onChange={(item) => {
                      setSelected((currentIds) =>
                        item.target.checked
                          ? [...currentIds, modality.id]
                          : currentIds.filter((id) => id !== modality.id),
                      );
                    }}
                  />
                  <span className="font-heading text-xl">{modality.name}</span>
                </label>
              );
            })}
            {errors.modalityIds ? <p className="text-sm font-semibold text-[#BE185D]">{errors.modalityIds}</p> : null}
          </div>
        </fieldset>
      ) : null}

      {current === "integrantes" ? (
        <fieldset className="flex flex-col gap-4">
          {errors.members ? <p className="text-sm font-semibold text-[#BE185D]">{errors.members}</p> : null}
          {members.map((member, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-3xl border-4 border-[#330043] p-4">
              <p className="font-heading text-xl">Integrante {index + 1}</p>
              <Field label="Nome completo" htmlFor={`member-name-${index}`} error={errors[`members.${index}.fullName`]} required>
                <Input id={`member-name-${index}`} className={inscriptionInputClass} value={member.fullName} onChange={(item) => updateMember(index, { fullName: item.target.value })} aria-invalid={errors[`members.${index}.fullName`] ? true : undefined} />
              </Field>
              <Field label="CPF" htmlFor={`member-cpf-${index}`} error={errors[`members.${index}.cpf`]} required>
                <CpfField id={`member-cpf-${index}`} value={member.cpf} onChange={(value) => updateMember(index, { cpf: value })} invalid={Boolean(errors[`members.${index}.cpf`])} />
              </Field>
              <Field label="Data de nascimento" htmlFor={`member-birth-${index}`} error={errors[`members.${index}.birthDate`]} required>
                <Input id={`member-birth-${index}`} className={inscriptionInputClass} type="date" value={member.birthDate} onChange={(item) => updateMember(index, { birthDate: item.target.value })} aria-invalid={errors[`members.${index}.birthDate`] ? true : undefined} />
              </Field>
              <Field label="Documento de vínculo" htmlFor={`member-doc-${index}`} error={errors[`members.${index}.document`]} required>
                <FilePick id={`member-doc-${index}`} file={member.document} onPick={(file) => updateMember(index, { document: file })} />
              </Field>
            </div>
          ))}
          <div className="flex gap-3">
            {members.length < 5 ? (
              <button type="button" className="font-bold text-[#BE185D] underline" onClick={() => setMembers((currentMembers) => [...currentMembers, emptyMember()])}>
                Adicionar integrante
              </button>
            ) : null}
            {members.length > 3 ? (
              <button type="button" className="font-bold text-[#4C1D95] underline" onClick={() => setMembers((currentMembers) => currentMembers.slice(0, -1))}>
                Remover a última
              </button>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {current === "aceite" ? (
        <fieldset className="flex flex-col gap-4">
          <label className="flex items-start gap-2 font-semibold">
            <input type="checkbox" className="mt-1 size-5 accent-[#BE185D]" checked={girls} onChange={(item) => setGirls(item.target.checked)} />
            Declaro que as integrantes são meninas matriculadas no Ensino Médio ou nos anos finais do Ensino Fundamental.
          </label>
          {errors.girlsDeclaration ? <p className="text-sm font-semibold text-[#BE185D]">{errors.girlsDeclaration}</p> : null}
          <label className="flex items-start gap-2 font-semibold">
            <input type="checkbox" className="mt-1 size-5 accent-[#BE185D]" checked={rules} onChange={(item) => setRules(item.target.checked)} />
            Aceito o regulamento da competição MDX STEAM.
          </label>
          {errors.rulesAccepted ? <p className="text-sm font-semibold text-[#BE185D]">{errors.rulesAccepted}</p> : null}
        </fieldset>
      ) : null}

      {current === "revisar" ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-3xl">Confere e envia</h2>
          <dl className="grid gap-3 rounded-3xl border-4 border-[#330043] bg-[#FFF6FB] p-4">
            <Review label="Orientador" value={`${name} · ${email} · ${phone}`} />
            <Review label="Instituição" value={institution} />
            <Review label="Equipe" value={teamName} />
            <Review
              label="Modalidades"
              value={modalities.filter((modality) => selected.includes(modality.id)).map((modality) => modality.name).join(", ")}
            />
            <Review
              label="Integrantes"
              value={members.map((member) => member.fullName).filter(Boolean).join(", ")}
            />
          </dl>
          {Object.values(errors).length > 0 ? (
            <p role="alert" className="text-sm font-semibold text-[#BE185D]">{Object.values(errors)[0]}</p>
          ) : null}
        </div>
      ) : null}

      {message ? <p role="alert" className="text-sm font-semibold text-[#BE185D]">{message}</p> : null}
      <div className="flex flex-col gap-3">
        {current === "revisar" ? (
          <GradientButton onClick={() => void submit()} disabled={pending || closed}>
            {pending ? "Enviando…" : "Enviar"}
          </GradientButton>
        ) : (
          <GradientButton onClick={() => void next()} disabled={pending}>Enviar</GradientButton>
        )}
        <button
          type="button"
          onClick={() => {
            setErrors({});
            if (step === 0) setNoticed(false);
            else setStep((value) => Math.max(0, value - 1));
          }}
          className="h-11 text-sm text-[#A398AE]"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

function FilePick({
  id,
  file,
  onPick,
}: {
  id: string;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 border-dashed border-[#330043] bg-[#FFF6FB] px-4 py-4">
      <span className="font-semibold">{file ? file.name : "Escolher arquivo"}</span>
      <input
        id={id}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(item) => onPick(item.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-[#4C1D95]">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
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
