import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useGoalProjection } from '@/hooks/useGoalProjection';
import { useProjection } from '@/hooks/useProjection';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import { formatMonthShort } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { AccumulatedChart } from '@/ui/AccumulatedChart';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Fab } from '@/ui/Fab';
import { Money } from '@/ui/Money';
import { ProfileSwitcher } from '@/ui/ProfileSwitcher';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Sheet, SheetOption } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { ALL_PROFILES } from '@/domain/types';

const RANGES = [6, 12, 24, 36];

export default function FutureScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const setCompetence = useAppStore((state) => state.setCompetence);
  const scope = useAppStore((state) => state.scope);

  const [months, setMonths] = useState(12);
  const [rangeOpen, setRangeOpen] = useState(false);

  const { projection, loading } = useProjection(months);

  const monthlyBalances = useMemo(
    () => projection.map((month) => month.balance),
    [projection],
  );
  const wealth = useGoalProjection(months, monthlyBalances);

  const final = projection[projection.length - 1];
  const hasData = projection.some((month) => month.income !== 0 || month.expense !== 0);
  const negativeMonths = projection.filter((month) => month.balance < 0);

  const goToMonth = (competence: string) => {
    setCompetence(competence);
    router.navigate('/(tabs)');
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ProfileSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text variant="title">Futuro</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Período: ${months} meses`}
            onPress={() => setRangeOpen(true)}
            style={styles.rangeChip}
          >
            <Text variant="micro" tone="muted">
              {months} meses
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
          </Pressable>
        </View>

        {loading ? null : !hasData ? (
          <EmptyState
            icon="trending-up-outline"
            title="Sem projeção ainda"
            description="Cadastre sua renda e seus gastos fixos para ver quanto você junta nos próximos meses."
          />
        ) : (
          <>
            <Card style={styles.chartCard}>
              <View>
                <Text variant="label" tone="muted">
                  Em {months} meses
                </Text>
                <Money
                  value={
                    wealth.monthlyContribution > 0 || wealth.startingInvested > 0
                      ? wealth.finalInvested + wealth.finalFreeCash
                      : (final?.accumulated ?? 0)
                  }
                  variant="title"
                  colorBySign
                  showSign
                />
              </View>

              <AccumulatedChart projection={projection} onSelectMonth={() => undefined} />

              {wealth.monthlyContribution > 0 || wealth.startingInvested > 0 ? (
                <View style={styles.wealthBreakdown}>
                  <View style={styles.wealthRow}>
                    <View style={styles.wealthLabel}>
                      <Ionicons name="albums" size={13} color={colors.brandText} />
                      <Text variant="caption" tone="muted">
                        Nas caixinhas
                      </Text>
                    </View>
                    <Money value={wealth.finalInvested} variant="label" color={colors.brandText} />
                  </View>

                  <View style={styles.wealthRow}>
                    <View style={styles.wealthLabel}>
                      <Ionicons name="trending-up" size={13} color={colors.positive} />
                      <Text variant="caption" tone="muted">
                        Disso, rendimento
                      </Text>
                    </View>
                    <Money value={wealth.totalYield} variant="caption" color={colors.positive} />
                  </View>

                  <View style={styles.wealthRow}>
                    <View style={styles.wealthLabel}>
                      <Ionicons name="wallet-outline" size={13} color={colors.textMuted} />
                      <Text variant="caption" tone="muted">
                        Sobra na conta
                      </Text>
                    </View>
                    <Money
                      value={wealth.finalFreeCash}
                      variant="caption"
                      colorBySign
                    />
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Criar uma caixinha"
                  onPress={() => router.push('/goals')}
                  style={styles.goalsHint}
                >
                  <Ionicons name="albums-outline" size={14} color={colors.brandText} />
                  <Text variant="caption" tone="brand" style={styles.goalsHintText}>
                    Crie uma caixinha para projetar com rendimento, em vez de somar toda a sobra
                  </Text>
                </Pressable>
              )}
            </Card>

            {negativeMonths.length > 0 ? (
              <Card style={styles.warningCard}>
                <Ionicons name="warning" size={18} color={colors.warning} />
                <Text variant="caption" tone="warning" style={styles.warningText}>
                  {negativeMonths.length === 1
                    ? `${formatMonthShort(negativeMonths[0].competence)} fecha no vermelho.`
                    : `${negativeMonths.length} meses fecham no vermelho: ${negativeMonths
                        .slice(0, 3)
                        .map((month) => formatMonthShort(month.competence))
                        .join(', ')}${negativeMonths.length > 3 ? '…' : ''}`}
                </Text>
              </Card>
            ) : null}

            <SectionHeader title="Mês a mês" />

            <Card padded={false}>
              {projection.map((month, index) => (
                <Pressable
                  key={month.competence}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatMonthShort(month.competence)}, saldo ${formatMoney(
                    month.balance,
                  )}, acumulado ${formatMoney(month.accumulated)}`}
                  onPress={() => goToMonth(month.competence)}
                  style={({ pressed }) => [
                    styles.monthRow,
                    index > 0 ? styles.monthRowBordered : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.monthLabel}>
                    {month.balance < 0 ? (
                      <Ionicons name="alert-circle" size={14} color={colors.negative} />
                    ) : null}
                    <Text variant="body">{formatMonthShort(month.competence)}</Text>
                  </View>

                  <View style={styles.monthValues}>
                    <Money value={month.balance} variant="body" colorBySign showSign />
                    <Text variant="micro" tone="faint">
                      acum.
                    </Text>
                    <Money value={month.accumulated} variant="caption" color={colors.textMuted} />
                  </View>

                  <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {scope === ALL_PROFILES ? null : <Fab onPress={() => router.push('/entry')} />}

      <Sheet visible={rangeOpen} title="Período" onClose={() => setRangeOpen(false)}>
        {RANGES.map((range) => (
          <SheetOption
            key={range}
            label={`${range} meses`}
            selected={months === range}
            onPress={() => {
              setMonths(range);
              setRangeOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chartCard: {
    gap: spacing.lg,
  },
  wealthBreakdown: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  wealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wealthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandDim,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  goalsHintText: {
    flex: 1,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningDim,
    borderColor: 'transparent',
  },
  warningText: {
    flex: 1,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  monthRowBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 84,
  },
  monthValues: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
}));
