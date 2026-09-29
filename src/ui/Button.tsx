import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, typography, useColors, type ThemeColors } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const background = (variant: Variant, colors: ThemeColors): string => {
  switch (variant) {
    case 'primary':
      return colors.brand;
    case 'secondary':
      return colors.cardElevated;
    case 'danger':
      return colors.negativeDim;
    default:
      return 'transparent';
  }
};

const foreground = (variant: Variant, colors: ThemeColors): string => {
  switch (variant) {
    case 'primary':
      return colors.onBrand;
    case 'secondary':
      return colors.text;
    case 'danger':
      return colors.negative;
    default:
      return colors.textMuted;
  }
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const colors = useColors();
  const inactive = disabled || loading;
  const tint = foreground(variant, colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.large : styles.medium,
        { backgroundColor: background(variant, colors) },
        variant === 'ghost' ? styles.ghostBorder : null,
        fullWidth ? styles.fullWidth : null,
        pressed ? styles.pressed : null,
        inactive ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
          <Text style={[typography.label, { color: tint }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medium: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  large: {
    minHeight: 54,
    paddingHorizontal: spacing.xl,
  },
  ghostBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
}));
