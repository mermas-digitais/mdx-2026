import { cpfError, cpfFromSeed } from './form-schema.js';
import { roboticsMemberAddSchema, roboticsTeamSchema } from './robotics-schema.js';

const modality = '11111111-1111-4111-8111-111111111111';

const members = [0, 1, 2].map((index) => ({
  fullName: `Aluna ${index + 1}`,
  cpf: cpfFromSeed(1000 + index),
  birthDate: '2012-04-03',
}));

function team(patch: Record<string, unknown> = {}) {
  return {
    advisorName: 'Ana Orientadora',
    advisorEmail: 'ana@escola.br',
    advisorPhone: '99999999999',
    institution: 'IFMA',
    teamName: 'Íris',
    modalityIds: [modality],
    members,
    girlsDeclaration: true,
    rulesAccepted: true,
    ...patch,
  };
}

describe('inscrição de equipe', () => {
  it('aceita a ficha mínima e recusa equipe fora de 3 a 5', () => {
    expect(roboticsTeamSchema.safeParse(team()).success).toBe(true);
    expect(roboticsTeamSchema.safeParse(team({ institution: '' })).success).toBe(false);
    expect(roboticsTeamSchema.safeParse(team({ members: members.slice(0, 2) })).success).toBe(false);
  });

  it('aceita uma integrante nova e recusa CPF inválido', () => {
    const member = { fullName: 'Bia Nova', cpf: cpfFromSeed(77), birthDate: '2013-08-19' };
    expect(roboticsMemberAddSchema.safeParse(member).success).toBe(true);
    expect(roboticsMemberAddSchema.safeParse({ ...member, cpf: '11111111111' }).success).toBe(false);
    expect(roboticsMemberAddSchema.safeParse({ ...member, fullName: 'A' }).success).toBe(false);
  });

  it('gera CPF válido', () => {
    expect(cpfError(cpfFromSeed(42))).toBeNull();
    expect(cpfError('11111111111')).toBe('Informe um CPF válido.');
  });
});
