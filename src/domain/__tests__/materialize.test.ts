import { materialize, reconcile } from '../materialize';
import type { Commitment, Occurrence } from '../types';

function commitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'c1',
    profileId: 'p1',
    categoryId: null,
    kind: 'expense',
    type: 'single',
    description: 'Teste',
    amount: 10_000,
    installments: null,
    startDate: '2026-03-15',
    endDate: null,
    dayOfMonth: null,
    notes: null,
    isInvestment: false,
    goalId: null,
    archived: false,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: 'o1',
    commitmentId: 'c1',
    profileId: 'p1',
    kind: 'expense',
    competence: '2026-03',
    dueDate: '2026-03-15',
    amount: 10_000,
    installmentIndex: null,
    status: 'pending',
    paidAt: null,
    isOverridden: false,
    isInvestment: false,
    goalId: null,
    ...overrides,
  };
}

describe('materialize single', () => {
  it('gera uma única ocorrência no mês da data', () => {
    const result = materialize(commitment());

    expect(result).toHaveLength(1);
    expect(result[0].competence).toBe('2026-03');
    expect(result[0].dueDate).toBe('2026-03-15');
    expect(result[0].installmentIndex).toBeNull();
  });
});

describe('materialize installment', () => {
  it('gera uma ocorrência por parcela, virando o ano', () => {
    const result = materialize(
      commitment({ type: 'installment', installments: 10, amount: 32_000 }),
    );

    expect(result).toHaveLength(10);
    expect(result[0].competence).toBe('2026-03');
    expect(result[9].competence).toBe('2026-12');
    expect(result[2].installmentIndex).toBe(3);
  });

  it('atravessa a virada de ano corretamente', () => {
    const result = materialize(
      commitment({ type: 'installment', installments: 12, startDate: '2026-08-10' }),
    );

    expect(result[0].competence).toBe('2026-08');
    expect(result[4].competence).toBe('2026-12');
    expect(result[5].competence).toBe('2027-01');
    expect(result[11].competence).toBe('2027-07');
  });

  it('usa o valor da parcela em cada ocorrência, não o total', () => {
    const result = materialize(
      commitment({ type: 'installment', installments: 10, amount: 32_000 }),
    );

    expect(result.every((item) => item.amount === 32_000)).toBe(true);
  });

  it('encaixa o dia 31 no último dia de fevereiro', () => {
    const result = materialize(
      commitment({ type: 'installment', installments: 3, startDate: '2026-01-31' }),
    );

    expect(result[0].dueDate).toBe('2026-01-31');
    expect(result[1].dueDate).toBe('2026-02-28');
    expect(result[2].dueDate).toBe('2026-03-31');
  });

  it('respeita o 29 de fevereiro em ano bissexto', () => {
    const result = materialize(
      commitment({ type: 'installment', installments: 2, startDate: '2028-01-31' }),
    );

    expect(result[1].dueDate).toBe('2028-02-29');
  });
});

describe('materialize recurring', () => {
  it('vai até o horizonte quando não tem data final', () => {
    const result = materialize(
      commitment({ type: 'recurring', dayOfMonth: 8, startDate: '2026-03-08' }),
      { horizon: '2026-08' },
    );

    expect(result).toHaveLength(6);
    expect(result[0].competence).toBe('2026-03');
    expect(result[5].competence).toBe('2026-08');
  });

  it('para na data final quando ela vem antes do horizonte', () => {
    const result = materialize(
      commitment({
        type: 'recurring',
        dayOfMonth: 8,
        startDate: '2026-03-08',
        endDate: '2026-05-08',
      }),
      { horizon: '2026-12' },
    );

    expect(result).toHaveLength(3);
    expect(result[2].competence).toBe('2026-05');
  });

  it('não vaza o dia 31 para o mês seguinte', () => {
    const result = materialize(
      commitment({ type: 'recurring', dayOfMonth: 31, startDate: '2026-01-31' }),
      { horizon: '2026-04' },
    );

    expect(result.map((item) => item.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('devolve lista vazia quando o horizonte é anterior ao início', () => {
    const result = materialize(
      commitment({ type: 'recurring', dayOfMonth: 5, startDate: '2027-01-05' }),
      { horizon: '2026-12' },
    );

    expect(result).toHaveLength(0);
  });
});

describe('reconcile', () => {
  const recurring = commitment({
    type: 'recurring',
    dayOfMonth: 8,
    startDate: '2026-01-08',
    amount: 5_500,
  });

  it('preserva ocorrências pagas', () => {
    const existing = [
      occurrence({ id: 'a', competence: '2026-01', amount: 4_500, status: 'paid' }),
      occurrence({ id: 'b', competence: '2026-02', amount: 4_500 }),
    ];

    const result = reconcile(recurring, existing, { horizon: '2026-03', from: '2026-02' });

    expect(result.toDeleteIds).not.toContain('a');
    expect(result.toUpdate.find((item) => item.id === 'a')).toBeUndefined();
  });

  it('atualiza o valor das pendentes a partir do mês corrente', () => {
    const existing = [occurrence({ id: 'b', competence: '2026-02', amount: 4_500 })];

    const result = reconcile(recurring, existing, { horizon: '2026-02', from: '2026-02' });

    expect(result.toUpdate).toContainEqual({ id: 'b', dueDate: '2026-02-08', amount: 5_500 });
  });

  it('preserva o valor de ocorrências editadas à mão', () => {
    const existing = [
      occurrence({ id: 'b', competence: '2026-02', amount: 7_700, isOverridden: true }),
    ];

    const result = reconcile(recurring, existing, { horizon: '2026-02', from: '2026-02' });

    expect(result.toUpdate).toContainEqual({ id: 'b', dueDate: '2026-02-08', amount: 7_700 });
  });

  it('não mexe em meses anteriores ao corrente', () => {
    const existing = [occurrence({ id: 'a', competence: '2026-01', amount: 4_500 })];

    const result = reconcile(recurring, existing, { horizon: '2026-02', from: '2026-02' });

    expect(result.toDeleteIds).toHaveLength(0);
    expect(result.toUpdate.find((item) => item.id === 'a')).toBeUndefined();
  });

  it('apaga pendentes futuras que saíram do plano', () => {
    const encurtado = commitment({
      type: 'recurring',
      dayOfMonth: 8,
      startDate: '2026-01-08',
      endDate: '2026-02-08',
    });

    const existing = [
      occurrence({ id: 'b', competence: '2026-02' }),
      occurrence({ id: 'c', competence: '2026-03' }),
    ];

    const result = reconcile(encurtado, existing, { horizon: '2026-06', from: '2026-02' });

    expect(result.toDeleteIds).toEqual(['c']);
  });

  it('cria as ocorrências que faltam', () => {
    const existing = [occurrence({ id: 'b', competence: '2026-02' })];

    const result = reconcile(recurring, existing, { horizon: '2026-04', from: '2026-02' });

    expect(result.toInsert.map((item) => item.competence)).toEqual([
      '2026-01',
      '2026-03',
      '2026-04',
    ]);
  });
});
