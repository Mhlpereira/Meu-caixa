import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ALL_PROFILES } from '@/domain/types';
import { useAppStore } from '@/stores/app';
import { makeStyles, radius, spacing, useColors } from '@/theme';

import { Sheet, SheetOption } from './Sheet';
import { Text } from './Text';

export interface ProfileSwitcherProps {
  onOpenSettings?: () => void;
}

export function ProfileSwitcher({ onOpenSettings }: ProfileSwitcherProps) {
  const styles = useStyles();
  const colors = useColors();
  const profiles = useAppStore((state) => state.profiles);
  const scope = useAppStore((state) => state.scope);
  const setScope = useAppStore((state) => state.setScope);

  const [open, setOpen] = useState(false);

  const active = profiles.find((profile) => profile.id === scope);
  const label = active?.name ?? 'Todos os perfis';
  const color = active?.color ?? colors.textMuted;

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Perfil ${label}. Toque para trocar`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="label">{label}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      {onOpenSettings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <Sheet visible={open} title="Perfil" onClose={() => setOpen(false)}>
        <SheetOption
          label="Todos os perfis"
          description="Soma pessoal e empresa numa visão só"
          icon="layers"
          iconColor={colors.textMuted}
          selected={scope === ALL_PROFILES}
          onPress={() => {
            setScope(ALL_PROFILES);
            setOpen(false);
          }}
        />

        {profiles.map((profile) => (
          <SheetOption
            key={profile.id}
            label={profile.name}
            icon={profile.icon as keyof typeof Ionicons.glyphMap}
            iconColor={profile.color}
            selected={scope === profile.id}
            onPress={() => {
              setScope(profile.id);
              setOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
}));
