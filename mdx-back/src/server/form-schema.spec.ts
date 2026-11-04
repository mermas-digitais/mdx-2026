import { formIssues, registrationSchema, type FormFieldConfig } from './form-schema.js';
import * as web from '../../../mdx-front/src/server/form-schema.ts';

const how: FormFieldConfig = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Como soube do evento',
  help: '',
  type: 'TEXT',
  required: true,
  options: [],
  categories: [],
  displayOrder: 1,
};

const team: FormFieldConfig = {
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Nome da equipe',
  help: '',
  type: 'TEXT',
  required: true,
  options: [],
  categories: ['COMPETITOR'],
  displayOrder: 2,
};

const base = {
  name: 'Marina Costa',
  email: 'marina.costa@example.com',
  cpf: '52998224725',
  phone: '99999999999',
  institution: 'IFMA',
  category: 'VISITOR' as const,
};

describe('formulário de inscrição', () => {
  it('exige o campo novo e ignora pergunta de outra categoria', () => {
    const schema = registrationSchema([how, team]);
    const missing = schema.safeParse({ ...base, answers: {} });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(formIssues(missing.error)[`answers.${how.id}`]).toBe('Preencha este campo.');
    }
    const visitor = schema.safeParse({ ...base, answers: { [how.id]: 'Na escola' } });
    expect(visitor.success).toBe(true);
    const competitor = schema.safeParse({
      ...base,
      category: 'COMPETITOR',
      answers: { [how.id]: 'Na escola' },
    });
    expect(competitor.success).toBe(false);
    const same = web.registrationSchema([how, team]).safeParse({
      ...base,
      category: 'COMPETITOR',
      answers: { [how.id]: 'Na escola', [team.id]: 'Íris' },
    });
    expect(same.success).toBe(true);
    const withoutSchool = schema.safeParse({ ...base, institution: '', answers: { [how.id]: 'Na escola' } });
    expect(withoutSchool.success).toBe(true);
  });

  it('recusa opção fora da lista nos dois lados', () => {
    const choice: FormFieldConfig = { ...how, type: 'SELECT', options: ['Escola', 'Amiga'] };
    const parsed = registrationSchema([choice]).safeParse({
      ...base,
      answers: { [choice.id]: 'Outdoor' },
    });
    expect(parsed.success).toBe(false);
    expect(web.registrationSchema([choice]).safeParse({
      ...base,
      answers: { [choice.id]: 'Escola' },
    }).success).toBe(true);
  });
});
