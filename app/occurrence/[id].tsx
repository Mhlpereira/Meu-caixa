import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { OccurrenceView } from '@/domain/types';
import { deleteCommitment } from '@/repositories/commitments';
import {
  clearOverride,
  deleteOccurrence,
  getOccurrence,
  overrideAmount,
  setStatus,
} from '@/repositories/occurrences';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors , useTint } from '@/theme';
import { formatDateBR, formatMonthLong } from '@/utils/date';
import { appendDigit, formatMoney, removeDigit } from '@/utils/money';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Keypad } from '@/ui/Keypad';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const TYPE_LABELS: Record<OccurrenceView['commitmentType'], string> = {
  single: 'Compra única',
  installment: 'Parcelada',
  recurring: 'Recorrente',
};

export default function OccurrenceScreen() {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [occurrence, setOccurrence] = useState<OccurrenceView | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [draftAmount, setDraftAmount] = useState(0);

  const load = async () => {
    if (typeof id !== 'string') return;
    setOccurrence(await getOccurrence(id));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!occurrence) return <Screen />;

  const isIncome = occurrence.kind === 'income';
  const iconColor = occurrence.categoryColor ?? colors.textMuted;
  const iconName = (occurrence.categoryIcon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;

  const apply = async (action: () => Promise<void>) => {
    await action();
    bumpRevision();
    await load();
  };

  const changeStatus = (status: OccurrenceView['status']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    apply(() => setStatus(occurrence.id, status));
  };

  const saveAmount = () => {
    if (draftAmount <= 0) return;
    setEditingAmount(false);
    apply(() => overrideAmount(occurrence.id, draftAmount));
  };

  const handleDelete = () => {
    const isSeries = occurrence.commitmentType !== 'single';

    Alert.alert(
      'Excluir',
      isSeries
        ? `"${occurrence.description}" faz parte de uma série.`
        : `Excluir "${occurrence.description}"?`,
      isSeries
        ? [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Só este mês',
              onPress: async () => {
                await deleteOccurrence(occurrence.id);
                bumpRevision();
                router.back();
              },
            },
            {
              text: 'A série toda',
              style: 'destructive',
              onPress: async () => {
                await deleteCommitment(occurrence.commitmentId);
                bumpRevision();
                router.back();
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
                router.back();
              },
            },
          ],
    );
  };

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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar lançamento"
          onPress={() => router.replace(`/entry?id=${occurrence.commitmentId}`)}
          style={styles.topButton}
        >
          <Text variant="label" tone="brand">
            Editar
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: tint(iconColor) }]}>
            <Ionicons name={iconName} size={26} color={iconColor} />
          </View>

          <Text variant="title" align="center">
            {occurrence.description}
          </Text>

          {editingAmount ? (
            <>
              <Text variant="display" color={colors.text}>
                {formatMoney(draftAmount)}
              </Text>
              <Keypad
                compact
                onDigit={(digit) => setDraftAmount((current) => appendDigit(current, digit))}
                onBackspace={() => setDraftAmount(removeDigit)}
              />
              <View style={styles.editActions}>
                <Button
                  label="Cancelar"
                  onPress={() => setEditingAmount(false)}
                  variant="ghost"
                />
                <Button label="Salvar valor" onPress={saveAmount} style={styles.grow} />
              </View>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar o valor deste mês"
              onPress={() => {
                setDraftAmount(occurrence.amount);
                setEditingAmount(true);
              }}
            >
              <Money
                value={isIncome ? occurrence.amount : -occurrence.amount}
                variant="display"
                colorBySign
                showSign
              />
            </Pressable>
          )}

          {occurrence.isOverridden && !editingAmount ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar ao valor original"
              onPress={() => apply(() => clearOverride(occurrence.id))}
              style={styles.overrideChip}
            >
              <Ionicons name="pencil" size={12} color={colors.warning} />
              <Text variant="micro" tone="warning">
                valor ajustado — tocar para voltar ao original
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Card padded={false}>
          <DetailRow label="Mês" value={formatMonthLong(occurrence.competence)} />
          <DetailRow label="Vencimento" value={formatDateBR(occurrence.dueDate)} bordered />
          <DetailRow
            label="Tipo"
            value={
              occurrence.commitmentType === 'installment' && occurrence.installmentIndex
                ? `${TYPE_LABELS.installment} · ${occurrence.installmentIndex} de ${
                    occurrence.installmentsTotal ?? '?'
                  }`
                : TYPE_LABELS[occurrence.commitmentType]
            }
            bordered
          />
          <DetailRow label="Categoria" value={occurrence.categoryName ?? 'Sem categoria'} bordered />
          <DetailRow label="Perfil" value={occurrence.profileName} bordered />
        </Card>

        <View style={styles.statusActions}>
          <Button
            label={occurrence.status === 'paid' ? 'Desmarcar pago' : 'Marcar como pago'}
            icon={occurrence.status === 'paid' ? 'arrow-undo' : 'checkmark-circle'}
            onPress={() => changeStatus(occurrence.status === 'paid' ? 'pending' : 'paid')}
            variant={occurrence.status === 'paid' ? 'secondary' : 'primary'}
            fullWidth
          />

          <Button
            label={occurrence.status === 'skipped' ? 'Não pular este mês' : 'Pular este mês'}
            icon="play-skip-forward"
            onPress={() => changeStatus(occurrence.status === 'skipped' ? 'pending' : 'skipped')}
            variant="secondary"
            fullWidth
          />

          <Button label="Excluir" icon="trash" onPress={handleDelete} variant="danger" fullWidth />
        </View>
      </ScrollView>
    </Screen>
  );
}

function DetailRow({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={[styles.detailRow, bordered ? styles.bordered : null]}>
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
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
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.warningDim,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  grow: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    gap: spacing.md,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statusActions: {
    gap: spacing.md,
  },
}));
