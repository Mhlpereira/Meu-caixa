import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { parseReceiptCode } from '@/domain/split';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function ScanScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handled = useRef(false);

  const goToSplit = (total: number | null, accessKey: string | null) => {
    router.replace({
      pathname: '/split',
      params: {
        total: total === null ? '' : String(total),
        accessKey: accessKey ?? '',
      },
    });
  };

  const handleCode = ({ data }: { data: string }) => {
    if (handled.current) return;

    const scan = parseReceiptCode(data);
    if (!scan.accessKey) return;

    handled.current = true;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    goToSplit(scan.total, scan.accessKey);
  };

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
          <Text variant="heading" align="center">
            Precisa da câmera
          </Text>
          <Text variant="body" tone="muted" align="center">
            Para ler o QR code da nota fiscal. A foto não sai do aparelho.
          </Text>
          <Button label="Permitir câmera" onPress={requestPermission} size="lg" />
          <Button
            label="Lançar sem a nota"
            onPress={() => goToSplit(null, null)}
            variant="ghost"
          />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleCode}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => router.replace('/(tabs)')}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.frame} />

        <View style={styles.bottom}>
          <Text variant="body" align="center" color="#FFFFFF">
            {scanned ? 'Nota lida' : 'Aponte para o QR code da nota'}
          </Text>
          <Text variant="caption" align="center" color="#FFFFFFAA">
            Fica na parte de baixo do cupom
          </Text>

          <Button
            label="Digitar o valor"
            icon="keypad"
            onPress={() => goToSplit(null, null)}
            variant="secondary"
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: '#FFFFFFCC',
  },
  bottom: {
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: '#00000088',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
}));
