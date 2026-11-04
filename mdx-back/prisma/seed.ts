import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ActivityType,
  EnrollmentStatus,
  EventRole,
  EventStatus,
  FieldType,
  GlobalRole,
  PrismaClient,
  RegistrationCategory,
} from '../generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL ausente');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PASSWORD = 'mdx-2026';

const participants = [
  {
    name: 'Marina Costa',
    email: 'marina.costa@example.com',
    category: RegistrationCategory.VISITOR,
    school: 'Não se aplica',
    grade: 'Não estudo',
    accessibility: false,
    code: 'MDX26P01',
  },
  {
    name: 'Lucas Ferreira',
    email: 'lucas.ferreira@example.com',
    category: RegistrationCategory.VISITOR,
    school: 'Não se aplica',
    grade: 'Não estudo',
    accessibility: true,
    code: 'MDX26P02',
  },
  {
    name: 'Helena Ribeiro',
    email: 'helena.ribeiro@example.com',
    category: RegistrationCategory.SCHOOL,
    school: 'Escola Estadual Gonçalves Dias',
    grade: '2º ano',
    accessibility: false,
    code: 'MDX26P03',
  },
  {
    name: 'Sofia Mendes',
    email: 'sofia.mendes@example.com',
    category: RegistrationCategory.SCHOOL,
    school: 'Colégio Dom Pedro',
    grade: '3º ano',
    accessibility: false,
    code: 'MDX26P04',
  },
  {
    name: 'Rafael Duarte',
    email: 'rafael.duarte@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'IFMA Campus Imperatriz',
    grade: 'Técnico',
    accessibility: false,
    code: 'MDX26P05',
  },
  {
    name: 'Isabela Campos',
    email: 'isabela.campos@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'IFMA Campus Imperatriz',
    grade: 'Técnico',
    accessibility: false,
    code: 'MDX26P06',
  },
  {
    name: 'Thiago Barbosa',
    email: 'thiago.barbosa@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'IFMA Campus Imperatriz',
    grade: '1º ano',
    accessibility: false,
    code: 'MDX26P07',
  },
  {
    name: 'Camila Nogueira',
    email: 'camila.nogueira@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'Escola Estadual Gonçalves Dias',
    grade: '3º ano',
    accessibility: false,
    code: 'MDX26P08',
  },
  {
    name: 'Bruno Teixeira',
    email: 'bruno.teixeira@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'Escola Estadual Gonçalves Dias',
    grade: '2º ano',
    accessibility: true,
    code: 'MDX26P09',
  },
  {
    name: 'Larissa Gomes',
    email: 'larissa.gomes@example.com',
    category: RegistrationCategory.COMPETITOR,
    school: 'Colégio Dom Pedro',
    grade: '3º ano',
    accessibility: false,
    code: 'MDX26P10',
  },
] as const;

function at(day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 10, day, hour + 3, minute));
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const emails = ['admin@mdx.local', ...participants.map((person) => person.email)];

  await prisma.$transaction(
    async (tx) => {
      await tx.event.deleteMany({ where: { slug: 'mdx-2026' } });
      await tx.user.deleteMany({ where: { email: { in: emails } } });

      const admin = await tx.user.create({
        data: {
          name: 'Ana Organizadora',
          email: 'admin@mdx.local',
          passwordHash,
          role: GlobalRole.ADMIN,
        },
      });

      const users = await Promise.all(
        participants.map((person) =>
          tx.user.create({
            data: {
              name: person.name,
              email: person.email,
              passwordHash,
              role: GlobalRole.USER,
            },
          }),
        ),
      );

      const event = await tx.event.create({
        data: {
          slug: 'mdx-2026',
          title: 'MDX 2026',
          description:
            'Encontro de meninas e jovens na tecnologia, com stands, oficinas e provas de robótica no IFMA Campus Imperatriz.',
          theme: 'STEAM',
          place: 'IFMA Imperatriz',
          address:
            'Instituto Federal do Maranhão, Campus Imperatriz, Imperatriz — MA',
          startsAt: at(24, 8),
          endsAt: at(25, 18),
          banner: '/banners/mdx-2026.png',
          status: EventStatus.PUBLISHED,
          registrationsOpen: true,
          capacity: 400,
          colorPrimary: '#EC4899',
          colorSecondary: '#4C1D95',
          colorAccent: '#7C3AED',
          members: {
            create: { userId: admin.id, role: EventRole.ORGANIZER },
          },
        },
      });

      const [patio, lab, arena] = await Promise.all([
        tx.location.create({
          data: {
            eventId: event.id,
            name: 'Pátio central',
            notes: 'Circulação entre os stands, com tomada compartilhada.',
          },
        }),
        tx.location.create({
          data: {
            eventId: event.id,
            name: 'Laboratório de ciências',
            notes: 'Bancadas e pia. Uso de jaleco no stand de química.',
          },
        }),
        tx.location.create({
          data: {
            eventId: event.id,
            name: 'Arena de provas',
            notes: 'Pista de seguidor de linha e dohyo de sumô.',
          },
        }),
      ]);

      const stands = [
        {
          title: 'Robótica educacional',
          description: 'Kits para montar um robô que desvia de obstáculos.',
          locationId: patio.id,
          startsAt: at(24, 9),
          endsAt: at(24, 12),
          responsible: 'Coletivo de robótica do IFMA',
        },
        {
          title: 'Impressão 3D',
          description: 'Da modelagem à peça impressa, com exemplos de engrenagens.',
          locationId: patio.id,
          startsAt: at(24, 9),
          endsAt: at(24, 12),
          responsible: 'Laboratório maker',
        },
        {
          title: 'Química na cozinha',
          description: 'Reações seguras com ingredientes do dia a dia.',
          locationId: lab.id,
          startsAt: at(24, 10),
          endsAt: at(24, 12),
          responsible: 'Professora de química',
        },
        {
          title: 'Astronomia',
          description: 'Mapa do céu de novembro e luneta para observação.',
          locationId: patio.id,
          startsAt: at(24, 14),
          endsAt: at(24, 17),
          responsible: 'Clube de astronomia',
        },
        {
          title: 'Jogos de lógica',
          description: 'Desafios de programação desplugada e tabuleiro.',
          locationId: patio.id,
          startsAt: at(25, 9),
          endsAt: at(25, 12),
          responsible: 'Monitoria de matemática',
        },
      ];

      const standActivities = await Promise.all(
        stands.map((stand, index) =>
          tx.activity.create({
            data: {
              eventId: event.id,
              locationId: stand.locationId,
              title: stand.title,
              description: stand.description,
              type: ActivityType.STAND,
              startsAt: stand.startsAt,
              endsAt: stand.endsAt,
              requiresEnrollment: false,
              grantsStamp: true,
              responsible: stand.responsible,
              displayOrder: index + 1,
            },
          }),
        ),
      );

      const lineFollower = await tx.activity.create({
        data: {
          eventId: event.id,
          locationId: arena.id,
          title: 'Seguidor de linha',
          description:
            'O robô percorre a pista preta no menor tempo, com duas voltas.',
          type: ActivityType.COMPETITION,
          startsAt: at(24, 14),
          endsAt: at(24, 17),
          capacity: 6,
          requiresEnrollment: true,
          grantsStamp: true,
          responsible: 'Arbitragem de robótica',
          displayOrder: 6,
        },
      });

      const sumo = await tx.activity.create({
        data: {
          eventId: event.id,
          locationId: arena.id,
          title: 'Sumô de robôs',
          description: 'Dois robôs no dohyo. Vence quem empurra o outro para fora.',
          type: ActivityType.COMPETITION,
          startsAt: at(25, 9),
          endsAt: at(25, 12),
          capacity: 4,
          requiresEnrollment: true,
          grantsStamp: true,
          responsible: 'Arbitragem de robótica',
          displayOrder: 7,
        },
      });

      const [lineCompetition, sumoCompetition] = await Promise.all([
        tx.competition.create({
          data: {
            activityId: lineFollower.id,
            name: 'Seguidor de linha',
            rules:
              'Duas voltas na pista. O tempo menor vence a rodada. Empate técnico vai para a terceira volta.',
          },
        }),
        tx.competition.create({
          data: {
            activityId: sumo.id,
            name: 'Sumô de robôs',
            rules:
              'Melhor de duas quedas. Robô imobilizado por dez segundos perde a queda.',
          },
        }),
      ]);

      const [schoolField, gradeField, accessField] = await Promise.all([
        tx.formField.create({
          data: {
            eventId: event.id,
            label: 'Escola',
            type: FieldType.TEXT,
            required: true,
            displayOrder: 1,
          },
        }),
        tx.formField.create({
          data: {
            eventId: event.id,
            label: 'Série',
            type: FieldType.SELECT,
            required: true,
            options: ['1º ano', '2º ano', '3º ano', 'Técnico', 'Não estudo'],
            displayOrder: 2,
          },
        }),
        tx.formField.create({
          data: {
            eventId: event.id,
            label: 'Preciso de apoio de acessibilidade',
            type: FieldType.CHECKBOX,
            required: false,
            displayOrder: 3,
          },
        }),
      ]);

      const registrations = await Promise.all(
        participants.map((person, index) =>
          tx.registration.create({
            data: {
              userId: users[index].id,
              eventId: event.id,
              passportCode: person.code,
              category: person.category,
              answers: {
                [schoolField.id]: person.school,
                [gradeField.id]: person.grade,
                [accessField.id]: person.accessibility,
              },
              checkedInAt: index < 4 ? at(24, 8, 15 + index) : null,
            },
          }),
        ),
      );

      const iris = users.slice(4, 7);
      const violeta = users.slice(7, 10);

      const [teamIris, teamVioleta, teamGarra, teamPistao] = await Promise.all([
        tx.team.create({
          data: {
            competitionId: lineCompetition.id,
            name: 'Equipe Íris',
            school: 'IFMA Campus Imperatriz',
            members: { create: iris.map((user) => ({ userId: user.id })) },
          },
        }),
        tx.team.create({
          data: {
            competitionId: lineCompetition.id,
            name: 'Equipe Violeta',
            school: 'Escola Estadual Gonçalves Dias',
            members: { create: violeta.map((user) => ({ userId: user.id })) },
          },
        }),
        tx.team.create({
          data: {
            competitionId: sumoCompetition.id,
            name: 'Equipe Garra',
            school: 'IFMA Campus Imperatriz',
            members: { create: iris.map((user) => ({ userId: user.id })) },
          },
        }),
        tx.team.create({
          data: {
            competitionId: sumoCompetition.id,
            name: 'Equipe Pistão',
            school: 'Escola Estadual Gonçalves Dias',
            members: { create: violeta.map((user) => ({ userId: user.id })) },
          },
        }),
      ]);

      const competitorRegistrations = registrations.slice(4);

      await tx.activityEnrollment.createMany({
        data: competitorRegistrations.flatMap((registration, index) => [
          {
            registrationId: registration.id,
            activityId: lineFollower.id,
            status: EnrollmentStatus.CONFIRMED,
          },
          {
            registrationId: registration.id,
            activityId: sumo.id,
            status:
              index < 4 ? EnrollmentStatus.CONFIRMED : EnrollmentStatus.WAITLIST,
          },
        ]),
      });

      await tx.matchResult.createMany({
        data: [
          { competitionId: lineCompetition.id, teamId: teamIris.id, round: 1, score: '80.00' },
          { competitionId: lineCompetition.id, teamId: teamVioleta.id, round: 1, score: '65.00' },
          { competitionId: lineCompetition.id, teamId: teamIris.id, round: 2, score: '90.00', notes: 'Volta limpa, sem saída da faixa.' },
          { competitionId: lineCompetition.id, teamId: teamVioleta.id, round: 2, score: '88.00' },
          { competitionId: sumoCompetition.id, teamId: teamGarra.id, round: 1, score: '2.00' },
          { competitionId: sumoCompetition.id, teamId: teamPistao.id, round: 1, score: '1.00' },
          { competitionId: sumoCompetition.id, teamId: teamGarra.id, round: 2, score: '1.00' },
          { competitionId: sumoCompetition.id, teamId: teamPistao.id, round: 2, score: '2.00', notes: 'Queda decidida no tempo.' },
        ],
      });

      await tx.stamp.createMany({
        data: [0, 1, 2].flatMap((personIndex) =>
          standActivities.slice(0, 3).map((activity) => ({
            registrationId: registrations[personIndex].id,
            activityId: activity.id,
            stampedById: admin.id,
            stampedAt: at(24, 11, personIndex * 5),
          })),
        ),
      });

      await tx.certificate.create({
        data: {
          registrationId: registrations[0].id,
          code: 'MDX26CERT00001',
          issuedAt: at(25, 17),
        },
      });

      await tx.announcement.createMany({
        data: [
          {
            eventId: event.id,
            title: 'Credenciamento às 8h',
            body: 'Chegue com o código do passaporte. O credenciamento fica na entrada do pátio central.',
            publishedAt: at(20, 10),
          },
          {
            eventId: event.id,
            title: 'Provas na arena',
            body: 'Seguidor de linha no dia 24 à tarde. Sumô de robôs no dia 25 de manhã.',
            publishedAt: at(23, 15),
          },
        ],
      });

      await tx.roboticsModality.createMany({
        data: [
          { eventId: event.id, name: 'Caça Balão', slotLimit: 16, displayOrder: 1 },
          { eventId: event.id, name: 'Sumô', slotLimit: 16, displayOrder: 2 },
          { eventId: event.id, name: 'Corrida com obstáculos', slotLimit: 16, displayOrder: 3 },
        ],
      });
    },
    { timeout: 20_000 },
  );

  const [events, users, stands, competitions, registrations] = await Promise.all([
    prisma.event.count({ where: { slug: 'mdx-2026' } }),
    prisma.user.count(),
    prisma.activity.count({ where: { type: ActivityType.STAND, event: { slug: 'mdx-2026' } } }),
    prisma.competition.count({ where: { activity: { event: { slug: 'mdx-2026' } } } }),
    prisma.registration.count({ where: { event: { slug: 'mdx-2026' } } }),
  ]);

  console.log(
    `Seed ok: ${events} evento, ${users} usuários, ${stands} stands, ${competitions} provas, ${registrations} inscrições.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
