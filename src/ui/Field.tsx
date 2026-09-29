import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { makeStyles, radius, spacing, typography, useColors } from '@/theme';

import { Text } from './Text';

export interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  style?: ViewStyle;
}

export function Field({ label, children, hint, error, style }: FieldProps) {
  const styles = useStyles();
  return (
    <View style={[styles.field, style]}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="negative">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface InputProps extends TextInputProps {
  invalid?: boolean;
}

export function Input({ invalid = false, style, ...rest }: InputProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <TextInput
      {...rest}
      placeholderTextColor={colors.textFaint}
      style={[styles.input, invalid ? styles.invalid : null, style]}
    />
  );
}

export interface SelectProps {
  value: string;
  placeholder?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  invalid?: boolean;
}

export function Select({
  value,
  placeholder = 'Selecionar',
  onPress,
  icon,
  iconColor,
  invalid = false,
}: SelectProps) {
  const styles = useStyles();
  const colors = useColors();
  const empty = value.length === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? placeholder : value}
      onPress={onPress}
      style={({ pressed }) => [
        styles.input,
        styles.select,
        invalid ? styles.invalid : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.selectContent}>
        {icon ? <Ionicons name={icon} size={18} color={iconColor ?? colors.textMuted} /> : null}
        <Text variant="body" tone={empty ? 'faint' : 'default'} numberOfLines={1}>
          {empty ? placeholder : value}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  field: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  invalid: {
    borderColor: colors.negative,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
}));
