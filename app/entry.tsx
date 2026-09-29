import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import type { CommitmentInput, CommitmentType, Kind } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import {
  createCommitment,
  getCommitment,
  updateCommitment,
} from '@/repositories/commitments';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import {
  addMonths,
  competenceOf,
  dueDateIn,
  formatMonthLong,
  formatMonthSlash,
  parseISODate,
  todayISO,
  type Competence,
  type ISODate,
} from '@/utils/date';
import {
  appendDigit,
  formatMoney,
  installmentOf,
  removeDigit,
  totalOf,
} from '@/utils/money';
import { Button } from '@/ui/Button';
import { DateField } from '@/ui/DateField';
import { Field, Input, Select } from '@/ui/Field';
import { Keypad } from '@/ui/Keypad';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Sheet, SheetOption } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const MAX_INSTALLMENTS = 120;

type AmountMode = 'installment' | 'total';

function defaultStartDate(competence: Competence): ISODate {
  const today = todayISO();
  if (competenceOf(today) === competence) return today;
  return dueDateIn(competence, parseISODate(today).day);
}

export default function EntryScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' ? params.id : null;

  const profiles = useAppStore((state) => state.profiles);
  const categories = useAppStore((state) => state.categories);
  const goals = useAppStore((state) => state.goals);
  const scope = useAppStore((state) => state.scope);
  const competence = useAppStore((state) => state.competence);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [kind, setKind] = useState<Kind>('expense');
  const [type, setType] = useState<CommitmentType>('single');
  const [amount, setAmount] = useState(0);
  const [amountMode, setAmountMode] = useState<AmountMode>('installment');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>(
    scope === ALL_PROFILES ? (profiles[0]?.id ?? '') : scope,
  );
  const [installments, setInstallments] = useState('2');
  const [startDate, setStartDate] = useState<ISODate>(() => defaultStartDate(competence));
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState<ISODate>(() => dueDateIn(addMonths(competence, 11), 1));
  const [notes, setNotes] = useState('');
  const [isInvestment, setIsInvestment] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);

  const [categorySheet, setCategorySheet] = useState(false);
  const [profileSheet, setProfileSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!editingId);

  useEffect(() => {
    if (!editingId) return;

    getCommitment(editingId).then((commitment) => {
      if (!commitment) {
        setLoaded(true);
        return;
      }

      setKind(commitment.kind);
      setType(commitment.type);
      setAmount(commitment.amount);
      setDescription(commitment.description);
      setCategoryId(commitment.categoryId);
      setProfileId(commitment.profileId);
      setInstallments(String(commitment.installments ?? 2));
      setStartDate(commitment.startDate);
      setDayOfMonth(String(commitment.dayOfMonth ?? parseISODate(commitment.startDate).day));
      setHasEndDate(commitment.endDate !== null);
      if (commitment.endDate) setEndDate(commitment.endDate);
      setNotes(commitment.notes ?? '');
      setIsInvestment(commitment.isInvestment);
      setGoalId(commitment.goalId);
      setLoaded(true);
    });
  }, [editingId]);

  useEffect(() => {
    if (kind === 'income' && isInvestment) setIsInvestment(false);
    if (!isInvestment && goalId !== null) setGoalId(null);
  }, [kind, isInvestment, goalId]);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  );

  const selectedCategory = availableCategories.find((category) => category.id === categoryId);
  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  const availableGoals = goals.filter((goal) => goal.profileId === profileId);
  const selectedGoal = availableGoals.find((goal) => goal.id === goalId);

  useEffect(() => {
    if (categoryId && !availableCategories.some((category) => category.id === categoryId)) {
      setCategoryId(null);
    }
  }, [availableCategories, categoryId]);

  const installmentCount = Math.max(2, Math.min(Number(installments) || 2, MAX_INSTALLMENTS));

  const perInstallment =
    amountMode === 'total' ? installmentOf(amount, installmentCount) : amount;
  const totalAmount = amountMode === 'total' ? amount : totalOf(amount, installmentCount);
  const lastCompetence = addMonths(competenceOf(startDate), installmentCount - 1);

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (description.trim().length === 0) next.description = 'Dê um nome para esse lançamento';
    if (amount <= 0) next.amount = 'O valor precisa ser maior que zero';
    if (!profileId) next.profile = 'Escolha um perfil';

    if (type === 'installment') {
      const parsed = Number(installments);
      if (!Number.isFinite(parsed) || parsed < 2) {
        next.installments = 'Parcelado precisa de pelo menos 2 parcelas';
      } else if (parsed > MAX_INSTALLMENTS) {
        next.installments = `No máximo ${MAX_INSTALLMENTS} parcelas`;
      }
    }

    if (type === 'recurring' && hasEndDate && endDate < startDate) {
      next.endDate = 'A data final vem antes da inicial';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);

    const day = Math.max(1, Math.min(Number(dayOfMonth) || 1, 31));

    const input: CommitmentInput = {
      profileId,
      categoryId,
      kind,
      type,
      description,
      amount: type === 'installment' ? perInstallment : amount,
      installments: type === 'installment' ? installmentCount : null,
      startDate: type === 'recurring' ? dueDateIn(competenceOf(startDate), day) : startDate,
      endDate: type === 'recurring' && hasEndDate ? endDate : null,
      dayOfMonth: type === 'recurring' ? day : null,
      notes: notes.trim() || null,
      isInvestment,
      goalId: isInvestment ? goalId : null,
    };

    try {
      if (editingId) await updateCommitment(editingId, input);
      else await createCommitment(input);

      bumpRevision();
      router.back();
    } catch {
      Alert.alert('Não deu', 'Não foi possível salvar esse lançamento.');
      setSaving(false);
    }
  };

  if (!loaded) return <Screen />;

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

        <Text variant="heading">{editingId ? 'Editar' : 'Novo lançamento'}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar"
          onPress={handleSave}
          disabled={saving}
          style={styles.topButton}
        >
          <Text variant="label" tone="brand">
            Salvar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesa', color: colors.negative },
            { value: 'income', label: 'Receita', color: colors.positive },
          ]}
        />

        <View style={styles.amountBox}>
          <Text
            variant="display"
            color={amount > 0 ? (kind === 'income' ? colors.positive : colors.text) : colors.textFaint}
          >
            {kind === 'expense' && amount > 0 ? '− ' : ''}
            {formatMoney(amount)}
          </Text>

          {type === 'installment' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                amountMode === 'installment'
                  ? 'Digitar o valor total em vez da parcela'
                  : 'Digitar o valor da parcela em vez do total'
              }
              onPress={() => setAmountMode(amountMode === 'installment' ? 'total' : 'installment')}
              style={styles.amountToggle}
            >
              <Ionicons name="swap-horizontal" size={14} color={colors.brandText} />
              <Text variant="micro" tone="brand">
                {amountMode === 'installment' ? 'digitando a parcela' : 'digitando o total'}
              </Text>
            </Pressable>
          ) : null}

          {errors.amount ? (
            <Text variant="caption" tone="negative">
              {errors.amount}
            </Text>
          ) : null}
        </View>

        <Keypad
          compact
          onDigit={(digit) => setAmount((current) => appendDigit(current, digit))}
          onBackspace={() => setAmount(removeDigit)}
        />

        <Field label="Descrição" error={errors.description}>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={kind === 'income' ? 'Salário, freela…' : 'Mercado, geladeira…'}
            maxLength={60}
            invalid={Boolean(errors.description)}
          />
        </Field>

        <Field label="Categoria">
          <Select
            value={selectedCategory?.name ?? ''}
            placeholder="Sem categoria"
            icon={(selectedCategory?.icon ?? 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
            iconColor={selectedCategory?.color}
            onPress={() => setCategorySheet(true)}
          />
        </Field>

        {kind === 'expense' ? (
          <View style={styles.investmentRow}>
            <View style={styles.investmentText}>
              <Text variant="body">É investimento</Text>
              <Text variant="caption" tone="faint">
                Sai da conta, mas não conta como gasto — entra na sua meta
              </Text>
            </View>
            <Switch
              value={isInvestment}
              onValueChange={setIsInvestment}
              trackColor={{ false: colors.border, true: colors.positive }}
              thumbColor={colors.text}
            />
          </View>
        ) : null}

        {isInvestment ? (
          <Field
            label="Caixinha"
            hint={
              availableGoals.length === 0
                ? 'Você ainda não tem caixinhas. Crie uma em Ajustes › Caixinhas.'
                : 'Onde esse aporte entra'
            }
          >
            <Select
              value={selectedGoal?.name ?? ''}
              placeholder="Sem caixinha"
              icon={(selectedGoal?.icon ?? 'albums-outline') as keyof typeof Ionicons.glyphMap}
              iconColor={selectedGoal?.color}
              onPress={() => setGoalSheet(true)}
            />
          </Field>
        ) : null}

        <Field label="Como se repete">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'single', label: 'Única' },
              { value: 'installment', label: 'Parcelada' },
              { value: 'recurring', label: 'Recorrente' },
            ]}
          />
        </Field>

        {type === 'single' ? (
          <Field label="Data" hint={`Cai em ${formatMonthLong(competenceOf(startDate))}`}>
            <DateField value={startDate} onChange={setStartDate} label="Data da compra" />
          </Field>
        ) : null}

        {type === 'installment' ? (
          <>
            <View style={styles.row}>
              <Field label="Parcelas" error={errors.installments} style={styles.rowItem}>
                <Input
                  value={installments}
                  onChangeText={(text) => setInstallments(text.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  placeholder="10"
                  invalid={Boolean(errors.installments)}
                />
              </Field>

              <Field label="1ª parcela" style={styles.rowItem}>
                <DateField value={startDate} onChange={setStartDate} label="Data da 1ª parcela" />
              </Field>
            </View>

            <View style={styles.preview}>
              <View style={styles.previewLine}>
                <Text variant="caption" tone="muted">
                  {installmentCount}x de{' '}
                </Text>
                <Money value={perInstallment} variant="label" />
              </View>
              <View style={styles.previewLine}>
                <Text variant="caption" tone="muted">
                  Total{' '}
                </Text>
                <Money value={totalAmount} variant="caption" color={colors.textMuted} />
                <Text variant="caption" tone="muted">
                  {' '}
                  · de {formatMonthSlash(competenceOf(startDate))} a{' '}
                  {formatMonthSlash(lastCompetence)}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {type === 'recurring' ? (
          <>
            <View style={styles.row}>
              <Field label="Todo dia" style={styles.rowItem}>
                <Input
                  value={dayOfMonth}
                  onChangeText={(text) => setDayOfMonth(text.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="5"
                />
              </Field>

              <Field label="Começando em" style={styles.rowItem}>
                <DateField value={startDate} onChange={setStartDate} label="Mês inicial" />
              </Field>
            </View>

            <Field label="Quando termina" error={errors.endDate}>
              <Segmented
                value={hasEndDate ? 'until' : 'forever'}
                onChange={(value) => setHasEndDate(value === 'until')}
                options={[
                  { value: 'forever', label: 'Sem fim' },
                  { value: 'until', label: 'Até uma data' },
                ]}
              />
              {hasEndDate ? (
                <DateField value={endDate} onChange={setEndDate} label="Data final" />
              ) : null}
            </Field>

            <View style={styles.preview}>
              <Text variant="caption" tone="muted">
                {formatMoney(amount)} por mês
                {hasEndDate ? ` até ${formatMonthSlash(competenceOf(endDate))}` : ', sem data de fim'}
              </Text>
            </View>
          </>
        ) : null}

        <Field label="Perfil" error={errors.profile}>
          <Select
            value={selectedProfile?.name ?? ''}
            placeholder="Escolher perfil"
            icon={(selectedProfile?.icon ?? 'person-outline') as keyof typeof Ionicons.glyphMap}
            iconColor={selectedProfile?.color}
            onPress={() => setProfileSheet(true)}
            invalid={Boolean(errors.profile)}
          />
        </Field>

        <Field label="Observação">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Opcional"
            multiline
            numberOfLines={2}
          />
        </Field>

        <Button
          label={editingId ? 'Salvar alterações' : 'Adicionar lançamento'}
          onPress={handleSave}
          size="lg"
          fullWidth
          loading={saving}
        />
      </ScrollView>

      <Sheet visible={categorySheet} title="Categoria" onClose={() => setCategorySheet(false)}>
        <SheetOption
          label="Sem categoria"
          selected={categoryId === null}
          onPress={() => {
            setCategoryId(null);
            setCategorySheet(false);
          }}
        />
        {availableCategories.map((category) => (
          <SheetOption
            key={category.id}
            label={category.name}
            icon={category.icon as keyof typeof Ionicons.glyphMap}
            iconColor={category.color}
            selected={categoryId === category.id}
            onPress={() => {
              setCategoryId(category.id);
              setCategorySheet(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={goalSheet} title="Caixinha" onClose={() => setGoalSheet(false)}>
        <SheetOption
          label="Sem caixinha"
          description="O aporte conta na meta, mas não entra numa caixinha"
          selected={goalId === null}
          onPress={() => {
            setGoalId(null);
            setGoalSheet(false);
          }}
        />
        {availableGoals.map((goal) => (
          <SheetOption
            key={goal.id}
            label={goal.name}
            icon={goal.icon as keyof typeof Ionicons.glyphMap}
            iconColor={goal.color}
            selected={goalId === goal.id}
            onPress={() => {
              setGoalId(goal.id);
              setGoalSheet(false);
            }}
          />
        ))}
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

const useStyles = makeStyles((colors) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
    gap: spacing.lg,
  },
  amountBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  amountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDim,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  investmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  investmentText: {
    flex: 1,
    gap: 2,
  },
}));
