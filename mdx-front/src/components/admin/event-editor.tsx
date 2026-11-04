"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/brand/page-header";
import {
  bannerSrc,
  formatWhen,
  fromLocalInput,
  roleLabel,
  statusLabel,
  toLocalInput,
} from "@/components/admin/event-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  dateOrderMessage,
  eventCreateSchema,
  eventPatchSchema,
  slugify,
  teamRoles,
  zodFields,
  type TeamRole,
} from "@/server/event-schema";
import {
  atualizarPapel,
  convidarPessoa,
  criarEvento,
  criarLocal,
  enviarBanner,
  obterEvento,
  publicarEvento,
  removerLocal,
  removerPessoa,
  salvarEvento,
  type AdminEventDetail,
  type EventInput,
} from "@/server/events";

const steps = [
  ["basico", "Dados"],
  ["quando", "Data e local"],
  ["aparencia", "Banner e cores"],
  ["revisao", "Revisão"],
  ["locais", "Locais"],
  ["equipe", "Equipe"],
  ["atividades", "Atividades"],
  ["formulario", "Formulário"],
  ["equipes", "Equipes"],
] as const;

type Step = (typeof steps)[number][0];

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = eventCreateSchema.safeParse({ title, slug, theme, description });
    if (!parsed.success) {
      setFields(zodFields(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    const result = await criarEvento(parsed.data);
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      setError(result.message);
      return;
    }
    router.push(`/admin/eventos/${result.data.id}?etapa=quando`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <PageHeader
        title="Novo evento"
        description="O rascunho começa pelos dados básicos. Data, visual e revisão vêm em seguida."
      />
      <Card className="shadow-md">
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <Field label="Título" error={fields.title} htmlFor="title">
              <Input
                id="title"
                value={title}
                required
                onChange={(event) => {
                  const value = event.target.value;
                  setTitle(value);
                  if (!slugManual) setSlug(slugify(value));
                }}
              />
            </Field>
            <Field
              label="Endereço"
              error={fields.slug}
              htmlFor="slug"
              hint={slug ? `A página pública fica em /e/${slug}` : "Gerado a partir do título."}
            >
              <Input
                id="slug"
                value={slug}
                required
                onChange={(event) => {
                  setSlugManual(true);
                  setSlug(event.target.value);
                }}
              />
            </Field>
            <Field label="Tema" error={fields.theme} htmlFor="theme">
              <Input id="theme" value={theme} onChange={(event) => setTheme(event.target.value)} />
            </Field>
            <Field label="Descrição" error={fields.description} htmlFor="description">
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            {error ? <p role="alert" className="text-sm text-brand-pink-dark">{error}</p> : null}
            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Criando…" : "Continuar"}
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/admin/eventos" />}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export function EventEditorRoute() {
  const params = useParams<{ eventId: string }>();
  if (!params.eventId) return <p className="px-4 py-10">Carregando o evento…</p>;
  return <EventEditor eventId={params.eventId} />;
}

export function EventEditor({ eventId }: { eventId: string }) {
  const params = useSearchParams();
  const initial = steps.some(([id]) => id === params.get("etapa"))
    ? (params.get("etapa") as Step)
    : "basico";
  const [step, setStep] = useState<Step>(initial);
  const [event, setEvent] = useState<AdminEventDetail | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [address, setAddress] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [colorPrimary, setColorPrimary] = useState("#EC4899");
  const [colorSecondary, setColorSecondary] = useState("#4C1D95");
  const [colorAccent, setColorAccent] = useState("#7C3AED");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [ready, setReady] = useState(false);
  const skipSave = useRef(true);

  function apply(detail: AdminEventDetail) {
    setEvent(detail);
    setTitle(detail.title);
    setSlug(detail.slug);
    setTheme(detail.theme);
    setDescription(detail.description);
    setPlace(detail.place);
    setAddress(detail.address);
    setStartsAt(toLocalInput(detail.startsAt));
    setEndsAt(toLocalInput(detail.endsAt));
    setColorPrimary(detail.colorPrimary ?? "#EC4899");
    setColorSecondary(detail.colorSecondary ?? "#4C1D95");
    setColorAccent(detail.colorAccent ?? "#7C3AED");
  }

  useEffect(() => {
    let cancelled = false;
    void obterEvento(eventId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      apply(result.data);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function payload(): EventInput {
    return {
      title,
      slug,
      theme,
      description,
      place,
      address,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      colorPrimary,
      colorSecondary,
      colorAccent,
    };
  }

  async function persist(force: boolean) {
    const body = payload();
    const parsed = eventPatchSchema.safeParse(body);
    if (!parsed.success) {
      if (force) setFields(zodFields(parsed.error));
      return false;
    }
    const order = dateOrderMessage(parsed.data.startsAt, parsed.data.endsAt);
    if (order) {
      if (force) setFields({ endsAt: order });
      return false;
    }
    setSaveState("saving");
    const result = await salvarEvento(eventId, parsed.data);
    if (!result.ok) {
      setSaveState("idle");
      setError(result.message);
      setFields(result.fields ?? {});
      return false;
    }
    setEvent(result.data);
    setFields({});
    setError(null);
    setSaveState("saved");
    return true;
  }

  useEffect(() => {
    if (!ready || event?.status !== "DRAFT") return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void persist(false);
    }, 800);
    return () => clearTimeout(timer);
    // persist lê o estado deste render; incluí-la recriaria o efeito a cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    event?.status,
    title,
    slug,
    theme,
    description,
    place,
    address,
    startsAt,
    endsAt,
    colorPrimary,
    colorSecondary,
    colorAccent,
  ]);

  async function go(next: Step) {
    const ok = await persist(true);
    if (!ok) return;
    setStep(next);
  }

  async function publish() {
    const ok = await persist(true);
    if (!ok) return;
    const result = await publicarEvento(eventId);
    if (!result.ok) {
      setError(result.blockers?.join(" ") || result.message);
      return;
    }
    apply(result.data);
    setError(null);
  }

  if (!event && error) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
        <p role="alert" className="text-brand-pink-dark">{error}</p>
        <Link href="/admin/eventos" className="text-brand-pink-dark underline-offset-4 hover:underline">
          Voltar aos eventos
        </Link>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p>Carregando o evento…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <PageHeader
        title={title || "Evento"}
        description="As mesmas etapas do cadastro. No rascunho, as alterações se salvam sozinhas."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={event.status === "PUBLISHED" ? "default" : "outline"}>
          {statusLabel[event.status]}
        </Badge>
        <p className="text-sm text-brand-purple" aria-live="polite">
          {saveState === "saving" ? "Salvando…" : null}
          {saveState === "saved"
            ? event.status === "DRAFT"
              ? "Rascunho salvo."
              : "Alterações salvas."
            : null}
        </p>
      </div>
      <nav aria-label="Etapas" className="flex flex-wrap gap-2">
        {steps.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={step === id ? "secondary" : "outline"}
            aria-current={step === id ? "step" : undefined}
            onClick={() => void go(id)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <Card className="shadow-md">
        <CardContent className="flex flex-col gap-4">
          {error ? <p role="alert" className="text-sm text-brand-pink-dark">{error}</p> : null}
          {step === "basico" ? (
            <>
              <Field label="Título" htmlFor="title" error={fields.title}>
                <Input id="title" value={title} onChange={(item) => setTitle(item.target.value)} />
              </Field>
              <Field label="Endereço" htmlFor="slug" error={fields.slug} hint={`Página pública: /e/${slug}`}>
                <Input id="slug" value={slug} onChange={(item) => setSlug(item.target.value)} />
              </Field>
              <Field label="Tema" htmlFor="theme" error={fields.theme}>
                <Input id="theme" value={theme} onChange={(item) => setTheme(item.target.value)} />
              </Field>
              <Field label="Descrição" htmlFor="description" error={fields.description}>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(item) => setDescription(item.target.value)}
                />
              </Field>
            </>
          ) : null}
          {step === "quando" ? (
            <>
              <Field label="Início" htmlFor="startsAt" error={fields.startsAt}>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(item) => setStartsAt(item.target.value)}
                />
              </Field>
              <Field label="Fim" htmlFor="endsAt" error={fields.endsAt}>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(item) => setEndsAt(item.target.value)}
                />
              </Field>
              <Field label="Local" htmlFor="place" error={fields.place}>
                <Input id="place" value={place} onChange={(item) => setPlace(item.target.value)} />
              </Field>
              <Field label="Endereço do local" htmlFor="address" error={fields.address}>
                <Input id="address" value={address} onChange={(item) => setAddress(item.target.value)} />
              </Field>
            </>
          ) : null}
          {step === "aparencia" ? (
            <Appearance
              eventId={eventId}
              banner={event.banner}
              colorPrimary={colorPrimary}
              colorSecondary={colorSecondary}
              colorAccent={colorAccent}
              onColor={(key, value) => {
                if (key === "colorPrimary") setColorPrimary(value);
                if (key === "colorSecondary") setColorSecondary(value);
                if (key === "colorAccent") setColorAccent(value);
              }}
              onUploaded={(detail) => {
                apply(detail);
                skipSave.current = true;
              }}
            />
          ) : null}
          {step === "revisao" ? (
            <Review event={event} onPublish={() => void publish()} />
          ) : null}
          {step === "locais" ? <Places event={event} onChange={apply} /> : null}
          {step === "equipe" ? <Team event={event} onChange={apply} /> : null}
          {step === "atividades" ? <ActivitiesLink event={event} /> : null}
          {step === "formulario" ? <FormLink event={event} /> : null}
          {step === "equipes" ? <RoboticsLink event={event} /> : null}
          {step === "basico" || step === "quando" || step === "aparencia" ? (
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => void persist(true)}>
                Salvar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const order = ["basico", "quando", "aparencia", "revisao"] as const;
                  const next = order[order.indexOf(step as (typeof order)[number]) + 1];
                  if (next) void go(next);
                }}
              >
                Continuar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="text-sm text-brand-purple">{hint}</p> : null}
      {error ? <p className="text-sm text-brand-pink-dark">{error}</p> : null}
    </div>
  );
}

function Appearance({
  eventId,
  banner,
  colorPrimary,
  colorSecondary,
  colorAccent,
  onColor,
  onUploaded,
}: {
  eventId: string;
  banner: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  onColor: (key: "colorPrimary" | "colorSecondary" | "colorAccent", value: string) => void;
  onUploaded: (event: AdminEventDetail) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const src = bannerSrc(banner);

  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const result = await enviarBanner(eventId, new FormData(formEvent.currentTarget));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("Banner atualizado.");
    onUploaded(result.data);
  }

  return (
    <>
      {src ? <img src={src} alt="Banner do evento" className="max-h-48 rounded-lg object-cover" /> : null}
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field label="Banner" htmlFor="banner" hint="JPEG, PNG ou WebP, até 2 MB.">
          <Input id="banner" name="banner" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Button type="submit" variant="outline">Enviar banner</Button>
      </form>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <ColorField id="colorPrimary" label="Cor principal" value={colorPrimary} onChange={(value) => onColor("colorPrimary", value)} />
        <ColorField id="colorSecondary" label="Cor de apoio" value={colorSecondary} onChange={(value) => onColor("colorSecondary", value)} />
        <ColorField id="colorAccent" label="Destaque" value={colorAccent} onChange={(value) => onColor("colorAccent", value)} />
      </div>
    </>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function Review({ event, onPublish }: { event: AdminEventDetail; onPublish: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p><span className="font-medium">Título: </span>{event.title}</p>
      <p><span className="font-medium">Endereço: </span>/e/{event.slug}</p>
      <p><span className="font-medium">Tema: </span>{event.theme || "A definir"}</p>
      <p><span className="font-medium">Quando: </span>{formatWhen(event.startsAt, event.endsAt)}</p>
      <p><span className="font-medium">Local: </span>{event.place || "A definir"}</p>
      <p><span className="font-medium">Atividades: </span>{event.activityCount}</p>
      <p className="whitespace-pre-wrap text-brand-purple">{event.description}</p>
      {event.publishBlockers.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-brand-pink-dark">
          {event.publishBlockers.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {event.status === "DRAFT" ? (
        <Button type="button" disabled={event.publishBlockers.length > 0} onClick={onPublish}>
          Publicar
        </Button>
      ) : (
        <Link href={`/e/${event.slug}`} className="text-brand-pink-dark underline-offset-4 hover:underline">
          Ver página pública
        </Link>
      )}
    </div>
  );
}

function Places({
  event,
  onChange,
}: {
  event: AdminEventDetail;
  onChange: (event: AdminEventDetail) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function add(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const result = await criarLocal(event.id, { name, notes });
    if (!result.ok) {
      setMessage(result.fields?.name || result.message);
      return;
    }
    setName("");
    setNotes("");
    setMessage(null);
    onChange(result.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {event.locations.length === 0 ? <li>Nenhum local ainda. Exemplo: Corredor principal.</li> : null}
        {event.locations.map((location) => (
          <li key={location.id} className="flex items-center justify-between gap-3">
            <span>
              {location.name}
              {location.notes ? <span className="text-brand-purple"> · {location.notes}</span> : null}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void removerLocal(event.id, location.id).then((result) => {
                  if (result.ok) onChange(result.data);
                  else setMessage(result.message);
                });
              }}
            >
              Remover
            </Button>
          </li>
        ))}
      </ul>
      <form className="flex flex-col gap-3" onSubmit={add}>
        <Field label="Nome do local" htmlFor="location-name" error={message ?? undefined}>
          <Input id="location-name" value={name} onChange={(item) => setName(item.target.value)} required />
        </Field>
        <Field label="Notas" htmlFor="location-notes">
          <Input id="location-notes" value={notes} onChange={(item) => setNotes(item.target.value)} />
        </Field>
        <Button type="submit" variant="outline">Adicionar local</Button>
      </form>
    </div>
  );
}

function Team({
  event,
  onChange,
}: {
  event: AdminEventDetail;
  onChange: (event: AdminEventDetail) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("STAFF");
  const [message, setMessage] = useState<string | null>(null);

  async function invite(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const result = await convidarPessoa(event.id, { email, role });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setEmail("");
    setMessage("Pessoa adicionada. O papel entra no próximo login dela.");
    onChange(result.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {event.members.length === 0 ? <li>A equipe ainda está vazia.</li> : null}
        {event.members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {member.name}
              <span className="text-brand-purple"> · {member.email}</span>
            </span>
            <span className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`papel-${member.id}`}>Papel de {member.name}</label>
              <select
                id={`papel-${member.id}`}
                className={selectClass}
                value={member.role}
                onChange={(item) => {
                  void atualizarPapel(event.id, member.id, item.target.value as TeamRole).then((result) => {
                    if (result.ok) onChange(result.data);
                    else setMessage(result.message);
                  });
                }}
              >
                {teamRoles.map((item) => (
                  <option key={item} value={item}>{roleLabel[item]}</option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void removerPessoa(event.id, member.id).then((result) => {
                    if (result.ok) onChange(result.data);
                    else setMessage(result.message);
                  });
                }}
              >
                Remover
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <form className="flex flex-col gap-3" onSubmit={invite}>
        <Field label="E-mail de quem já tem conta" htmlFor="member-email">
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(item) => setEmail(item.target.value)}
            required
          />
        </Field>
        <Field label="Papel" htmlFor="member-role">
          <select
            id="member-role"
            className={selectClass}
            value={role}
            onChange={(item) => setRole(item.target.value as TeamRole)}
          >
            {teamRoles.map((item) => (
              <option key={item} value={item}>{roleLabel[item]}</option>
            ))}
          </select>
        </Field>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
        <Button type="submit" variant="outline">Convidar</Button>
      </form>
    </div>
  );
}

function ActivitiesLink({ event }: { event: AdminEventDetail }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-brand-purple">
        {event.activityCount === 0
          ? "Nenhuma atividade ainda. Publicar exige pelo menos uma."
          : `${event.activityCount} ${event.activityCount === 1 ? "atividade na programação" : "atividades na programação"}.`}
      </p>
      <Button
        nativeButton={false}
        render={<Link href={`/admin/eventos/${event.id}/atividades`} />}
      >
        Abrir a programação
      </Button>
    </div>
  );
}

function RoboticsLink({ event }: { event: AdminEventDetail }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-brand-purple">
        Equipes do desafio de robótica, com vaga confirmada ou lista de espera, e os documentos de vínculo.
      </p>
      <Button
        nativeButton={false}
        render={<Link href={`/admin/eventos/${event.id}/equipes`} />}
      >
        Abrir as equipes
      </Button>
    </div>
  );
}

function FormLink({ event }: { event: AdminEventDetail }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-brand-purple">
        Nome, e-mail, CPF e telefone já fazem parte da inscrição. A instituição é opcional para participante.
      </p>
      <Button
        nativeButton={false}
        render={<Link href={`/admin/eventos/${event.id}/formulario`} />}
      >
        Abrir o formulário
      </Button>
    </div>
  );
}
