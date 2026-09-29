import { StyleSheet, View } from 'react-native';

import { makeStyles, radius, useColors } from '@/theme';

export interface ProgressBarProps {
  ratio: number;
  color?: string;
  height?: number;
  trackColor?: string;
}

export function ProgressBar({ ratio, color, height = 8, trackColor }: ProgressBarProps) {
  const styles = useStyles();
  const colors = useColors();
  const clamped = Math.max(0, Math.min(ratio, 1));
  const fill = color ?? colors.brand;
  const track = trackColor ?? colors.surface;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
      style={[styles.track, { height, backgroundColor: track, borderRadius: height / 2 }]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: fill,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
}));
