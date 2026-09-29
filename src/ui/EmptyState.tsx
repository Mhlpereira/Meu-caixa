import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { makeStyles, radius, spacing, useColors } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={28} color={colors.textFaint} />
      </View>

      <Text variant="heading" align="center">
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="muted" align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" icon="add" />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    maxWidth: 280,
  },
}));
