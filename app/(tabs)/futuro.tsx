import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ALL_PROFILES } from '@/domain/types';
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

  const monthlyBalances = useMemo(() => projection.map((month) => month.balance), [projection]);
  const wealth = useGoalProjection(months, monthlyBalances);

  const investing = wealth.monthlyContribution > 0 || wealth.startingInvested > 0;

  const chartPoints = useMemo(
    () => wealth.months.map((month) => ({ competence: month.competence, value: month.invested })),
    [wealth.months],
  );

  const tightMonths = useMemo(
    () =>
      wealth.months.filter(
        (month, index) => month.contributed > 0 && (monthlyBalances[index] ?? 0) < month.contributed,
      ),
    [wealth.months, monthlyBalances],
  );

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

        {loading ? null : !investing ? (
          <EmptyState
            icon="albums-outline"
            title="Nenhuma caixinha ainda"
            description="O Futuro projeta quanto você acumula investindo. Crie uma caixinha com aporte mensal e rendimento para ver a curva."
            actionLabel="Criar caixinha"
            onAction={() => router.push('/goals')}
          />
        ) : (
          <>
            <Card style={styles.heroCard}>
              <View style={styles.contributionRow}>
                <Ionicons name="repeat" size={14} color={colors.brandText} />
                <Text variant="caption" tone="muted">
                  Investindo{' '}
                </Text>
                <Money
                  value={wealth.monthlyContribution}
                  variant="label"
                  color={colors.brandText}
                />
                <Text variant="caption" tone="muted">
                  {' '}
                  por mês
                </Text>
              </View>

              <View>
                <Text variant="label" tone="muted">
                  Em {months} meses você terá
                </Text>
                <Money value={wealth.finalInvested} variant="display" color={colors.brandText} />
              </View>

              <AccumulatedChart points={chartPoints} />

              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text variant="caption" tone="muted">
                    Você aporta
                  </Text>
                  <Money value={wealth.totalContributed} variant="label" />
                </View>

                <View style={styles.breakdownRow}>
                  <View style={styles.yieldLabel}>
                    <Ionicons name="trending-up" size={13} color={colors.positive} />
                    <Text variant="caption" tone="muted">
                      Rende
                    </Text>
                  </View>
                  <Money value={wealth.totalYield} variant="label" color={colors.positive} />
                </View>
              </View>
            </Card>

            {tightMonths.length > 0 ? (
              <Card style={styles.warningCard}>
                <Ionicons name="warning" size={18} color={colors.warning} />
                <Text variant="caption" tone="warning" style={styles.warningText}>
                  {tightMonths.length === 1
                    ? `Em ${formatMonthShort(tightMonths[0].competence)} a sobra do mês não cobre o aporte.`
                    : `Em ${tightMonths.length} meses a sobra não cobre o aporte: ${tightMonths
                        .slice(0, 3)
                        .map((month) => formatMonthShort(month.competence))
                        .join(', ')}${tightMonths.length > 3 ? '…' : ''}`}
                </Text>
              </Card>
            ) : null}

            <SectionHeader title="Mês a mês" />

            <Card padded={false}>
              {wealth.months.map((month, index) => (
                <Pressable
                  key={month.competence}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatMonthShort(month.competence)}, aporte ${formatMoney(
                    month.contributed,
                  )}, rendimento ${formatMoney(month.yield)}, total ${formatMoney(month.invested)}`}
                  onPress={() => goToMonth(month.competence)}
                  style={({ pressed }) => [
                    styles.monthRow,
                    index > 0 ? styles.monthRowBordered : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text variant="body" style={styles.monthLabel}>
                    {formatMonthShort(month.competence)}
                  </Text>

                  <View style={styles.monthValues}>
                    <Money
                      value={month.contributed}
                      variant="caption"
                      color={colors.textMuted}
                      showSign
                    />
                    <Money value={month.yield} variant="caption" color={colors.positive} showSign />
                  </View>

                  <Money value={month.invested} variant="body" color={colors.brandText} />

                  <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
                </Pressable>
              ))}
            </Card>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver caixinhas"
              onPress={() => router.push('/goals')}
              style={styles.goalsLink}
            >
              <Ionicons name="albums-outline" size={14} color={colors.brandText} />
              <Text variant="caption" tone="brand">
                Ajustar aportes e rendimento nas caixinhas
              </Text>
            </Pressable>
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
  heroCard: {
    gap: spacing.lg,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdown: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    width: 64,
  },
  monthValues: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
  goalsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
}));
