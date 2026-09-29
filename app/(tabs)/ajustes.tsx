import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { resetDatabase } from '@/db/client';
import { BackupFormatError, exportBackup, importBackup, parseBackup } from '@/repositories/backup';
import {
  chooseBackupFolder,
  disableAutoBackup,
  getBackupFolder,
  getLastBackupAt,
  writeBackupNow,
  type BackupFolder,
} from '@/services/autoBackup';
import { useAppStore } from '@/stores/app';
import { useLockStore } from '@/stores/lock';
import { useThemeStore } from '@/stores/theme';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import { THEMES, THEME_ORDER } from '@/theme/themes';
import { formatDateBR, makeISODate } from '@/utils/date';
import { Card } from '@/ui/Card';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Text } from '@/ui/Text';

function isoFrom(date: Date): string {
  return makeISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export default function SettingsScreen() {
  const styles = useStyles();
  const router = useRouter();

  const profiles = useAppStore((state) => state.profiles);
  const categories = useAppStore((state) => state.categories);
  const goals = useAppStore((state) => state.goals);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const bumpRevision = useAppStore((state) => state.bumpRevision);

  const pinEnabled = useLockStore((state) => state.pinEnabled);
  const biometricsEnabled = useLockStore((state) => state.biometricsEnabled);
  const biometricsLabel = useLockStore((state) => state.biometricsLabel);

  const colors = useColors();
  const themeName = useThemeStore((state) => state.name);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<BackupFolder | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);

  const refreshBackupState = useCallback(async () => {
    const [current, last] = await Promise.all([getBackupFolder(), getLastBackupAt()]);
    setFolder(current);
    setLastBackup(last);
  }, []);

  useEffect(() => {
    refreshBackupState();
  }, [refreshBackupState]);

  const handleChooseFolder = async () => {
    try {
      const picked = await chooseBackupFolder();
      if (!picked) return;
      await writeBackupNow();
      await refreshBackupState();
      Alert.alert(
        'Backup automático ligado',
        `A cada vez que você abrir o app, uma cópia dos seus dados é salva em "${picked.label}". Essa pasta fica fora do app, então desinstalar não apaga os backups.`,
      );
    } catch {
      Alert.alert('Não deu', 'Não foi possível usar essa pasta. Tente escolher outra.');
    }
  };

  const handleBackupNow = async () => {
    setBusy(true);
    try {
      const name = await writeBackupNow();
      await refreshBackupState();
      Alert.alert('Backup salvo', name);
    } catch {
      Alert.alert('Não deu', 'Não foi possível gravar o backup nessa pasta.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableAuto = () => {
    Alert.alert('Desligar backup automático', 'Os backups já salvos continuam onde estão.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desligar',
        style: 'destructive',
        onPress: async () => {
          await disableAutoBackup();
          await refreshBackupState();
        },
      },
    ]);
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `meu-caixa-${stamp}.json`);

      file.create({ overwrite: true });
      file.write(JSON.stringify(backup, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Backup do Meu Caixa',
        });
      } else {
        Alert.alert('Backup salvo', `Arquivo gerado em ${file.uri}`);
      }
    } catch {
      Alert.alert('Não deu', 'Não foi possível gerar o backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];

    Alert.alert(
      'Importar backup',
      'Isso apaga tudo que está no app agora e coloca os dados do arquivo no lugar. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Substituir tudo',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const raw = await new File(asset.uri).text();
              await importBackup(parseBackup(raw));
              await bootstrap();
              bumpRevision();
              Alert.alert('Pronto', 'Backup restaurado.');
            } catch (error) {
              Alert.alert(
                'Não deu',
                error instanceof BackupFormatError
                  ? error.message
                  : 'Não foi possível ler esse arquivo.',
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Zerar tudo',
      'Apaga perfis, lançamentos e histórico, e devolve o app ao estado de instalação nova. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await resetDatabase();
            await bootstrap();
            bumpRevision();
            setBusy(false);
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">Ajustes</Text>

        <SectionHeader title="Organização" />
        <Card padded={false}>
          <Row
            icon="people"
            label="Perfis"
            value={`${profiles.length}`}
            onPress={() => router.push('/profiles')}
          />
          <Row
            icon="albums"
            label="Caixinhas"
            value={`${goals.length}`}
            onPress={() => router.push('/goals')}
            bordered
          />
          <Row
            icon="pricetags"
            label="Categorias"
            value={`${categories.length}`}
            onPress={() => router.push('/categories')}
            bordered
          />
        </Card>

        <SectionHeader title="Aparência" />
        <Card style={styles.themeCard}>
          <View style={styles.themeRow}>
            {THEME_ORDER.map((option) => {
              const preview = THEMES[option];
              const selected = themeName === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Tema ${preview.label}. ${preview.description}`}
                  onPress={() => setTheme(option)}
                  style={styles.themeOption}
                >
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: preview.colors.bg, borderColor: preview.colors.border },
                      selected ? { borderColor: colors.brand, borderWidth: 2 } : null,
                    ]}
                  >
                    <View
                      style={[styles.themeSwatchCard, { backgroundColor: preview.colors.card }]}
                    >
                      <View
                        style={[styles.themeSwatchBar, { backgroundColor: preview.colors.positive }]}
                      />
                      <View
                        style={[
                          styles.themeSwatchBar,
                          styles.themeSwatchBarShort,
                          { backgroundColor: preview.colors.brand },
                        ]}
                      />
                    </View>
                  </View>

                  <Text variant="caption" tone={selected ? 'brand' : 'muted'}>
                    {preview.label}
                  </Text>

                  {selected ? (
                    <Ionicons name="checkmark-circle" size={14} color={colors.brand} />
                  ) : (
                    <View style={styles.themeCheckSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text variant="caption" tone="faint">
            {THEMES[themeName].description}
          </Text>
        </Card>

        <SectionHeader title="Segurança" />
        <Card padded={false}>
          <Row
            icon="lock-closed"
            label="Trava do app"
            value={pinEnabled ? 'PIN ativo' : 'sem senha'}
            onPress={() => router.push('/security')}
          />
          {pinEnabled ? (
            <Row
              icon="finger-print"
              label="Biometria"
              value={biometricsEnabled ? `${biometricsLabel} ativa` : 'desligada'}
              onPress={() => router.push('/security')}
              bordered
            />
          ) : null}
        </Card>

        <SectionHeader title="Backup automático" />
        <Card padded={false}>
          {folder ? (
            <>
              <Row
                icon="shield-checkmark"
                label="Salvando em"
                value={folder.label}
                onPress={handleChooseFolder}
              />
              <Row
                icon="save-outline"
                label="Fazer backup agora"
                value={
                  lastBackup
                    ? `último ${formatDateBR(isoFrom(lastBackup))}`
                    : 'nenhum ainda'
                }
                onPress={handleBackupNow}
                disabled={busy}
                bordered
              />
              <Row
                icon="close-circle-outline"
                label="Desligar backup automático"
                onPress={handleDisableAuto}
                bordered
              />
            </>
          ) : (
            <Row
              icon="shield-outline"
              label="Escolher pasta de backup"
              value="desligado"
              onPress={handleChooseFolder}
            />
          )}
        </Card>

        <Text variant="caption" tone="faint" style={styles.note}>
          {folder
            ? 'Uma cópia é salva toda vez que você abre o app, no máximo uma a cada 12 horas. Os 7 backups mais recentes são mantidos.'
            : 'Escolha uma pasta fora do app — Downloads ou uma sincronizada com o Drive. Assim os backups sobrevivem mesmo se o app for desinstalado.'}
        </Text>

        <SectionHeader title="Dados" />
        <Card padded={false}>
          <Row
            icon="share-outline"
            label="Exportar backup"
            value="JSON"
            onPress={handleExport}
            disabled={busy}
          />
          <Row
            icon="download-outline"
            label="Importar backup"
            onPress={handleImport}
            disabled={busy}
            bordered
          />
          <Row
            icon="trash-outline"
            label="Zerar tudo"
            onPress={handleReset}
            disabled={busy}
            danger
            bordered
          />
        </Card>

        <Text variant="caption" tone="faint" align="center" style={styles.footer}>
          Meu Caixa · seus dados ficam só neste aparelho
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  bordered = false,
  danger = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  bordered?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const tint = danger ? colors.negative : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        bordered ? styles.bordered : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={[styles.rowIcon, danger ? styles.rowIconDanger : null]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>

      <Text variant="body" color={danger ? colors.negative : colors.text} style={styles.rowLabel}>
        {label}
      </Text>

      {value ? (
        <Text variant="caption" tone="faint">
          {value}
        </Text>
      ) : null}

      <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 58,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
  disabled: {
    opacity: 0.5,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: colors.negativeDim,
  },
  rowLabel: {
    flex: 1,
  },
  footer: {
    marginTop: spacing.xl,
  },
  note: {
    paddingHorizontal: spacing.xs,
    lineHeight: 17,
  },
  themeCard: {
    gap: spacing.md,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeSwatch: {
    width: '100%',
    height: 64,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  themeSwatchCard: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  themeSwatchBar: {
    height: 4,
    borderRadius: 2,
    width: '70%',
  },
  themeSwatchBarShort: {
    width: '40%',
  },
  themeCheckSpacer: {
    height: 14,
  },
}));
