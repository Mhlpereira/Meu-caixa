import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { makeStyles, spacing, useColors } from '@/theme';
import { formatDateBR, makeISODate, parseISODate, type ISODate } from '@/utils/date';

import { Button } from './Button';
import { Select } from './Field';

export interface DateFieldProps {
  value: ISODate;
  onChange: (value: ISODate) => void;
  label?: string;
}

export function DateField({ value, onChange, label }: DateFieldProps) {
  const styles = useStyles();
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const { year, month, day } = parseISODate(value);
  const asDate = new Date(year, month - 1, day);

  const handleChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (!selected) return;
    onChange(makeISODate(selected.getFullYear(), selected.getMonth() + 1, selected.getDate()));
  };

  return (
    <View style={styles.container}>
      <Select
        value={formatDateBR(value)}
        icon="calendar-outline"
        onPress={() => setOpen(true)}
      />

      {open ? (
        <View style={styles.picker}>
          <DateTimePicker
            value={asDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            locale="pt-BR"
            onChange={handleChange}
            accessibilityLabel={label ?? 'Selecionar data'}
          />
          {Platform.OS === 'ios' ? (
            <Button label="Pronto" onPress={() => setOpen(false)} variant="secondary" fullWidth />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    gap: spacing.sm,
  },
  picker: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
}));
