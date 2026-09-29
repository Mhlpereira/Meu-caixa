import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, radius, spacing, useColors } from '@/theme';
import { addMonths, currentCompetence, formatMonthLong, type Competence } from '@/utils/date';

import { Text } from './Text';

export interface MonthNavProps {
  competence: Competence;
  onChange: (competence: Competence) => void;
}

export function MonthNav({ competence, onChange }: MonthNavProps) {
  const styles = useStyles();
  const colors = useColors();
  const isCurrent = competence === currentCompetence();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={() => onChange(addMonths(competence, -1))}
        style={({ pressed }) => [styles.arrow, pressed ? styles.pressed : null]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${formatMonthLong(competence)}. Toque para voltar ao mês atual`}
        onPress={() => onChange(currentCompetence())}
        style={styles.label}
      >
        <Text variant="heading">{formatMonthLong(competence)}</Text>
        {isCurrent ? null : (
          <Text variant="micro" tone="brand">
            voltar para hoje
          </Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={() => onChange(addMonths(competence, 1))}
        style={({ pressed }) => [styles.arrow, pressed ? styles.pressed : null]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  label: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
}));
