import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/screen-container';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppPalette } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

interface VehicleProfile {
  marca?: string;
  veiculo?: string;
  ano?: string;
  km?: string;
  motor?: string;
  combustivel?: string;
}

export default function VehicleHubScreen() {
  const { theme, t } = useApp();
  const colors = AppPalette[theme];
  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadVehicle = async () => {
      try {
        const savedVehicle = await AsyncStorage.getItem('@veiculo_cadastrado');
        if (savedVehicle && isMounted) {
          const parsed: unknown = JSON.parse(savedVehicle);
          if (isVehicleProfile(parsed)) setVehicle(parsed);
        }
      } catch (error) {
        console.error('[VehicleHub] Falha ao carregar o veículo salvo:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadVehicle();
    return () => {
      isMounted = false;
    };
  }, []);

  const goTo = (path: '/tempo-real' | '/scanner' | '/relatorios') => {
    router.push(path);
  };

  const vehicleName = [vehicle?.marca, vehicle?.veiculo].filter(Boolean).join(' ');

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('centralVeiculo')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{t('saudeManutencao')}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t('hubTitulo')}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('hubDescricao')}</Text>

        <View style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.vehicleIcon, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialIcons name="directions-car" size={25} color={colors.primary} />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={[styles.vehicleLabel, { color: colors.textSecondary }]}>{t('veiculoCadastrado')}</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loading} />
            ) : (
              <>
                <Text style={[styles.vehicleName, { color: colors.text }]}>
                  {vehicleName || t('nenhumVeiculoCadastrado')}
                </Text>
                <Text style={[styles.vehicleMeta, { color: colors.textSecondary }]}>
                  {vehicle ? [vehicle.ano, vehicle.motor, vehicle.combustivel].filter(Boolean).join(' · ') : t('configurarParaMonitoramento')}
                </Text>
              </>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('configurarVeiculo')}
            onPress={() => router.push('/(auth)/cadastro')}
            hitSlop={8}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="edit" size={19} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('oQueDesejaFazer')}</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>{t('atalhos')}</Text>
        </View>

        <ActionRow
          icon="search"
          title={t('escanearFalhas')}
          description={t('scanDescricao')}
          color={colors.danger}
          backgroundColor={colors.surface}
          borderColor={colors.border}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
          onPress={() => goTo('/scanner')}
        />
        <ActionRow
          icon="sensors"
          title={t('monitorarVeiculo')}
          description={t('monitoramentoDescricao')}
          color={colors.positive}
          backgroundColor={colors.surface}
          borderColor={colors.border}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
          onPress={() => goTo('/tempo-real')}
        />
        <ActionRow
          icon="build-circle"
          title={t('relatorios')}
          description={t('manutencaoDescricao')}
          color={colors.primary}
          backgroundColor={colors.surface}
          borderColor={colors.border}
          textColor={colors.text}
          secondaryColor={colors.textSecondary}
          onPress={() => goTo('/relatorios')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function isVehicleProfile(value: unknown): value is VehicleProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['marca', 'veiculo', 'ano', 'km', 'motor', 'combustivel'].every(
    (key) => candidate[key] === undefined || typeof candidate[key] === 'string',
  );
}

interface ActionRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  secondaryColor: string;
  onPress: () => void;
}

function ActionRow({
  icon,
  title,
  description,
  color,
  backgroundColor,
  borderColor,
  textColor,
  secondaryColor,
  onPress,
}: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.actionDescription, { color: secondaryColor }]}>{description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={secondaryColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    maxWidth: 360,
    marginTop: -8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: -8,
  },
  vehicleCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    gap: 4,
  },
  vehicleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vehicleMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  loading: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCaption: {
    fontSize: 12,
  },
  actionRow: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
});
