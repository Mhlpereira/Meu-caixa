import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, spacing, useColors } from '@/theme';

import { Text } from './Text';

export interface ScreenProps {
  children?: ReactNode;
  padded?: boolean;
  withTopInset?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, padded = true, withTopInset = true, style }: ScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        padded ? styles.padded : null,
        withTopInset ? { paddingTop: insets.top + spacing.sm } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface SectionHeaderProps {
  title: string;
  trailing?: ReactNode;
}

export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text variant="micro" tone="faint">
        {title.toUpperCase()}
      </Text>
      <View style={styles.rule} />
      {trailing}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
}));
