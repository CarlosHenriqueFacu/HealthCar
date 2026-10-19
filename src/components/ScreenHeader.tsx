import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppPalette } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  actionIcon?: keyof typeof MaterialIcons.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
}

export function ScreenHeader({
  title,
  onBack = () => router.back(),
  actionIcon,
  actionLabel,
  onActionPress,
  actionDisabled = false,
}: ScreenHeaderProps) {
  const { theme, t } = useApp();
  const colors = AppPalette[theme];

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('voltar')}
        onPress={onBack}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surfaceMuted },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="arrow-back" size={21} color={colors.text} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {actionIcon && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? title}
          disabled={actionDisabled}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surfaceMuted },
            (pressed || actionDisabled) && styles.pressed,
          ]}
        >
          <MaterialIcons
            name={actionIcon}
            size={21}
            color={actionDisabled ? colors.textSecondary : colors.primary}
          />
        </Pressable>
      ) : (
        <View style={styles.buttonPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPlaceholder: {
    width: 44,
    height: 44,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
