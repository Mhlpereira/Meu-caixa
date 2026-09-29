import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { createCommitment } from '@/repositories/commitments';
import { listCategories } from '@/repositories/categories';
import { updateProfile } from '@/repositories/profiles';
import { setPin } from '@/services/security';
import { useAppStore } from '@/stores/app';
import { useLockStore } from '@/stores/lock';
import { makeStyles, radius, spacing, useColors } from '@/theme';
import { currentCompetence, dueDateIn } from '@/utils/date';
import { appendDigit, formatMoney, removeDigit } from '@/utils/money';
import { Button } from '@/ui/Button';
import { Field, Input } from '@/ui/Field';
import { Keypad } from '@/ui/Keypad';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { PIN_LENGTH } from '@/services/security';

type Step = 'profiles' | 'income' | 'security';

const STEPS: Step[] = ['profiles', 'income', 'security'];

export function OnboardingScreen() {
  const styles = useStyles();
  const colors = useColors();
  const profiles = useAppStore((state) => state.profiles);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const setOnboardingDone = useAppStore((state) => state.setOnboardingDone);
  const bumpRevision = useAppStore((state) => state.bumpRevision);
  const setPinEnabled = useLockStore((state) => state.setPinEnabled);

  const [step, setStep] = useState<Step>('profiles');
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.name])),
  );

  const [salary, setSalary] = useState(0);
  const [salaryDay, setSalaryDay] = useState('5');

  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const finish = async () => {
    await setOnboardingDone(true);
    bumpRevision();
  };

  const saveProfiles = async () => {
    setSaving(true);
    for (const profile of profiles) {
      const name = names[profile.id]?.trim();
      if (name && name !== profile.name) {
        await updateProfile(profile.id, { name, color: profile.color, icon: profile.icon });
      }
    }
    await refreshProfiles();
    setSaving(false);
    setStep('income');
  };

  const saveSalary = async () => {
    if (salary <= 0) {
      setStep('security');
      return;
    }

    setSaving(true);
    const day = Math.max(1, Math.min(Number(salaryDay) || 5, 31));
    const categories = await listCategories('income');
    const salaryCategory = categories.find((category) => category.name === 'Salário');
    const targetProfile = profiles[0];

    if (targetProfile) {
      await createCommitment({
        profileId: targetProfile.id,
        categoryId: salaryCategory?.id ?? null,
        kind: 'income',
        type: 'recurring',
        description: 'Salário',
        amount: salary,
        installments: null,
        startDate: dueDateIn(currentCompetence(), day),
        endDate: null,
        dayOfMonth: day,
        notes: null,
        isInvestment: false,
        goalId: null,
      });
    }

    bumpRevision();
    setSaving(false);
    setStep('security');
  };

  const handlePinDigit = (digit: string) => {
    setPinError(null);

    if (!confirming) {
      const next = pin + digit;
      if (next.length > PIN_LENGTH) return;
      setPinValue(next);
      if (next.length === PIN_LENGTH) setConfirming(true);
      return;
    }

    const next = confirmPin + digit;
    if (next.length > PIN_LENGTH) return;
    setConfirmPin(next);

    if (next.length === PIN_LENGTH) {
      if (next === pin) {
        setSaving(true);
        setPin(next).then(() => {
          setPinEnabled(true);
          setSaving(false);
          finish();
        });
      } else {
        setPinError('Os dois PINs não batem. Vamos de novo.');
        setPinValue('');
        setConfirmPin('');
        setConfirming(false);
      }
    }
  };

  const handlePinBackspace = () => {
    if (confirming) {
      if (confirmPin.length === 0) {
        setConfirming(false);
        setPinValue((current) => current.slice(0, -1));
        return;
      }
      setConfirmPin((current) => current.slice(0, -1));
      return;
    }
    setPinValue((current) => current.slice(0, -1));
  };

  const activePin = confirming ? confirmPin : pin;

  return (
    <Screen>
      <View style={styles.progress}>
        {STEPS.map((current, index) => (
          <View
            key={current}
            style={[styles.progressDot, index <= stepIndex ? styles.progressDotActive : null]}
          />
        ))}
      </View>

      {step === 'profiles' ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <StepHeader
            icon="people"
            title="Separe o que é seu do que é da empresa"
            description="Cada perfil tem seus próprios lançamentos e saldo. Depois você vê tudo somado numa aba só."
          />

          {profiles.map((profile) => (
            <Field key={profile.id} label={profile.name}>
              <Input
                value={names[profile.id] ?? ''}
                onChangeText={(text) => setNames((current) => ({ ...current, [profile.id]: text }))}
                placeholder="Nome do perfil"
                maxLength={24}
              />
            </Field>
          ))}

          <Button
            label="Continuar"
            onPress={saveProfiles}
            size="lg"
            fullWidth
            loading={saving}
            style={styles.action}
          />
        </ScrollView>
      ) : null}

      {step === 'income' ? (
        <View style={styles.body}>
          <StepHeader
            icon="wallet"
            title="Quanto entra por mês?"
            description="Cadastre seu salário agora. Ele vai aparecer sozinho em todos os meses."
          />

          <View style={styles.amountBox}>
            <Text variant="display" color={salary > 0 ? colors.positive : colors.textFaint}>
              {formatMoney(salary)}
            </Text>
          </View>

          <Field label="Cai todo dia">
            <Input
              value={salaryDay}
              onChangeText={(text) => setSalaryDay(text.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="5"
            />
          </Field>

          <Keypad
            compact
            onDigit={(digit) => setSalary((current) => appendDigit(current, digit))}
            onBackspace={() => setSalary(removeDigit)}
          />

          <View style={styles.actions}>
            <Button label="Pular" onPress={() => setStep('security')} variant="ghost" />
            <Button
              label="Continuar"
              onPress={saveSalary}
              loading={saving}
              style={styles.grow}
            />
          </View>
        </View>
      ) : null}

      {step === 'security' ? (
        <View style={styles.body}>
          <StepHeader
            icon="lock-closed"
            title={confirming ? 'Confirme o PIN' : 'Quer trancar o app?'}
            description={
              confirming
                ? 'Digite os mesmos 6 dígitos de novo.'
                : 'Um PIN de 6 dígitos protege seus dados. Não há como recuperar se esquecer — anote em algum lugar seguro.'
            }
          />

          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <View
                key={index}
                style={[styles.dot, index < activePin.length ? styles.dotFilled : null]}
              />
            ))}
          </View>

          {pinError ? (
            <Text variant="caption" tone="negative" align="center">
              {pinError}
            </Text>
          ) : null}

          <Keypad compact onDigit={handlePinDigit} onBackspace={handlePinBackspace} />

          <Button label="Deixar sem senha" onPress={finish} variant="ghost" fullWidth />
        </View>
      ) : null}
    </Screen>
  );
}

function StepHeader({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name={icon} size={24} color={colors.brandText} />
      </View>
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center">
        {description}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  progressDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.brand,
  },
  body: {
    flex: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 'auto',
  },
  action: {
    marginTop: spacing.lg,
  },
  grow: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.md,
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
