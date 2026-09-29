import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  checkDeadline,
  contributionNeededFor,
  formatRate,
  monthsToTarget,
  type Goal,
  type GoalBalance,
} from '@/domain/goals';
import { ALL_PROFILES } from '@/domain/types';
import {
  createGoal,
  deleteGoal,
  listGoalBalances,
  updateGoal,
} from '@/repositories/goals';
import { useAppStore } from '@/stores/app';
import { makeStyles, palette, radius, spacing, useColors , useTint } from '@/theme';
import {
  addMonths,
  currentCompetence,
  dueDateIn,
  formatMonthSlash,
  type ISODate,
} from '@/utils/date';
import { appendDigit, formatMoney, removeDigit } from '@/utils/money';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Input } from '@/ui/Field';
import { Keypad } from '@/ui/Keypad';
import { Money } from '@/ui/Money';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { DateField } from '@/ui/DateField';
import { Segmented } from '@/ui/Segmented';
import { Sheet, SheetOption } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'airplane',
  'home',
  'car',
  'school',
  'medkit',
  'gift',
  'shield-checkmark',
  'boat',
  'desktop',
  'heart',
  'trending-up',
  'cash',
];

const RATE_PRESETS = [
  { label: 'Parado', bp: 0 },
  { label: 'Poupança', bp: 617 },
  { label: 'CDI', bp: 1065 },
  { label: 'CDI + 2%', bp: 1265 },
];

type AmountField = 'target' | 'contribution' | 'initial';

const AMOUNT_LABELS: Record<AmountField, string> = {
  target: 'Quanto quero juntar',
  contribution: 'Quanto ponho por mês',
  initial: 'Quanto já tenho',
};

export default function GoalsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const profiles = useAppStore((state) => state.profiles);
  const scope = useAppStore((state) => state.scope);
  const revision = useAppStore((state) => state.revision);
  const refreshGoals = useAppStore((state) => state.refreshGoals);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [balances, setBalances] = useState<GoalBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<keyof typeof Ionicons.glyphMap>('airplane');
  const [color, setColor] = useState<string>(palette[0]);
  const [targetAmount, setTargetAmount] = useState(0);
  const [contribution, setContribution] = useState(0);
  const [initialAmount, setInitialAmount] = useState(0);
  const [rateBp, setRateBp] = useState(1065);
  const [profileId, setProfileId] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [targetDate, setTargetDate] = useState<ISODate>(() =>
    dueDateIn(addMonths(currentCompetence(), 12), 1),
  );
  const [activeField, setActiveField] = useState<AmountField>('target');
  const [profileSheet, setProfileSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setBalances(await listGoalBalances(scope));
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load, revision]);

  const defaultProfile = scope === ALL_PROFILES ? (profiles[0]?.id ?? '') : scope;

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIcon('airplane');
    setColor(palette[balances.length % palette.length]);
    setTargetAmount(0);
    setContribution(0);
    setInitialAmount(0);
    setRateBp(1065);
    setHasDeadline(false);
    setTargetDate(dueDateIn(addMonths(currentCompetence(), 12), 1));
    setProfileId(defaultProfile);
    setActiveField('target');
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setName(goal.name);
    setIcon(goal.icon as keyof typeof Ionicons.glyphMap);
    setColor(goal.color);
    setTargetAmount(goal.targetAmount);
    setContribution(goal.monthlyContribution);
    setInitialAmount(goal.initialAmount);
    setRateBp(goal.annualRateBp);
    setHasDeadline(goal.targetDate !== null);
    if (goal.targetDate) setTargetDate(goal.targetDate);
    setProfileId(goal.profileId);
    setActiveField('target');
    setError(null);
    setFormOpen(true);
  };

  const amountValue =
    activeField === 'target' ? targetAmount : activeField === 'contribution' ? contribution : initialAmount;

  const setAmountValue = (next: (current: number) => number) => {
    if (activeField === 'target') setTargetAmount(next);
    else if (activeField === 'contribution') setContribution(next);
    else setInitialAmount(next);
  };

  const months = monthsToTarget(initialAmount, contribution, rateBp, targetAmount);
  const suggested = contributionNeededFor(initialAmount, rateBp, targetAmount, 12);
  const deadline = hasDeadline
    ? checkDeadline(initialAmount, contribution, rateBp, targetAmount, targetDate, currentCompetence())
    : null;

  const save = async () => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError('Dê um nome à caixinha');
      return;
    }
    if (!profileId) {
      setError('Escolha um perfil');
      return;
    }

    setSaving(true);

    const input = {
      profileId,
      name: trimmed,
      icon,
      color,
      targetAmount,
      monthlyContribution: contribution,
      annualRateBp: rateBp,
      initialAmount,
      targetDate: hasDeadline ? targetDate : null,
    };

    if (editing) await updateGoal(editing.id, input);
    else await createGoal(input);

    await refreshGoals();
    bumpRevision();
    setSaving(false);
    setFormOpen(false);
  };

  const remove = (goal: Goal) => {
    Alert.alert(
      `Excluir ${goal.name}`,
      'Os aportes que você já lançou continuam no app, apenas deixam de pertencer a essa caixinha.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteGoal(goal.id);
            await refreshGoals();
            bumpRevision();
          },
        },
      ],
    );
  };

  const selectedProfile = profiles.find((profile) => profile.id === profileId);

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.back()}
          style={styles.topButton}
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
        <Text variant="heading">Caixinhas</Text>
        <View style={styles.topButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? null : balances.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="Nenhuma caixinha"
            description="Separe seu dinheiro por objetivo — viagem, reserva, carro — com meta, aporte mensal e rendimento esperado."
            actionLabel="Criar a primeira"
            onAction={openCreate}
          />
        ) : (
          balances.map((item) => (
            <GoalCard
              key={item.goal.id}
              item={item}
              onEdit={() => openEdit(item.goal)}
              onDelete={() => remove(item.goal)}
            />
          ))
        )}

        {balances.length > 0 ? (
          <Button label="Nova caixinha" icon="add" onPress={openCreate} variant="secondary" fullWidth />
        ) : null}
      </ScrollView>

      <Sheet
        visible={formOpen}
        title={editing ? 'Editar caixinha' : 'Nova caixinha'}
        onClose={() => setFormOpen(false)}
      >
        <View style={styles.form}>
          <Field label="Nome" error={error ?? undefined}>
            <Input
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder="Viagem, reserva de emergência…"
              maxLength={30}
              invalid={Boolean(error)}
            />
          </Field>

          <Segmented
            value={activeField}
            onChange={setActiveField}
            options={[
              { value: 'target', label: 'Meta' },
              { value: 'contribution', label: 'Por mês' },
              { value: 'initial', label: 'Já tenho' },
            ]}
          />

          <View style={styles.amountBox}>
            <Text variant="caption" tone="faint">
              {AMOUNT_LABELS[activeField]}
            </Text>
            <Money
              value={amountValue}
              variant="display"
              color={amountValue > 0 ? colors.text : colors.textFaint}
            />
          </View>

          <Keypad
            compact
            onDigit={(digit) => setAmountValue((current) => appendDigit(current, digit))}
            onBackspace={() => setAmountValue(removeDigit)}
          />

          <Field label="Rendimento esperado" hint="Usado só para projetar. Não muda seus lançamentos.">
            <View style={styles.rateRow}>
              {RATE_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                  accessibilityState={{ selected: rateBp === preset.bp }}
                  onPress={() => setRateBp(preset.bp)}
                  style={[styles.ratePill, rateBp === preset.bp ? styles.ratePillActive : null]}
                >
                  <Text variant="micro" tone={rateBp === preset.bp ? 'brand' : 'muted'}>
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              value={(rateBp / 100).toFixed(2).replace('.', ',')}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                setRateBp(Number(digits) || 0);
              }}
              keyboardType="number-pad"
              placeholder="10,65"
            />
            <Text variant="caption" tone="faint">
              {formatRate(rateBp)}
            </Text>
          </Field>

          {targetAmount > 0 ? (
            <View style={styles.preview}>
              {months === null ? (
                <Text variant="caption" tone="warning">
                  Com esse aporte e esse rendimento, a meta não é alcançada.
                  {suggested && suggested > 0
                    ? ` Para bater em 12 meses seriam ${formatMoney(suggested)} por mês.`
                    : ''}
                </Text>
              ) : months === 0 ? (
                <Text variant="caption" tone="positive">
                  Você já tem o valor da meta.
                </Text>
              ) : (
                <Text variant="caption" tone="muted">
                  Você bate a meta em{' '}
                  <Text variant="caption" tone="brand">
                    {months} {months === 1 ? 'mês' : 'meses'}
                  </Text>
                  , por volta de {formatMonthSlash(addMonths(currentCompetence(), months))}.
                </Text>
              )}
            </View>
          ) : null}

          <Field label="Prazo">
            <Segmented
              value={hasDeadline ? 'until' : 'open'}
              onChange={(value) => setHasDeadline(value === 'until')}
              options={[
                { value: 'open', label: 'Sem prazo' },
                { value: 'until', label: 'Até uma data' },
              ]}
            />
            {hasDeadline ? (
              <DateField value={targetDate} onChange={setTargetDate} label="Data limite" />
            ) : null}
          </Field>

          {deadline ? (
            <View
              style={[
                styles.preview,
                { backgroundColor: deadline.onTrack ? colors.positiveDim : colors.warningDim },
              ]}
            >
              {deadline.onTrack ? (
                <Text variant="caption" tone="positive">
                  Com {formatMoney(contribution)} por mês você bate a meta em{' '}
                  {deadline.months} {deadline.months === 1 ? 'mês' : 'meses'}, dentro do prazo.
                </Text>
              ) : (
                <Text variant="caption" tone="warning">
                  Para bater até lá seriam {formatMoney(deadline.needed)} por mês —{' '}
                  {formatMoney(deadline.shortfall)} a mais do que você está pondo.
                </Text>
              )}
            </View>
          ) : null}

          <Field label="Perfil">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Perfil ${selectedProfile?.name ?? 'não escolhido'}`}
              onPress={() => setProfileSheet(true)}
              style={styles.profileRow}
            >
              <View style={[styles.dot, { backgroundColor: selectedProfile?.color ?? colors.border }]} />
              <Text variant="body" tone={selectedProfile ? 'default' : 'faint'}>
                {selectedProfile?.name ?? 'Escolher perfil'}
              </Text>
              <View style={styles.grow} />
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          </Field>

          <Field label="Ícone">
            <View style={styles.swatches}>
              {ICONS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Ícone ${option}`}
                  accessibilityState={{ selected: icon === option }}
                  onPress={() => setIcon(option)}
                  style={[styles.iconOption, icon === option ? styles.iconOptionSelected : null]}
                >
                  <Ionicons name={option} size={17} color={icon === option ? color : colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Cor">
            <View style={styles.swatches}>
              {palette.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Cor ${option}`}
                  accessibilityState={{ selected: color === option }}
                  onPress={() => setColor(option)}
                  style={[
                    styles.swatch,
                    { backgroundColor: option },
                    color === option ? styles.swatchSelected : null,
                  ]}
                >
                  {color === option ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
          </Field>

          <Button
            label={editing ? 'Salvar' : 'Criar caixinha'}
            onPress={save}
            size="lg"
            fullWidth
            loading={saving}
          />
        </View>
      </Sheet>

      <Sheet visible={profileSheet} title="Perfil" onClose={() => setProfileSheet(false)}>
        {profiles.map((profile) => (
          <SheetOption
            key={profile.id}
            label={profile.name}
            icon={profile.icon as keyof typeof Ionicons.glyphMap}
            iconColor={profile.color}
            selected={profileId === profile.id}
            onPress={() => {
              setProfileId(profile.id);
              setProfileSheet(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function GoalCard({
  item,
  onEdit,
  onDelete,
}: {
  item: GoalBalance;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const { goal } = item;
  const months = monthsToTarget(item.balance, goal.monthlyContribution, goal.annualRateBp, goal.targetAmount);

  return (
    <Card style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalIcon, { backgroundColor: tint(goal.color) }]}>
          <Ionicons name={goal.icon as keyof typeof Ionicons.glyphMap} size={20} color={goal.color} />
        </View>

        <View style={styles.grow}>
          <Text variant="body">{goal.name}</Text>
          <Text variant="caption" tone="faint">
            {goal.monthlyContribution > 0
              ? `${formatMoney(goal.monthlyContribution)}/mês · ${formatRate(goal.annualRateBp)}`
              : formatRate(goal.annualRateBp)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar ${goal.name}`}
          onPress={onEdit}
          style={styles.goalAction}
        >
          <Ionicons name="pencil" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${goal.name}`}
          onPress={onDelete}
          style={styles.goalAction}
        >
          <Ionicons name="trash-outline" size={16} color={colors.negative} />
        </Pressable>
      </View>

      <View style={styles.goalAmounts}>
        <Money value={item.balance} variant="title" color={goal.color} />
        {goal.targetAmount > 0 ? (
          <Text variant="caption" tone="faint">
            de {formatMoney(goal.targetAmount)}
          </Text>
        ) : null}
      </View>

      {goal.targetAmount > 0 ? (
        <>
          <ProgressBar ratio={item.progress ?? 0} color={goal.color} />
          {goal.targetDate ? (
            <View style={styles.goalFooter}>
              <Ionicons name="time-outline" size={12} color={colors.textFaint} />
              <Text variant="caption" tone="faint">
                {' '}
                até {formatMonthSlash(goal.targetDate.slice(0, 7))}
              </Text>
            </View>
          ) : null}

          <View style={styles.goalFooter}>
            {item.remaining > 0 ? (
              <>
                <Text variant="caption" tone="muted">
                  Faltam{' '}
                </Text>
                <Money value={item.remaining} variant="caption" color={colors.textMuted} />
                {months !== null && months > 0 ? (
                  <Text variant="caption" tone="muted">
                    {' '}
                    · {months} {months === 1 ? 'mês' : 'meses'}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={13} color={colors.positive} />
                <Text variant="caption" tone="positive">
                  {' '}
                  Meta alcançada
                </Text>
              </>
            )}
          </View>
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  amountBox: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ratePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  ratePillActive: {
    backgroundColor: colors.brandDim,
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  grow: {
    flex: 1,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalCard: {
    gap: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  goalIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
}));
