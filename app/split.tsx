import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  describeSplit,
  myShare,
  owedByOthers,
  shareFor,
  type Participant,
} from '@/domain/split';
import { ALL_PROFILES } from '@/domain/types';
import { createCommitment } from '@/repositories/commitments';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import {
  competenceOf,
  dueDateIn,
  parseISODate,
  todayISO,
  type Competence,
  type ISODate,
} from '@/utils/date';
import { appendDigit, formatMoney, removeDigit } from '@/utils/money';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input } from '@/ui/Field';
import { Keypad } from '@/ui/Keypad';
import { Money } from '@/ui/Money';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Text } from '@/ui/Text';

function targetDate(competence: Competence): ISODate {
  const today = todayISO();
  if (competenceOf(today) === competence) return today;
  return dueDateIn(competence, parseISODate(today).day);
}

let nextId = 0;
const createParticipantId = () => `p${nextId++}`;

export default function SplitScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ total?: string; accessKey?: string }>();

  const profiles = useAppStore((state) => state.profiles);
  const scope = useAppStore((state) => state.scope);
  const competence = useAppStore((state) => state.competence);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const scannedTotal = Number(params.total) || 0;

  const [total, setTotal] = useState(scannedTotal);
  const [description, setDescription] = useState('');
  const [editingTotal, setEditingTotal] = useState(scannedTotal === 0);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: createParticipantId(), name: 'Eu', isMe: true },
  ]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const profileId = scope === ALL_PROFILES ? (profiles[0]?.id ?? '') : scope;
  const profile = profiles.find((item) => item.id === profileId);

  const shares = useMemo(() => shareFor(total, participants), [total, participants]);
  const mine = myShare(shares);
  const others = owedByOthers(shares);
  const isShared = participants.length > 1;

  const addParticipant = () => {
    const name = newName.trim();
    if (!name) return;

    setParticipants((current) => [
      ...current,
      { id: createParticipantId(), name, isMe: false },
    ]);
    setNewName('');
    Haptics.selectionAsync().catch(() => undefined);
  };

  const removeParticipant = (id: string) => {
    setParticipants((current) => current.filter((item) => item.id !== id || item.isMe));
  };

  const save = async () => {
    if (total <= 0) {
      Alert.alert('Falta o valor', 'Digite quanto foi a conta.');
      return;
    }
    if (!profileId) {
      Alert.alert('Sem perfil', 'Crie um perfil antes de lançar.');
      return;
    }

    setSaving(true);

    const note = [
      isShared ? `${describeSplit(shares)} · total ${formatMoney(total)}` : '',
      params.accessKey ? `NFe ${params.accessKey}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await createCommitment({
      profileId,
      categoryId: null,
      kind: 'expense',
      type: 'single',
      description: description.trim() || 'Conta dividida',
      amount: mine,
      installments: null,
      startDate: targetDate(competence),
      endDate: null,
      dayOfMonth: null,
      notes: note || null,
      isInvestment: false,
      goalId: null,
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
        <Text variant="heading">Dividir a conta</Text>
        <View style={styles.topButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar o valor total"
          onPress={() => setEditingTotal(true)}
          style={styles.totalBox}
        >
          <Text variant="caption" tone="faint">
            Total da conta
          </Text>
          <Money
            value={total}
            variant="display"
            color={total > 0 ? colors.text : colors.textFaint}
          />
          {params.accessKey ? (
            <View style={styles.nfeTag}>
              <Ionicons name="checkmark-circle" size={12} color={colors.positive} />
              <Text variant="micro" tone="positive">
                lido da nota fiscal
              </Text>
            </View>
          ) : null}
        </Pressable>

        {editingTotal ? (
          <Keypad
            compact
            onDigit={(digit) => setTotal((current) => appendDigit(current, digit))}
            onBackspace={() => setTotal(removeDigit)}
          />
        ) : null}

        <Field label="O que foi">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Jantar, mercado…"
            maxLength={60}
          />
        </Field>

        <SectionHeader title={`Entre ${participants.length}`} />

        <Card padded={false}>
          {shares.map((share, index) => (
            <View
              key={share.participant.id}
              style={[styles.personRow, index > 0 ? styles.bordered : null]}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: share.participant.isMe
                      ? colors.brandDim
                      : colors.cardElevated,
                  },
                ]}
              >
                <Text variant="label" tone={share.participant.isMe ? 'brand' : 'muted'}>
                  {share.participant.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <Text variant="body" style={styles.personName}>
                {share.participant.name}
                {share.participant.isMe ? ' (você)' : ''}
              </Text>

              <Money
                value={share.amount}
                variant="body"
                color={share.participant.isMe ? colors.text : colors.textMuted}
              />

              {share.participant.isMe ? (
                <View style={styles.rowAction} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${share.participant.name}`}
                  onPress={() => removeParticipant(share.participant.id)}
                  style={styles.rowAction}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        <View style={styles.addRow}>
          <Input
            value={newName}
            onChangeText={setNewName}
            placeholder="Thiago, Alana…"
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={addParticipant}
            style={styles.addInput}
          />
          <Button label="Add" icon="person-add" onPress={addParticipant} variant="secondary" />
        </View>

        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text variant="body">Sua parte</Text>
            <Money value={mine} variant="heading" color={colors.negative} />
          </View>

          {isShared ? (
            <View style={styles.summaryRow}>
              <Text variant="caption" tone="muted">
                Os outros te devem
              </Text>
              <Money value={others} variant="caption" color={colors.textMuted} />
            </View>
          ) : null}

          <Text variant="caption" tone="faint">
            {isShared
              ? `Só a sua parte entra como despesa${profile ? ` em ${profile.name}` : ''}. O que os outros devem não vira receita — dívida de amigo não é renda.`
              : `A conta inteira entra como despesa${profile ? ` em ${profile.name}` : ''}.`}
          </Text>
        </Card>

        <Button
          label="Lançar minha parte"
          icon="checkmark"
          onPress={save}
          size="lg"
          fullWidth
          disabled={total <= 0}
          loading={saving}
        />
      </ScrollView>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  totalBox: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  nfeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.positiveDim,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personName: {
    flex: 1,
  },
  rowAction: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addInput: {
    flex: 1,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
