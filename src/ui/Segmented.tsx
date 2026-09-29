import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, radius, spacing, useColors } from '@/theme';

import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        const activeColor = option.color ?? colors.brand;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              selected ? { backgroundColor: activeColor } : null,
            ]}
          >
            <Text
              variant="label"
              color={selected ? colors.onBrand : colors.textMuted}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
}));
