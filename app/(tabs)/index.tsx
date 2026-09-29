import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { canAffordGoal, investmentProgress, spentRatio } from '@/domain/calc';
import type { OccurrenceView } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { useMonth, type MonthFilter } from '@/hooks/useMonth';
import { deleteCommitment, extendRecurringHorizon } from '@/repositories/commitments';
import { deleteOccurrence, togglePaid } from '@/repositories/occurrences';
import { useAppStore } from '@/stores/app';
import { balanceColor, makeStyles, radius, spacing, useColors } from '@/theme';
import { currentCompetence, formatDayHeader, formatMonthLong } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Fab } from '@/ui/Fab';
import { Money } from '@/ui/Money';
import { MonthNav } from '@/ui/MonthNav';
import { OccurrenceRow } from '@/ui/OccurrenceRow';
import { ProfileSwitcher } from '@/ui/ProfileSwitcher';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Sheet, SheetOption } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const FILTER_LABELS: Record<MonthFilter, string> = {
  all: 'todos',
  pending: 'a pagar',
  paid: 'pagos',
};

export default function MonthScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const competence = useAppStore((state) => state.competence);
  const setCompetence = useAppStore((state) => state.setCompetence);
  const scope = useAppStore((state) => state.scope);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [filter, setFilter] = useState<MonthFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { groups, summary, occurrences, loading } = useMonth(filter);

  const isFuture = competence > currentCompetence();
  const isPast = competence < currentCompetence();
  const showProfile = scope === ALL_PROFILES;

  const handleRefresh = async () => {
    setRefreshing(true);
    await extendRecurringHorizon();
    bumpRevision();
    setRefreshing(false);
  };

  const handleTogglePaid = async (occurrence: OccurrenceView) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await togglePaid(occurrence.id);
    bumpRevision();
  };

  const handleDelete = (occurrence: OccurrenceView) => {
    const isSeries = occurrence.commitmentType !== 'single';

    Alert.alert(
      'Excluir lançamento',
      isSeries
        ? `"${occurrence.description}" faz parte de uma série. O que você quer excluir?`
        : `Excluir "${occurrence.description}"?`,
      isSeries
        ? [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Só este mês',
              onPress: async () => {
                await deleteOccurrence(occurrence.id);
                bumpRevision();
              },
            },
            {
              text: 'A série toda',
              style: 'destructive',
              onPress: async () => {
                await deleteCommitment(occurrence.commitmentId);
                bumpRevision();
              },
            },
          ]
        : [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: async () => {
                await deleteCommitment(occurrence.commitmentId);
                bumpRevision();
              },
            },
          ],
    );
  };

  const openNewEntry = () => {
    if (scope === ALL_PROFILES) {
      Alert.alert(
        'Escolha um perfil',
        'Todo lançamento pertence a um perfil. Selecione Pessoal ou Empresa antes de adicionar.',
      );
      return;
    }
    router.push('/entry');
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ProfileSwitcher onOpenSettings={() => router.navigate('/(tabs)/ajustes')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        <MonthNav competence={competence} onChange={setCompetence} />

        <Card style={styles.balanceCard}>
          <Text variant="label" tone="muted">
            {isFuture ? 'Saldo previsto' : isPast ? 'Saldo do mês' : 'Saldo deste mês'}
          </Text>

          <Money
            value={summary.balancePlanned}
            variant="display"
            colorBySign
            showSign
            accessibilityLabel={`Saldo de ${formatMonthLong(competence)}`}
          />

          <View style={styles.totals}>
            <View style={styles.totalItem}>
              <Text variant="caption" tone="faint">
                Entradas
              </Text>
              <Money value={summary.incomePlanned} variant="label" color={colors.positive} />
            </View>
            <View style={styles.totalItem}>
              <Text variant="caption" tone="faint">
                Saídas
              </Text>
              <Money value={summary.expensePlanned} variant="label" color={colors.negative} />
            </View>
          </View>

          <ProgressBar
            ratio={spentRatio(summary)}
            color={summary.balancePlanned >= 0 ? colors.brand : colors.negative}
          />

          {isPast || !isFuture ? (
            <View style={styles.actualRow}>
              <Text variant="caption" tone="faint">
                Já realizado
              </Text>
              <Money
                value={summary.balanceActual}
                variant="caption"
                color={balanceColor(summary.balanceActual, colors)}
              />
            </View>
          ) : null}
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text variant="caption" tone="faint">
              Comprometido
            </Text>
            <Money value={summary.committed} variant="heading" />
            <Text variant="micro" tone="muted">
              {summary.incomePlanned > 0
                ? `${Math.round((summary.committed / summary.incomePlanned) * 100)}% do que entra`
                : 'fixos, parcelas e aportes'}
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Text variant="caption" tone="faint">
              Livre
            </Text>
            <Money value={summary.free} variant="heading" colorBySign />
            <Text variant="micro" tone="muted">
              depois dos fixos
            </Text>
          </Card>
        </View>

        {summary.investmentGoal > 0 || summary.investmentActual > 0 ? (
          <Card style={styles.investCard}>
            <View style={styles.investHeader}>
              <View style={styles.investTitle}>
                <Ionicons name="trending-up" size={16} color={colors.brandText} />
                <Text variant="label" tone="muted">
                  Investimento
                </Text>
              </View>
              {summary.investmentGoal > 0 ? (
                <Text variant="micro" tone="faint">
                  meta {formatMoney(summary.investmentGoal)}
                </Text>
              ) : null}
            </View>

            <View style={styles.investAmounts}>
              <Money value={summary.investmentActual} variant="title" color={colors.brandText} />
              {summary.investmentGoal > 0 ? (
                <Text variant="caption" tone="faint">
                  {Math.round((investmentProgress(summary) ?? 0) * 100)}% da meta
                </Text>
              ) : null}
            </View>

            {summary.investmentGoal > 0 ? (
              <>
                <ProgressBar
                  ratio={investmentProgress(summary) ?? 0}
                  color={colors.brand}
                />

                <View style={styles.investFooter}>
                  {summary.investmentGap > 0 ? (
                    <>
                      <Text variant="caption" tone="muted">
                        Faltam{' '}
                      </Text>
                      <Money
                        value={summary.investmentGap}
                        variant="caption"
                        color={canAffordGoal(summary) ? colors.warning : colors.negative}
                      />
                      <Text variant="caption" tone="muted">
                        {canAffordGoal(summary)
                          ? ' — a sobra do mês cobre'
                          : ' — a sobra do mês não cobre'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={13} color={colors.positive} />
                      <Text variant="caption" tone="positive">
                        {' '}
                        Meta batida este mês
                      </Text>
                    </>
                  )}
                </View>
              </>
            ) : null}

            {summary.investmentPlanned > summary.investmentActual ? (
              <View style={styles.investFooter}>
                <Text variant="caption" tone="faint">
                  Previsto no mês{' '}
                </Text>
                <Money
                  value={summary.investmentPlanned}
                  variant="caption"
                  color={colors.textFaint}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        <SectionHeader
          title="Lançamentos"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filtro: ${FILTER_LABELS[filter]}`}
              onPress={() => setFilterOpen(true)}
              style={styles.filterChip}
            >
              <Text variant="micro" tone="muted">
                {FILTER_LABELS[filter]}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </Pressable>
          }
        />

        {loading ? null : groups.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={
              occurrences.length === 0
                ? `Nada em ${formatMonthLong(competence)}`
                : 'Nada com esse filtro'
            }
            description={
              occurrences.length === 0
                ? 'Cadastre uma compra, um gasto fixo ou uma renda para começar.'
                : undefined
            }
            actionLabel={occurrences.length === 0 ? 'Adicionar lançamento' : undefined}
            onAction={occurrences.length === 0 ? openNewEntry : undefined}
          />
        ) : (
          groups.map((group) => (
            <View key={group.dueDate} style={styles.group}>
              <Text variant="micro" tone="faint" style={styles.groupHeader}>
                {formatDayHeader(group.dueDate).toUpperCase()}
              </Text>

              {group.items.map((occurrence) => (
                <OccurrenceRow
                  key={occurrence.id}
                  occurrence={occurrence}
                  showProfile={showProfile}
                  onPress={(item) => router.push(`/occurrence/${item.id}`)}
                  onTogglePaid={handleTogglePaid}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Fab onPress={openNewEntry} />

      <Sheet visible={filterOpen} title="Mostrar" onClose={() => setFilterOpen(false)}>
        {(Object.keys(FILTER_LABELS) as MonthFilter[]).map((option) => (
          <SheetOption
            key={option}
            label={FILTER_LABELS[option]}
            selected={filter === option}
            onPress={() => {
              setFilter(option);
              setFilterOpen(false);
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
  balanceCard: {
    gap: spacing.md,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalItem: {
    gap: 2,
  },
  actualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    paddingLeft: spacing.xs,
  },
  investCard: {
    gap: spacing.md,
  },
  investHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  investTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  investAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  investFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
}));
