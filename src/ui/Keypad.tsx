import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, radius, spacing, typography, useColors } from '@/theme';

import { Text } from './Text';

export type KeypadKey = string;

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  leftAction?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
  compact?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({ onDigit, onBackspace, leftAction, compact = false }: KeypadProps) {
  const styles = useStyles();
  const colors = useColors();
  const press = (action: () => void) => () => {
    Haptics.selectionAsync().catch(() => undefined);
    action();
  };

  const keyStyle = compact ? styles.keyCompact : styles.key;

  return (
    <View style={styles.grid}>
      {DIGITS.map((digit) => (
        <Pressable
          key={digit}
          accessibilityRole="button"
          accessibilityLabel={digit}
          onPress={press(() => onDigit(digit))}
          style={({ pressed }) => [keyStyle, pressed ? styles.pressed : null]}
        >
          <Text style={typography.title}>{digit}</Text>
        </Pressable>
      ))}

      {leftAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={leftAction.label}
          onPress={press(leftAction.onPress)}
          style={({ pressed }) => [keyStyle, pressed ? styles.pressed : null]}
        >
          <Ionicons name={leftAction.icon} size={24} color={colors.textMuted} />
        </Pressable>
      ) : (
        <View style={keyStyle} />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="zero"
        onPress={press(() => onDigit('0'))}
        style={({ pressed }) => [keyStyle, pressed ? styles.pressed : null]}
      >
        <Text style={typography.title}>0</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="apagar"
        onPress={press(onBackspace)}
        style={({ pressed }) => [keyStyle, pressed ? styles.pressed : null]}
      >
        <Ionicons name="backspace-outline" size={24} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  key: {
    width: '30%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  keyCompact: {
    width: '30%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
}));
