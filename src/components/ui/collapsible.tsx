import { PropsWithChildren, useState } from "react";
// MANUTENÇÃO FUTURA: Adicionado o useColorScheme nativo
import { Text, TouchableOpacity, View, useColorScheme } from "react-native";

import { IconSymbol } from "./icon-symbol";

// MANUTENÇÃO FUTURA: Removemos a dependência do arquivo 'use-colors' inexistente.
// Agora, importamos o padrão de cores direto do arquivo de tema validado do projeto.
import { Colors } from "../../constants/theme";

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // MANUTENÇÃO FUTURA: Lógica nativa para detectar se o celular está no modo claro ou escuro
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    // MANUTENÇÃO FUTURA: Aplicado o bypass {...{ className: "..." } as any} 
    // em todos os componentes nativos para o TypeScript não reclamar do Tailwind.
    <View {...{ className: "bg-background" } as any}>
      <TouchableOpacity
        {...{ className: "flex-row items-center gap-1.5" } as any}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          // Usamos 'as any' para garantir a tipagem. 
          // O fallback '?? themeColors.text' garante que o ícone não suma se a cor 'icon' não estiver mapeada.
          color={(themeColors as any).icon ?? themeColors.text}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
        />
        <Text {...{ className: "text-base font-semibold text-foreground" } as any}>
          {title}
        </Text>
      </TouchableOpacity>
      
      {isOpen && (
        <View {...{ className: "mt-1.5 ml-6" } as any}>
          {children}
        </View>
      )}
    </View>
  );
}