import { Platform, StyleSheet, Text, useColorScheme, type TextProps } from 'react-native';

import { Colors, Fonts } from '../constants/theme';

// Cria a tipagem dinamicamente com base nas cores que existem no seu arquivo de tema
type ThemeColorType = keyof typeof Colors.light;

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColorType;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  // MANUTENÇÃO FUTURA: Substituímos o '@/hooks/use-theme' pela função nativa do React Native.
  // Assim, garantimos que a cor do texto muda entre modo Claro/Escuro sem depender de arquivos externos.
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Text
      style={[
        // Usamos 'as any' para garantir que o TypeScript não reclame de tipagem estrita na paleta de cores
        { color: (themeColors as any)[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500', // MANUTENÇÃO: Convertido para string (com aspas) para o TypeScript não gerar linha vermelha
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: '600',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: (Fonts as any)?.mono ?? 'monospace',
    fontWeight: Platform.select({ android: '700' as const }) ?? '500',
    fontSize: 12,
  },
});