import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockScreen } from '@/screens/LockScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { useAppStore } from '@/stores/app';
import { useLockStore } from '@/stores/lock';
import { useThemeStore } from '@/stores/theme';
import { makeStyles, spacing, useColors, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

export default function RootLayout() {
  const styles = useStyles();
  const colors = useColors();
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const bootstrap = useAppStore((state) => state.bootstrap);
  const appReady = useAppStore((state) => state.ready);
  const onboardingDone = useAppStore((state) => state.onboardingDone);

  const loadTheme = useThemeStore((state) => state.load);
  const themeLoaded = useThemeStore((state) => state.loaded);
  const theme = useTheme();

  const checkLock = useLockStore((state) => state.check);
  const lockChecked = useLockStore((state) => state.checked);
  const unlocked = useLockStore((state) => state.unlocked);

  const runBoot = useCallback(async () => {
    setBootError(null);
    setBooted(false);

    const steps: Array<[string, Promise<unknown>]> = [
      ['dados', bootstrap()],
      ['trava', checkLock()],
      ['tema', loadTheme()],
    ];

    const results = await Promise.allSettled(steps.map(([, promise]) => promise));
    const failures = results
      .map((result, index) => ({ result, label: steps[index][0] }))
      .filter((item) => item.result.status === 'rejected');

    if (failures.length > 0) {
      const first = failures[0];
      const reason = (first.result as PromiseRejectedResult).reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      setBootError(`Falha ao carregar ${first.label}: ${message}`);
    }

    setBooted(true);
  }, [bootstrap, checkLock, loadTheme]);

  useEffect(() => {
    runBoot();
  }, [runBoot]);

  useAutoLock();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => undefined);

    if (Platform.OS === 'android') {
      NavigationBar.setStyle(theme.dark ? 'light' : 'dark');
    }
  }, [theme]);

  const loading = !booted;
  const notReady = !appReady || !lockChecked || !themeLoaded;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {loading ? (
          <View style={styles.splash}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : bootError || notReady ? (
          <View style={styles.splash}>
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={28} color={colors.warning} />
              <Text variant="heading" align="center">
                O app não conseguiu abrir
              </Text>
              <Text variant="caption" tone="muted" align="center">
                {bootError ?? 'Algum dado não terminou de carregar.'}
              </Text>
              <Button label="Tentar de novo" onPress={runBoot} icon="refresh" />
            </View>
          </View>
        ) : !unlocked ? (
          <LockScreen />
        ) : !onboardingDone ? (
          <OnboardingScreen />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="quick" options={{ presentation: 'modal' }} />
            <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="split" options={{ presentation: 'modal' }} />
            <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
            <Stack.Screen name="occurrence/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="profiles" options={{ presentation: 'modal' }} />
            <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
            <Stack.Screen name="security" options={{ presentation: 'modal' }} />
            <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function useAutoLock() {
  const markBackgrounded = useLockStore((state) => state.markBackgrounded);
  const shouldRelock = useLockStore((state) => state.shouldRelock);
  const lock = useLockStore((state) => state.lock);
  const bumpRevision = useAppStore((state) => state.bumpRevision);
  const previous = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const wasActive = previous.current === 'active';

      if (wasActive && next.match(/inactive|background/)) {
        markBackgrounded();
      }

      if (!wasActive && next === 'active') {
        if (shouldRelock()) lock();
        bumpRevision();
      }

      previous.current = next;
    });

    return () => subscription.remove();
  }, [markBackgrounded, shouldRelock, lock, bumpRevision]);
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  errorBox: {
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 320,
  },
}));
