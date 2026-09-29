import { StyleSheet, Text as RNText, type TextStyle } from 'react-native';

import { balanceColor, makeStyles, typography, useColors } from '@/theme';
import type { Cents } from '@/domain/types';
import { formatMoney } from '@/utils/money';

type Variant = keyof typeof typography;

export interface MoneyProps {
  value: Cents;
  variant?: Variant;
  colorBySign?: boolean;
  showSign?: boolean;
  color?: string;
  dimmed?: boolean;
  style?: TextStyle;
  accessibilityLabel?: string;
}

export function Money({
  value,
  variant = 'body',
  colorBySign = false,
  showSign = false,
  color,
  dimmed = false,
  style,
  accessibilityLabel,
}: MoneyProps) {
  const styles = useStyles();
  const colors = useColors();
  const resolved = color ?? (colorBySign ? balanceColor(value, colors) : colors.text);

  return (
    <RNText
      accessibilityLabel={accessibilityLabel}
      style={[
        typography[variant],
        styles.tabular,
        { color: resolved },
        dimmed ? styles.dimmed : null,
        style,
      ]}
    >
      {formatMoney(value, { sign: showSign && value > 0 })}
    </RNText>
  );
}

const useStyles = makeStyles((colors) => ({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  dimmed: {
    opacity: 0.45,
  },
}));
