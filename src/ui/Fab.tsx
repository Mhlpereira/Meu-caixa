import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { makeStyles, radius, useColors, useShadows } from '@/theme';

export interface FabProps {
  onPress: () => void;
  label?: string;
}

export function Fab({ onPress, label = 'Novo lançamento' }: FabProps) {
  const styles = useStyles();
  const colors = useColors();
  const shadows = useShadows();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, shadows.floating, pressed ? styles.pressed : null]}
    >
      <Ionicons name="add" size={28} color={colors.onBrand} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
}));
