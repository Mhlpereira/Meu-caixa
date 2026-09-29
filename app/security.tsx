import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { setBooleanSetting, setSetting } from '@/repositories/settings';
import { PIN_LENGTH, removePin, setPin, verifyPin } from '@/services/security';
import { useLockStore } from '@/stores/lock';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Keypad } from '@/ui/Keypad';
import { Screen, SectionHeader } from '@/ui/Screen';
import { Sheet, SheetOption } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

type Flow = 'idle' | 'current' | 'new' | 'confirm';

const TIMEOUTS = [
  { value: 0, label: 'Na hora' },
  { value: 60, label: 'Depois de 1 minuto' },
  { value: 300, label: 'Depois de 5 minutos' },
  { value: 900, label: 'Depois de 15 minutos' },
];

export default function SecurityScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const pinEnabled = useLockStore((state) => state.pinEnabled);
  const biometricsEnabled = useLockStore((state) => state.biometricsEnabled);
  const biometricsAvailable = useLockStore((state) => state.biometricsAvailable);
  const biometricsLabel = useLockStore((state) => state.biometricsLabel);
  const lockTimeoutSeconds = useLockStore((state) => state.lockTimeoutSeconds);
  const setBiometricsEnabled = useLockStore((state) => state.setBiometricsEnabled);
  const setPinEnabled = useLockStore((state) => state.setPinEnabled);
  const check = useLockStore((state) => state.check);

  const [flow, setFlow] = useState<Flow>('idle');
  const [entered, setEntered] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState(false);
  const [timeoutSheet, setTimeoutSheet] = useState(false);

  const resetFlow = () => {
    setFlow('idle');
    setEntered('');
    setNewPin('');
    setError(null);
    setPendingRemoval(false);
  };

  const startChange = () => {
    setError(null);
    setEntered('');
    setNewPin('');
    setPendingRemoval(false);
    setFlow(pinEnabled ? 'current' : 'new');
  };

  const startRemoval = () => {
    setError(null);
    setEntered('');
    setPendingRemoval(true);
    setFlow('current');
  };

  const handleDigit = async (digit: string) => {
    setError(null);
    const next = entered + digit;
    if (next.length > PIN_LENGTH) return;
    setEntered(next);

    if (next.length < PIN_LENGTH) return;

    if (flow === 'current') {
      const result = await verifyPin(next);

      if (!result.ok) {
        setError(
          result.lockedUntil
            ? 'Muitas tentativas. Tente de novo daqui a pouco.'
            : `PIN incorreto. ${result.attemptsLeft} tentativas restantes.`,
        );
        setEntered('');
        return;
      }

      if (pendingRemoval) {
        await removePin();
        await setBooleanSetting('biometrics_enabled', false);
        await check();
        resetFlow();
        Alert.alert('Trava removida', 'O app não vai mais pedir PIN.');
        return;
      }

      setEntered('');
      setFlow('new');
      return;
    }

    if (flow === 'new') {
      setNewPin(next);
      setEntered('');
      setFlow('confirm');
      return;
    }

    if (flow === 'confirm') {
      if (next !== newPin) {
        setError('Os dois PINs não batem. Vamos de novo.');
        setEntered('');
        setNewPin('');
        setFlow('new');
        return;
      }

      await setPin(next);
      setPinEnabled(true);
      await check();
      resetFlow();
      Alert.alert('Pronto', 'PIN definido. O app vai pedir ele ao abrir.');
    }
  };

  const toggleBiometrics = async (value: boolean) => {
    setBiometricsEnabled(value);
    await setBooleanSetting('biometrics_enabled', value);
  };

  const changeTimeout = async (value: number) => {
    await setSetting('lock_timeout_seconds', String(value));
    await check();
    setTimeoutSheet(false);
  };

  const flowTitle =
    flow === 'current'
      ? pendingRemoval
        ? 'Digite o PIN atual para remover'
        : 'Digite o PIN atual'
      : flow === 'new'
        ? 'Escolha um PIN de 6 dígitos'
        : 'Confirme o novo PIN';

  const currentTimeoutLabel =
    TIMEOUTS.find((option) => option.value === lockTimeoutSeconds)?.label ??
    `Depois de ${lockTimeoutSeconds}s`;

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => (flow === 'idle' ? router.back() : resetFlow())}
          style={styles.topButton}
        >
          <Ionicons name={flow === 'idle' ? 'close' : 'arrow-back'} size={22} color={colors.textMuted} />
        </Pressable>
        <Text variant="heading">Segurança</Text>
        <View style={styles.topButton} />
      </View>

      {flow === 'idle' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.statusCard}>
            <View style={[styles.statusIcon, pinEnabled ? styles.statusIconOn : null]}>
              <Ionicons
                name={pinEnabled ? 'lock-closed' : 'lock-open'}
                size={22}
                color={pinEnabled ? colors.positive : colors.textMuted}
              />
            </View>
            <View style={styles.statusText}>
              <Text variant="body">{pinEnabled ? 'App protegido' : 'App sem senha'}</Text>
              <Text variant="caption" tone="faint">
                {pinEnabled
                  ? 'Pede PIN ao abrir e ao voltar do background'
                  : 'Qualquer um que pegar seu celular vê seus dados'}
              </Text>
            </View>
          </Card>

          <Button
            label={pinEnabled ? 'Trocar PIN' : 'Definir PIN'}
            icon="keypad"
            onPress={startChange}
            variant={pinEnabled ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
          />

          {pinEnabled ? (
            <>
              <SectionHeader title="Opções" />

              <Card padded={false}>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text variant="body">Desbloquear com {biometricsLabel}</Text>
                    <Text variant="caption" tone="faint">
                      {biometricsAvailable
                        ? 'O PIN continua funcionando como alternativa'
                        : 'Não disponível neste aparelho'}
                    </Text>
                  </View>
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={toggleBiometrics}
                    disabled={!biometricsAvailable}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor={colors.text}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Trancar ${currentTimeoutLabel}`}
                  onPress={() => setTimeoutSheet(true)}
                  style={({ pressed }) => [
                    styles.row,
                    styles.bordered,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text variant="body">Trancar ao sair do app</Text>
                    <Text variant="caption" tone="faint">
                      {currentTimeoutLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
                </Pressable>
              </Card>

              <Button
                label="Remover a trava"
                icon="lock-open"
                onPress={startRemoval}
                variant="danger"
                fullWidth
              />
            </>
          ) : null}

          <Card style={styles.warningCard}>
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <Text variant="caption" tone="warning" style={styles.warningText}>
              Não há como recuperar um PIN esquecido — não existe servidor nem e-mail de
              recuperação. Exporte um backup antes, em Ajustes › Dados.
            </Text>
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.flow}>
          <Text variant="heading" align="center">
            {flowTitle}
          </Text>

          {error ? (
            <Text variant="caption" tone="negative" align="center">
              {error}
            </Text>
          ) : null}

          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <View
                key={index}
                style={[styles.dot, index < entered.length ? styles.dotFilled : null]}
              />
            ))}
          </View>

          <Keypad
            compact
            onDigit={handleDigit}
            onBackspace={() => setEntered((current) => current.slice(0, -1))}
          />
        </View>
      )}

      <Sheet visible={timeoutSheet} title="Trancar ao sair" onClose={() => setTimeoutSheet(false)}>
        {TIMEOUTS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            selected={lockTimeoutSeconds === option.value}
            onPress={() => changeTimeout(option.value)}
          />
        ))}
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconOn: {
    backgroundColor: colors.positiveDim,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.cardElevated,
  },
  warningCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.warningDim,
    borderColor: 'transparent',
  },
  warningText: {
    flex: 1,
  },
  flow: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
}));
