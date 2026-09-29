import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Kind } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { createCommitment } from '@/repositories/commitments';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import {
  competenceOf,
  currentCompetence,
  dueDateIn,
  formatMonthLong,
  parseISODate,
  todayISO,
  type Competence,
  type ISODate,
} from '@/utils/date';
import { appendDigit, formatMoney, removeDigit } from '@/utils/money';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Keypad } from '@/ui/Keypad';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';

type QuickMode = 'expense' | 'income' | 'invest';

const FALLBACK_DESCRIPTION: Record<QuickMode, string> = {
  expense: 'Gasto',
  income: 'Entrada',
  invest: 'Investimento',
};

function targetDate(competence: Competence): ISODate {
  const today = todayISO();
  if (competenceOf(today) === competence) return today;
  return dueDateIn(competence, parseISODate(today).day);
}

export default function QuickEntryScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();

  const profiles = useAppStore((state) => state.profiles);
  const goals = useAppStore((state) => state.goals);
  const scope = useAppStore((state) => state.scope);
  const competence = useAppStore((state) => state.competence);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [mode, setMode] = useState<QuickMode>(
    params.kind === 'income' ? 'income' : params.kind === 'invest' ? 'invest' : 'expense',
  );

  const kind: Kind = mode === 'income' ? 'income' : 'expense';
  const isInvestment = mode === 'invest';
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);

  const profileId = scope === ALL_PROFILES ? (profiles[0]?.id ?? '') : scope;
  const profile = profiles.find((item) => item.id === profileId);
  const startDate = targetDate(competence);
  const isCurrentMonth = competence === currentCompetence();

  const save = async () => {
    if (amount <= 0) return;
    if (!profileId) {
      Alert.alert('Sem perfil', 'Crie um perfil antes de lançar.');
      return;
    }

    setSaving(true);

    await createCommitment({
      profileId,
      categoryId: null,
      kind,
      type: 'single',
      description: note.trim() || FALLBACK_DESCRIPTION[mode],
      amount,
      installments: null,
      startDate,
      endDate: null,
      dayOfMonth: null,
      notes: null,
      isInvestment,
      goalId: isInvestment ? goalId : null,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    bumpRevision();
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.replace('/(tabs)')}
          style={styles.topButton}
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>

        <Text variant="heading">Lançamento rápido</Text>

        <View style={styles.topButton} />
      </View>

      <View style={styles.body}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'expense', label: 'Gasto', color: colors.negative },
            { value: 'income', label: 'Entrada', color: colors.positive },
            { value: 'invest', label: 'Investir', color: colors.brand },
          ]}
        />

        <View style={styles.amountBox}>
          <Text
            variant="display"
            color={
              amount === 0
                ? colors.textFaint
                : mode === 'income'
                  ? colors.positive
                  : mode === 'invest'
                    ? colors.brandText
                    : colors.text
            }
          >
            {mode === 'expense' && amount > 0 ? '− ' : ''}
            {formatMoney(amount)}
          </Text>

          <View style={styles.contextRow}>
            {profile ? (
              <View style={styles.contextChip}>
                <View style={[styles.dot, { backgroundColor: profile.color }]} />
                <Text variant="micro" tone="muted">
                  {profile.name}
                </Text>
              </View>
            ) : null}

            {isInvestment ? (
              <View style={styles.contextChip}>
                <Ionicons name="trending-up" size={11} color={colors.brandText} />
                <Text variant="micro" tone="brand">
                  conta na meta
                </Text>
              </View>
            ) : null}

            <View style={styles.contextChip}>
              <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
              <Text variant="micro" tone="muted">
                {isCurrentMonth ? 'hoje' : formatMonthLong(competence)}
              </Text>
            </View>
          </View>
        </View>

        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Observação (opcional)"
          maxLength={60}
          returnKeyType="done"
        />

        <Keypad
          onDigit={(digit) => setAmount((current) => appendDigit(current, digit))}
          onBackspace={() => setAmount(removeDigit)}
        />

        <Button
          label="Salvar"
          icon="checkmark"
          onPress={save}
          size="lg"
          fullWidth
          disabled={amount <= 0}
          loading={saving}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir o formulário completo"
          onPress={() => router.replace('/entry')}
          style={styles.fullFormLink}
        >
          <Text variant="caption" tone="brand">
            Preciso de parcelas, categoria ou recorrência
          </Text>
        </Pressable>
      </View>
    </Screen>
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
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  amountBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  contextRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fullFormLink: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
}));
