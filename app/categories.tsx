import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Category, Kind } from '@/domain/types';
import {
  countCommitmentsUsing,
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/repositories/categories';
import { useAppStore } from '@/stores/app';
import { makeStyles, palette, radius, spacing, useColors , useTint } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'home',
  'cart',
  'car',
  'medkit',
  'game-controller',
  'school',
  'tv',
  'document-text',
  'construct',
  'restaurant',
  'fitness',
  'airplane',
  'gift',
  'wallet',
  'laptop',
  'trending-up',
  'pricetag',
  'ellipsis-horizontal',
];

export default function CategoriesScreen() {
  const tint = useTint();
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const categories = useAppStore((state) => state.categories);
  const refreshCategories = useAppStore((state) => state.refreshCategories);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const [kind, setKind] = useState<Kind>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(palette[0]);
  const [icon, setIcon] = useState<keyof typeof Ionicons.glyphMap>('pricetag');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  );

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(palette[visible.length % palette.length]);
    setIcon('pricetag');
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setColor(category.color);
    setIcon(category.icon as keyof typeof Ionicons.glyphMap);
    setError(null);
    setFormOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError('Dê um nome à categoria');
      return;
    }

    setSaving(true);

    if (editing) await updateCategory(editing.id, { name: trimmed, color, icon, kind: editing.kind });
    else await createCategory({ name: trimmed, color, icon, kind });

    await refreshCategories();
    bumpRevision();
    setSaving(false);
    setFormOpen(false);
  };

  const remove = async (category: Category) => {
    if (category.isSystem) {
      Alert.alert('Não dá', 'Categorias que vêm com o app não podem ser excluídas.');
      return;
    }

    const inUse = await countCommitmentsUsing(category.id);

    Alert.alert(
      `Excluir ${category.name}`,
      inUse > 0
        ? `${inUse} ${inUse === 1 ? 'lançamento usa' : 'lançamentos usam'} essa categoria. Eles ficam sem categoria, mas continuam no app.`
        : 'Essa categoria não está em uso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(category.id);
            await refreshCategories();
            bumpRevision();
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.back()}
          style={styles.topButton}
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
        <Text variant="heading">Categorias</Text>
        <View style={styles.topButton} />
      </View>

      <View style={styles.tabs}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesas', color: colors.negative },
            { value: 'income', label: 'Receitas', color: colors.positive },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padded={false}>
          {visible.map((category, index) => (
            <View key={category.id} style={[styles.row, index > 0 ? styles.bordered : null]}>
              <View style={[styles.icon, { backgroundColor: tint(category.color) }]}>
                <Ionicons
                  name={category.icon as keyof typeof Ionicons.glyphMap}
                  size={17}
                  color={category.color}
                />
              </View>

              <Text variant="body" style={styles.rowLabel}>
                {category.name}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar ${category.name}`}
                onPress={() => openEdit(category)}
                style={styles.rowAction}
              >
                <Ionicons name="pencil" size={16} color={colors.textMuted} />
              </Pressable>

              {category.isSystem ? (
                <View style={styles.rowAction} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir ${category.name}`}
                  onPress={() => remove(category)}
                  style={styles.rowAction}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.negative} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        <Button
          label="Nova categoria"
          icon="add"
          onPress={openCreate}
          variant="secondary"
          fullWidth
        />
      </ScrollView>

      <Sheet
        visible={formOpen}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        onClose={() => setFormOpen(false)}
      >
        <View style={styles.form}>
          <Field label="Nome" error={error ?? undefined}>
            <Input
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder="Mercado, Impostos…"
              maxLength={24}
              invalid={Boolean(error)}
            />
          </Field>

          <Field label="Cor">
            <View style={styles.swatches}>
              {palette.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Cor ${option}`}
                  accessibilityState={{ selected: color === option }}
                  onPress={() => setColor(option)}
                  style={[
                    styles.swatch,
                    { backgroundColor: option },
                    color === option ? styles.swatchSelected : null,
                  ]}
                >
                  {color === option ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Ícone">
            <View style={styles.swatches}>
              {ICONS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Ícone ${option}`}
                  accessibilityState={{ selected: icon === option }}
                  onPress={() => setIcon(option)}
                  style={[styles.iconOption, icon === option ? styles.iconOptionSelected : null]}
                >
                  <Ionicons
                    name={option}
                    size={17}
                    color={icon === option ? color : colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </Field>

          <Button
            label={editing ? 'Salvar' : 'Criar categoria'}
            onPress={save}
            size="lg"
            fullWidth
            loading={saving}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  rowAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
