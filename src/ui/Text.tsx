import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { typography, useColors, type ThemeColors } from '@/theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'faint' | 'positive' | 'negative' | 'warning' | 'brand';

const toneColor = (tone: Tone, colors: ThemeColors): string => {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'faint':
      return colors.textFaint;
    case 'positive':
      return colors.positive;
    case 'negative':
      return colors.negative;
    case 'warning':
      return colors.warning;
    case 'brand':
      return colors.brandText;
    default:
      return colors.text;
  }
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({
  variant = 'body',
  tone = 'default',
  color,
  align,
  style,
  ...rest
}: AppTextProps) {
  const colors = useColors();

  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: color ?? toneColor(tone, colors) },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
