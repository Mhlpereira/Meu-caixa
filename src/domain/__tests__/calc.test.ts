import {
  buildProjection,
  canAffordGoal,
  groupByDueDate,
  investmentProgress,
  savingsRate,
  spentRatio,
  summarizeMonth,
} from '../calc';
import type { OccurrenceView } from '../types';

function view(overrides: Partial<OccurrenceView> = {}): OccurrenceView {
  return {
    id: 'o1',
    commitmentId: 'c1',
    profileId: 'p1',
    kind: 'expense',
    competence: '2026-09',
    dueDate: '2026-09-15',
    amount: 10_000,
    installmentIndex: null,
    status: 'pending',
    paidAt: null,
    isOverridden: false,
    isInvestment: false,
    goalId: null,
    description: 'Teste',
    commitmentType: 'single',
    installmentsTotal: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    categoryColor: null,
    profileName: 'Pessoal',
    profileColor: '#6366F1',
    ...overrides,
  };
}

describe('summarizeMonth', () => {
  it('calcula saldo como entradas menos saídas', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 800_000 }),
      view({ kind: 'expense', amount: 566_000 }),
    ]);

    expect(summary.incomePlanned).toBe(800_000);
    expect(summary.expensePlanned).toBe(566_000);
    expect(summary.balancePlanned).toBe(234_000);
  });

  it('conta só parcelas e recorrentes como comprometido', () => {
    const summary = summarizeMonth('2026-09', [
      view({ amount: 32_000, commitmentType: 'installment' }),
      view({ amount: 5_500, commitmentType: 'recurring' }),
      view({ amount: 17_990, commitmentType: 'single' }),
    ]);

    expect(summary.committed).toBe(37_500);
  });

  it('aporte recorrente também é renda comprometida', () => {
    const summary = summarizeMonth('2026-09', [
      view({ amount: 5_500, commitmentType: 'recurring' }),
      view({ amount: 150_000, commitmentType: 'recurring', isInvestment: true }),
    ]);

    expect(summary.committed).toBe(155_500);
  });

  it('aporte parcelado também entra no comprometido', () => {
    const summary = summarizeMonth('2026-09', [
      view({ amount: 40_000, commitmentType: 'installment', isInvestment: true }),
    ]);

    expect(summary.committed).toBe(40_000);
  });

  it('aporte avulso não entra no comprometido', () => {
    const summary = summarizeMonth('2026-09', [
      view({ amount: 90_000, commitmentType: 'single', isInvestment: true }),
    ]);

    expect(summary.committed).toBe(0);
  });

  it('comprometido soma investimento sem inflar as saídas', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 900_000 }),
      view({ amount: 300_000, commitmentType: 'recurring' }),
      view({ amount: 150_000, commitmentType: 'recurring', isInvestment: true }),
    ]);

    expect(summary.expensePlanned).toBe(300_000);
    expect(summary.committed).toBe(450_000);
    expect(summary.free).toBe(450_000);
  });

  it('aporte pulado sai do comprometido', () => {
    const summary = summarizeMonth('2026-09', [
      view({ amount: 150_000, commitmentType: 'recurring', isInvestment: true, status: 'skipped' }),
    ]);

    expect(summary.committed).toBe(0);
  });

  it('tira ocorrências puladas de todas as somas', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 800_000 }),
      view({ kind: 'expense', amount: 10_000, status: 'skipped' }),
      view({ kind: 'expense', amount: 20_000 }),
    ]);

    expect(summary.expensePlanned).toBe(20_000);
    expect(summary.balancePlanned).toBe(780_000);
  });

  it('separa previsto de realizado', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 800_000, status: 'paid' }),
      view({ kind: 'expense', amount: 30_000, status: 'paid' }),
      view({ kind: 'expense', amount: 20_000 }),
    ]);

    expect(summary.balancePlanned).toBe(750_000);
    expect(summary.balanceActual).toBe(770_000);
    expect(summary.toPay).toBe(20_000);
    expect(summary.toReceive).toBe(0);
  });

  it('calcula livre como receita menos comprometido', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 800_000 }),
      view({ kind: 'expense', amount: 318_000, commitmentType: 'recurring' }),
      view({ kind: 'expense', amount: 50_000, commitmentType: 'single' }),
    ]);

    expect(summary.free).toBe(482_000);
  });
});

describe('spentRatio e savingsRate', () => {
  it('limita a razão de gasto em 1', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 100_000 }),
      view({ kind: 'expense', amount: 300_000 }),
    ]);

    expect(spentRatio(summary)).toBe(1);
  });

  it('não calcula taxa de poupança sem receita', () => {
    const summary = summarizeMonth('2026-09', [view({ kind: 'expense', amount: 10_000 })]);

    expect(savingsRate(summary)).toBeNull();
  });

  it('calcula taxa de poupança com receita', () => {
    const summary = summarizeMonth('2026-09', [
      view({ kind: 'income', amount: 100_000 }),
      view({ kind: 'expense', amount: 75_000 }),
    ]);

    expect(savingsRate(summary)).toBeCloseTo(0.25);
  });
});

describe('buildProjection', () => {
  it('acumula o saldo mês a mês a partir do primeiro', () => {
    const projection = buildProjection('2026-09', 3, [
      { competence: '2026-09', income: 800_000, expense: 566_000 },
      { competence: '2026-10', income: 800_000, expense: 566_000 },
      { competence: '2026-11', income: 800_000, expense: 534_000 },
    ]);

    expect(projection[0].accumulated).toBe(234_000);
    expect(projection[1].accumulated).toBe(468_000);
    expect(projection[2].accumulated).toBe(734_000);
  });

  it('trata meses sem lançamento como zero', () => {
    const projection = buildProjection('2026-09', 3, [
      { competence: '2026-09', income: 100_000, expense: 0 },
    ]);

    expect(projection[1].balance).toBe(0);
    expect(projection[2].accumulated).toBe(100_000);
  });

  it('reduz o acumulado num mês negativo', () => {
    const projection = buildProjection('2026-09', 2, [
      { competence: '2026-09', income: 100_000, expense: 50_000 },
      { competence: '2026-10', income: 100_000, expense: 180_000 },
    ]);

    expect(projection[1].balance).toBe(-80_000);
    expect(projection[1].accumulated).toBe(-30_000);
  });
});

describe('groupByDueDate', () => {
  it('agrupa por dia em ordem de vencimento', () => {
    const groups = groupByDueDate([
      view({ id: 'a', dueDate: '2026-09-15' }),
      view({ id: 'b', dueDate: '2026-09-05' }),
      view({ id: 'c', dueDate: '2026-09-15' }),
    ]);

    expect(groups.map((group) => group.dueDate)).toEqual(['2026-09-05', '2026-09-15']);
    expect(groups[1].items).toHaveLength(2);
  });
});

describe('investimento', () => {
  const mes = (goal: number) =>
    summarizeMonth(
      '2026-09',
      [
        view({ kind: 'income', amount: 900_000 }),
        view({ kind: 'expense', amount: 400_000 }),
        view({ kind: 'expense', amount: 150_000, isInvestment: true, status: 'paid' }),
        view({ kind: 'expense', amount: 50_000, isInvestment: true }),
      ],
      goal,
    );

  it('não conta investimento como gasto', () => {
    expect(mes(0).expensePlanned).toBe(400_000);
  });

  it('separa investido previsto de realizado', () => {
    const summary = mes(0);
    expect(summary.investmentPlanned).toBe(200_000);
    expect(summary.investmentActual).toBe(150_000);
  });

  it('a sobra do mês ignora o investimento', () => {
    expect(mes(0).balancePlanned).toBe(500_000);
  });

  it('calcula o quanto falta para a meta', () => {
    const summary = mes(200_000);
    expect(summary.investmentGoal).toBe(200_000);
    expect(summary.investmentGap).toBe(50_000);
  });

  it('marca meta batida com gap zero ou negativo', () => {
    expect(mes(150_000).investmentGap).toBe(0);
    expect(mes(100_000).investmentGap).toBe(-50_000);
  });

  it('desconta o investido da sobra', () => {
    expect(mes(200_000).leftAfterInvesting).toBe(350_000);
  });

  it('calcula o progresso da meta, limitado a 1', () => {
    expect(investmentProgress(mes(300_000))).toBeCloseTo(0.5);
    expect(investmentProgress(mes(100_000))).toBe(1);
  });

  it('não calcula progresso sem meta', () => {
    expect(investmentProgress(mes(0))).toBeNull();
  });

  it('diz se a sobra do mês cobre a meta', () => {
    expect(canAffordGoal(mes(300_000))).toBe(true);
    expect(canAffordGoal(mes(800_000))).toBe(false);
  });

  it('investimento pulado sai da conta', () => {
    const summary = summarizeMonth(
      '2026-09',
      [view({ kind: 'expense', amount: 90_000, isInvestment: true, status: 'skipped' })],
      50_000,
    );
    expect(summary.investmentPlanned).toBe(0);
    expect(summary.investmentActual).toBe(0);
  });
});
