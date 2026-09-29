import {
  contributionNeededFor,
  formatRate,
  goalBalance,
  monthlyRateFrom,
  monthsToTarget,
  projectGoal,
  totalMonthlyContribution,
  type Goal,
} from '../goals';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    profileId: 'p1',
    name: 'Viagem',
    icon: 'airplane',
    color: '#6366F1',
    targetAmount: 800_000,
    monthlyContribution: 50_000,
    annualRateBp: 1065,
    initialAmount: 100_000,
    targetDate: null,
    sortOrder: 0,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('monthlyRateFrom', () => {
  it('converte taxa anual em mensal composta', () => {
    const rate = monthlyRateFrom(1065);
    expect(Math.pow(1 + rate, 12) - 1).toBeCloseTo(0.1065, 6);
  });

  it('taxa zero não rende', () => {
    expect(monthlyRateFrom(0)).toBe(0);
  });

  it('não é a taxa anual dividida por 12', () => {
    expect(monthlyRateFrom(1200)).not.toBeCloseTo(0.01, 5);
    expect(monthlyRateFrom(1200)).toBeLessThan(0.01);
  });
});

describe('projectGoal', () => {
  it('sem rendimento, é só a soma dos aportes', () => {
    const series = projectGoal(0, 10_000, 0, 0, 6, '2026-01');
    expect(series[5].balance).toBe(60_000);
    expect(series.every((month) => month.yield === 0)).toBe(true);
  });

  it('com rendimento, rende mais que a soma dos aportes', () => {
    const series = projectGoal(0, 10_000, 1200, 0, 12, '2026-01');
    expect(series[11].balance).toBeGreaterThan(120_000);
  });

  it('capital parado rende sem aporte', () => {
    const series = projectGoal(100_000, 0, 1200, 0, 12, '2026-01');
    expect(series[11].balance).toBeGreaterThan(100_000);
    expect(series[11].balance).toBeCloseTo(112_000, -3);
  });

  it('avança a competência mês a mês', () => {
    const series = projectGoal(0, 1_000, 0, 0, 3, '2026-11');
    expect(series.map((month) => month.competence)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('marca o mês em que a meta é batida', () => {
    const series = projectGoal(0, 10_000, 0, 30_000, 5, '2026-01');
    expect(series[1].reachedTarget).toBe(false);
    expect(series[2].reachedTarget).toBe(true);
  });

  it('sem meta, nunca marca como alcançada', () => {
    const series = projectGoal(0, 10_000, 0, 0, 3, '2026-01');
    expect(series.every((month) => !month.reachedTarget)).toBe(true);
  });
});

describe('monthsToTarget', () => {
  it('conta os meses até bater a meta', () => {
    expect(monthsToTarget(0, 10_000, 0, 50_000)).toBe(5);
  });

  it('rendimento antecipa a meta', () => {
    const semJuros = monthsToTarget(0, 10_000, 0, 500_000);
    const comJuros = monthsToTarget(0, 10_000, 1200, 500_000);
    expect(comJuros).not.toBeNull();
    expect(semJuros).not.toBeNull();
    expect(comJuros as number).toBeLessThan(semJuros as number);
  });

  it('devolve zero quando já tem o valor', () => {
    expect(monthsToTarget(100_000, 5_000, 0, 80_000)).toBe(0);
  });

  it('devolve null quando a meta é inalcançável', () => {
    expect(monthsToTarget(0, 0, 0, 100_000)).toBeNull();
  });

  it('devolve null sem meta definida', () => {
    expect(monthsToTarget(0, 10_000, 0, 0)).toBeNull();
  });
});

describe('contributionNeededFor', () => {
  it('sem juros, divide o que falta pelos meses', () => {
    expect(contributionNeededFor(0, 0, 120_000, 12)).toBe(10_000);
  });

  it('com juros, exige aporte menor', () => {
    const semJuros = contributionNeededFor(0, 0, 120_000, 12) ?? 0;
    const comJuros = contributionNeededFor(0, 1200, 120_000, 12) ?? 0;
    expect(comJuros).toBeLessThan(semJuros);
  });

  it('devolve zero quando o saldo já alcança a meta no prazo', () => {
    expect(contributionNeededFor(200_000, 0, 100_000, 12)).toBe(0);
  });

  it('o aporte sugerido realmente bate a meta', () => {
    const needed = contributionNeededFor(50_000, 1065, 500_000, 24) ?? 0;
    const series = projectGoal(50_000, needed, 1065, 500_000, 24, '2026-01');
    expect(series[23].balance).toBeGreaterThanOrEqual(500_000);
  });
});

describe('goalBalance', () => {
  it('soma o inicial com os aportes', () => {
    const result = goalBalance(goal(), 250_000);
    expect(result.balance).toBe(350_000);
    expect(result.remaining).toBe(450_000);
  });

  it('progresso limitado a 1', () => {
    expect(goalBalance(goal(), 900_000).progress).toBe(1);
    expect(goalBalance(goal(), 900_000).remaining).toBe(0);
  });

  it('sem meta, não há progresso', () => {
    expect(goalBalance(goal({ targetAmount: 0 }), 10_000).progress).toBeNull();
  });
});

describe('totalMonthlyContribution', () => {
  it('soma só as caixinhas ativas', () => {
    const total = totalMonthlyContribution([
      goal({ id: 'a', monthlyContribution: 50_000 }),
      goal({ id: 'b', monthlyContribution: 30_000 }),
      goal({ id: 'c', monthlyContribution: 99_000, archived: true }),
    ]);
    expect(total).toBe(80_000);
  });
});

describe('formatRate', () => {
  it('escreve a taxa em porcentagem ao ano', () => {
    expect(formatRate(1065)).toBe('10,65% a.a.');
    expect(formatRate(0)).toBe('0,00% a.a.');
  });
});
