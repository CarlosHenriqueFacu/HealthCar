import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChartPeriod } from '../utils/chart-period';

interface ChartPeriodToggleProps {
  value: ChartPeriod;
  onChange: (period: ChartPeriod) => void;
  cardColor: string;
  borderColor: string;
  mutedColor: string;
  activeColor?: string;
  dayLabel?: string;
  monthLabel?: string;
}

export function ChartPeriodToggle({
  value,
  onChange,
  cardColor,
  borderColor,
  mutedColor,
  activeColor = '#00B4FF',
  dayLabel = 'Dia',
  monthLabel = 'Mês',
}: ChartPeriodToggleProps) {
  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      {([
        ['day', dayLabel],
        ['month', monthLabel],
      ] as const).map(([period, label]) => {
        const selected = value === period;
        return (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(period)}
            style={[styles.option, selected && { backgroundColor: activeColor }]}
          >
            <Text style={[styles.label, { color: selected ? '#04131A' : mutedColor }, selected && styles.selectedLabel]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 9,
    padding: 2,
    alignSelf: 'flex-start',
  },
  option: {
    minWidth: 42,
    minHeight: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  label: { fontSize: 10, fontWeight: '600' },
  selectedLabel: { color: '#04131A', fontWeight: '800' },
});
