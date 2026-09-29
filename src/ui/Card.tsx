import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, useColors } from '@/theme';

export interface CardProps {
  children: ReactNode;
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, padded = true, elevated = false, style }: CardProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        elevated ? styles.elevated : null,
        padded ? styles.padded : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.cardElevated,
  },
  padded: {
    padding: spacing.lg,
  },
}));
