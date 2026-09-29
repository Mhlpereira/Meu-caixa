import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import type { Cents, Competence } from '@/domain/types';
import { makeStyles, spacing, useColors } from '@/theme';
import { formatMonthShort } from '@/utils/date';
import { formatMoneyCompact } from '@/utils/money';

import { Money } from './Money';
import { Text } from './Text';

const HEIGHT = 140;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 22;
const DOT_RADIUS = 4;

export interface ChartPoint {
  competence: Competence;
  value: Cents;
}

export interface AccumulatedChartProps {
  points: ChartPoint[];
  onSelectMonth?: (competence: string) => void;
}

interface PlotPoint {
  x: number;
  y: number;
  point: ChartPoint;
}

export function AccumulatedChart({ points, onSelectMonth }: AccumulatedChartProps) {
  const styles = useStyles();
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (width === 0 || points.length === 0) return null;

    const values = points.map((item) => item.value);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const step = points.length > 1 ? width / (points.length - 1) : 0;
    const toY = (value: number) => PADDING_TOP + ((max - value) / range) * plotHeight;

    const plotted: PlotPoint[] = points.map((item, index) => ({
      x: points.length > 1 ? index * step : width / 2,
      y: toY(item.value),
      point: item,
    }));

    const linePath = plotted
      .map((item, index) => `${index === 0 ? 'M' : 'L'}${item.x.toFixed(2)},${item.y.toFixed(2)}`)
      .join(' ');

    const zeroY = toY(0);
    const areaPath = `${linePath} L${plotted[plotted.length - 1].x.toFixed(2)},${zeroY.toFixed(
      2,
    )} L${plotted[0].x.toFixed(2)},${zeroY.toFixed(2)} Z`;

    return { plotted, linePath, areaPath, zeroY, max, min };
  }, [points, width]);

  const activeIndex = selected ?? points.length - 1;
  const activeMonth = points[activeIndex];
  const endsNegative = (points[points.length - 1]?.value ?? 0) < 0;
  const lineColor = endsNegative ? colors.negative : colors.brand;

  return (
    <View style={styles.container}>
      <View
        style={styles.plot}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={
          points.length > 0
            ? `Evolução ao longo de ${points.length} meses, terminando em ${formatMoneyCompact(
                points[points.length - 1].value,
              )}`
            : 'Sem dados de projeção'
        }
      >
        {geometry ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="accumulatedFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity={0.32} />
                <Stop offset="1" stopColor={lineColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            <Line
              x1={0}
              y1={geometry.zeroY}
              x2={width}
              y2={geometry.zeroY}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />

            <Path d={geometry.areaPath} fill="url(#accumulatedFill)" />

            <Path
              d={geometry.linePath}
              stroke={lineColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {geometry.plotted.map((item, index) => {
              const isNegative = item.point.value < 0;
              const isActive = index === activeIndex;
              if (!isNegative && !isActive) return null;

              return (
                <Circle
                  key={item.point.competence}
                  cx={item.x}
                  cy={item.y}
                  r={isActive ? DOT_RADIUS + 1 : DOT_RADIUS}
                  fill={isNegative ? colors.negative : lineColor}
                  stroke={colors.bg}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        ) : null}

        <View style={styles.touchLayer} pointerEvents="box-none">
          {points.map((item, index) => (
            <Pressable
              key={item.competence}
              accessibilityRole="button"
              accessibilityLabel={`${formatMonthShort(item.competence)}, ${formatMoneyCompact(
                item.value,
              )}`}
              onPress={() => {
                setSelected(index);
                onSelectMonth?.(item.competence);
              }}
              style={styles.touchTarget}
            />
          ))}
        </View>
      </View>

      {activeMonth ? (
        <View style={styles.readout}>
          <Text variant="caption" tone="muted">
            {formatMonthShort(activeMonth.competence)}
          </Text>
          <Money value={activeMonth.value} variant="label" colorBySign />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    gap: spacing.sm,
  },
  plot: {
    height: HEIGHT,
    justifyContent: 'center',
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  touchTarget: {
    flex: 1,
    minHeight: 44,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
