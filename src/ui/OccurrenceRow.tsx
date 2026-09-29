import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { OccurrenceView } from '@/domain/types';
import { makeStyles, radius, spacing, useColors , useTint } from '@/theme';

import { Money } from './Money';
import { Text } from './Text';

export interface OccurrenceRowProps {
  occurrence: OccurrenceView;
  showProfile: boolean;
  onPress: (occurrence: OccurrenceView) => void;
  onTogglePaid: (occurrence: OccurrenceView) => void;
  onDelete: (occurrence: OccurrenceView) => void;
}

function badgeFor(occurrence: OccurrenceView): string | null {
  if (occurrence.commitmentType === 'installment' && occurrence.installmentIndex) {
    return `${occurrence.installmentIndex}/${occurrence.installmentsTotal ?? '?'}`;
  }
  if (occurrence.commitmentType === 'recurring') return 'fixo';
  return null;
}

export function OccurrenceRow({
  occurrence,
  showProfile,
  onPress,
  onTogglePaid,
  onDelete,
}: OccurrenceRowProps) {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const paid = occurrence.status === 'paid';
  const skipped = occurrence.status === 'skipped';
  const badge = badgeFor(occurrence);
  const iconColor = occurrence.categoryColor ?? colors.textMuted;
  const iconName = (occurrence.categoryIcon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;

  const amountLabel = `${occurrence.kind === 'income' ? 'entrada' : 'saída'} de ${
    occurrence.description
  }`;

  const handleToggle = () => {
    swipeRef.current?.close();
    onTogglePaid(occurrence);
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    onDelete(occurrence);
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
      renderLeftActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paid ? 'Desmarcar pagamento' : 'Marcar como pago'}
          onPress={handleToggle}
          style={[styles.action, styles.actionLeft]}
        >
          <Ionicons
            name={paid ? 'arrow-undo' : 'checkmark-circle'}
            size={22}
            color={colors.positive}
          />
        </Pressable>
      )}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Excluir lançamento"
          onPress={handleDelete}
          style={[styles.action, styles.actionRight]}
        >
          <Ionicons name="trash" size={20} color={colors.negative} />
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={amountLabel}
        onPress={() => onPress(occurrence)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <View style={[styles.icon, { backgroundColor: tint(iconColor) }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>

        <View style={styles.middle}>
          <View style={styles.titleRow}>
            <Text
              variant="body"
              numberOfLines={1}
              style={[styles.title, paid || skipped ? styles.faded : null]}
            >
              {occurrence.description}
            </Text>
            {badge ? (
              <View style={styles.badge}>
                <Text variant="micro" tone="muted">
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {showProfile ? (
              <View style={styles.metaItem}>
                <View style={[styles.dot, { backgroundColor: occurrence.profileColor }]} />
                <Text variant="caption" tone="faint">
                  {occurrence.profileName}
                </Text>
              </View>
            ) : null}
            {occurrence.categoryName ? (
              <Text variant="caption" tone="faint">
                {occurrence.categoryName}
              </Text>
            ) : null}
            {skipped ? (
              <Text variant="caption" tone="warning">
                pulado
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.right}>
          <Money
            value={occurrence.kind === 'income' ? occurrence.amount : -occurrence.amount}
            variant="body"
            colorBySign
            dimmed={paid || skipped}
          />
          {paid ? <Ionicons name="checkmark" size={14} color={colors.positive} /> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const useStyles = makeStyles((colors) => ({
  swipeContainer: {
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    minHeight: 60,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  faded: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
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
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  action: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
    borderRadius: radius.md,
  },
  actionLeft: {
    backgroundColor: colors.positiveDim,
    marginRight: spacing.sm,
  },
  actionRight: {
    backgroundColor: colors.negativeDim,
    marginLeft: spacing.sm,
  },
}));
