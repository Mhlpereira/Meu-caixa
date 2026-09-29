import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ALL_PROFILES } from '@/domain/types';
import type { InstallmentPlan, RecurringPlan } from '@/domain/types';
import { useCommitments } from '@/hooks/useCommitments';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors , useTint } from '@/theme';
import { formatMonthSlash } from '@/utils/date';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Fab } from '@/ui/Fab';
import { Money } from '@/ui/Money';
import { ProfileSwitcher } from '@/ui/ProfileSwitcher';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function CommitmentsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const scope = useAppStore((state) => state.scope);

  const {
    installments,
    fixedExpenses,
    fixedIncome,
    remainingTotal,
    fixedExpenseTotal,
    fixedIncomeTotal,
    loading,
  } = useCommitments();

  const showProfile = scope === ALL_PROFILES;
  const empty = installments.length === 0 && fixedExpenses.length === 0 && fixedIncome.length === 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ProfileSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">Compromissos</Text>

        {loading ? null : empty ? (
          <EmptyState
            icon="repeat-outline"
            title="Nenhum compromisso"
            description="Parcelamentos e gastos fixos aparecem aqui, com quanto falta e quando terminam."
          />
        ) : (
          <>
            {installments.length > 0 ? (
              <>
                <SectionHeader title="Parcelas em aberto" />

                <Card style={styles.totalCard}>
                  <Text variant="label" tone="muted">
                    Total restante
                  </Text>
                  <Money value={remainingTotal} variant="title" color={colors.negative} />
                </Card>

                {installments.map((plan) => (
                  <InstallmentCard key={plan.commitment.id} plan={plan} showProfile={showProfile} />
                ))}
              </>
            ) : null}

            {fixedExpenses.length > 0 ? (
              <>
                <SectionHeader
                  title="Gastos fixos"
                  trailing={
                    <View style={styles.sectionTotal}>
                      <Money value={fixedExpenseTotal} variant="caption" color={colors.negative} />
                      <Text variant="micro" tone="faint">
                        /mês
                      </Text>
                    </View>
                  }
                />
                <Card padded={false}>
                  {fixedExpenses.map((plan, index) => (
                    <RecurringRow
                      key={plan.commitment.id}
                      plan={plan}
                      showProfile={showProfile}
                      bordered={index > 0}
                    />
                  ))}
                </Card>
              </>
            ) : null}

            {fixedIncome.length > 0 ? (
              <>
                <SectionHeader
                  title="Rendas"
                  trailing={
                    <View style={styles.sectionTotal}>
                      <Money value={fixedIncomeTotal} variant="caption" color={colors.positive} />
                      <Text variant="micro" tone="faint">
                        /mês
                      </Text>
                    </View>
                  }
                />
                <Card padded={false}>
                  {fixedIncome.map((plan, index) => (
                    <RecurringRow
                      key={plan.commitment.id}
                      plan={plan}
                      showProfile={showProfile}
                      bordered={index > 0}
                      positive
                    />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {scope === ALL_PROFILES ? null : <Fab onPress={() => router.push('/entry')} />}
    </Screen>
  );
}

function InstallmentCard({ plan, showProfile }: { plan: InstallmentPlan; showProfile: boolean }) {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const { commitment } = plan;
  const ratio = plan.totalCount > 0 ? plan.paidCount / plan.totalCount : 0;
  const iconColor = plan.categoryColor ?? colors.textMuted;
  const iconName = (plan.categoryIcon ?? 'pricetag') as keyof typeof Ionicons.glyphMap;

  return (
    <Card style={styles.installmentCard}>
      <View style={styles.installmentHeader}>
        <View style={[styles.icon, { backgroundColor: tint(iconColor) }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>

        <View style={styles.installmentTitle}>
          <Text variant="body" numberOfLines={1}>
            {commitment.description}
          </Text>
          <View style={styles.metaRow}>
            <Text variant="caption" tone="faint">
              {plan.paidCount}/{plan.totalCount} · termina em {formatMonthSlash(plan.lastCompetence)}
            </Text>
            {showProfile ? (
              <View style={styles.metaItem}>
                <View style={[styles.dot, { backgroundColor: plan.profileColor }]} />
                <Text variant="caption" tone="faint">
                  {plan.profileName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ProgressBar ratio={ratio} color={iconColor} />

      <View style={styles.installmentFooter}>
        <Text variant="caption" tone="faint">
          {`parcela de `}
        </Text>
        <Money value={commitment.amount} variant="caption" color={colors.textMuted} />
        <View style={styles.spacer} />
        <Text variant="caption" tone="faint">
          restam{' '}
        </Text>
        <Money value={plan.remainingAmount} variant="label" color={colors.negative} />
      </View>
    </Card>
  );
}

function RecurringRow({
  plan,
  showProfile,
  bordered,
  positive = false,
}: {
  plan: RecurringPlan;
  showProfile: boolean;
  bordered: boolean;
  positive?: boolean;
}) {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const { commitment } = plan;
  const iconColor = plan.categoryColor ?? colors.textMuted;
  const iconName = (plan.categoryIcon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <View style={[styles.recurringRow, bordered ? styles.bordered : null]}>
      <View style={[styles.iconSmall, { backgroundColor: tint(iconColor) }]}>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>

      <View style={styles.recurringTitle}>
        <Text variant="body" numberOfLines={1}>
          {commitment.description}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="caption" tone="faint">
            {commitment.dayOfMonth ? `dia ${commitment.dayOfMonth}` : 'mensal'}
            {commitment.endDate ? ` · até ${formatMonthSlash(commitment.endDate.slice(0, 7))}` : ''}
          </Text>
          {showProfile ? (
            <View style={styles.metaItem}>
              <View style={[styles.dot, { backgroundColor: plan.profileColor }]} />
              <Text variant="caption" tone="faint">
                {plan.profileName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Money
        value={commitment.amount}
        variant="body"
        color={positive ? colors.positive : colors.text}
      />
    </View>
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
    gap: spacing.md,
  },
  totalCard: {
    gap: spacing.xs,
  },
  sectionTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  installmentCard: {
    gap: spacing.md,
  },
  installmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  installmentTitle: {
    flex: 1,
    gap: 3,
  },
  installmentFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spacer: {
    flex: 1,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSmall: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  recurringTitle: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
}));
