import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Keypad } from '@/ui/Keypad';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import {
  authenticateWithBiometrics,
  getLockedUntil,
  PIN_LENGTH,
  verifyPin,
} from '@/services/security';
import { useLockStore } from '@/stores/lock';
import { makeStyles, radius, spacing, useColors } from '@/theme';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function LockScreen() {
  const styles = useStyles();
  const colors = useColors();
  const unlock = useLockStore((state) => state.unlock);
  const biometricsEnabled = useLockStore((state) => state.biometricsEnabled);
  const biometricsLabel = useLockStore((state) => state.biometricsLabel);

  const [pin, setPin] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const biometricsTried = useRef(false);

  useEffect(() => {
    getLockedUntil().then(setLockedUntil);
  }, []);

  useEffect(() => {
    if (lockedUntil === null) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const left = lockedUntil - Date.now();
      if (left <= 0) {
        setLockedUntil(null);
        setRemaining(0);
        setAttemptsLeft(null);
        return;
      }
      setRemaining(left);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const runBiometrics = useCallback(async () => {
    const ok = await authenticateWithBiometrics();
    if (ok) unlock();
  }, [unlock]);

  useEffect(() => {
    if (!biometricsEnabled || biometricsTried.current || lockedUntil !== null) return;
    biometricsTried.current = true;
    runBiometrics();
  }, [biometricsEnabled, lockedUntil, runBiometrics]);

  const playError = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const submit = useCallback(
    async (candidate: string) => {
      const result = await verifyPin(candidate);

      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        unlock();
        return;
      }

      playError();
      setPin('');
      setLockedUntil(result.lockedUntil);
      setAttemptsLeft(result.lockedUntil ? null : result.attemptsLeft);
    },
    [playError, unlock],
  );

  const handleDigit = (digit: string) => {
    if (lockedUntil !== null) return;
    const next = pin + digit;
    if (next.length > PIN_LENGTH) return;

    setPin(next);
    setAttemptsLeft(null);

    if (next.length === PIN_LENGTH) submit(next);
  };

  const blocked = lockedUntil !== null;

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={26} color={colors.brandText} />
        </View>

        <Text variant="heading" align="center">
          {blocked ? 'Muitas tentativas' : 'Digite seu PIN'}
        </Text>

        {blocked ? (
          <Text variant="body" tone="warning" align="center">
            Tente novamente em {formatCountdown(remaining)}
          </Text>
        ) : attemptsLeft !== null ? (
          <Text variant="caption" tone="negative" align="center">
            PIN incorreto. {attemptsLeft}{' '}
            {attemptsLeft === 1 ? 'tentativa restante' : 'tentativas restantes'}
          </Text>
        ) : (
          <Text variant="caption" tone="faint" align="center">
            Seus dados ficam só neste aparelho
          </Text>
        )}

        <Animated.View
          style={[
            styles.dots,
            { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] },
          ]}
        >
          {Array.from({ length: PIN_LENGTH }, (_, index) => (
            <View
              key={index}
              style={[styles.dot, index < pin.length ? styles.dotFilled : null]}
            />
          ))}
        </Animated.View>
      </View>

      <View style={styles.keypad}>
        <Keypad
          onDigit={handleDigit}
          onBackspace={() => setPin((current) => current.slice(0, -1))}
          leftAction={
            biometricsEnabled && !blocked
              ? {
                  icon: 'finger-print',
                  label: `Desbloquear com ${biometricsLabel}`,
                  onPress: runBiometrics,
                }
              : undefined
          }
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
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
  keypad: {
    paddingBottom: spacing.xl,
  },
}));
