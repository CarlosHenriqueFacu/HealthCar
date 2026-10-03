import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
type Language = 'pt' | 'en';

interface AppContextData {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextData>({} as AppContextData);

// Dicionário expandido abrangendo Configurações e Tela Inicial
const dicionario = {
  pt: {
    // Tela de Configurações
    configuracoes: 'Configurações',
    conta: 'Conta e Login',
    contaSub: 'Gerenciar sessão ou desconectar',
    veiculo: 'Configuração do Veículo',
    veiculoSub: 'Alterar parâmetros e pareamento',
    idioma: 'Idioma',
    idiomaSub: 'Português (Brasil)',
    tema: 'Tema',
    temaSub: 'Modo Escuro',
    temaSubClaro: 'Modo Claro',
    
    // Tela Inicial (index.tsx)
    sistemaOnline: 'Sistema Online',
    conectando: 'A conectar...',
    modoOffline: 'Modo Offline',
    motorOk: 'Motor OK',
    zeroErros: '0 Erros',
    painelTempoReal: 'Painel em Tempo Real',
    kmTotal: 'KM Total',
    kmHoje: 'KM Hoje',
    temperatura: 'Temperatura',
    combustivel: 'Combustível',
    bateria: 'Bateria',
    
    // Status da Bateria
    batCarregando: 'A Carregar (Alternador)',
    batIdeal: 'Ideal',
    batFraca: 'Atenção (Fraca)',
    batDesconhecido: 'Desconhecido',
    
    // Ferramentas
    ferramentas: 'Ferramentas',
    scanner: 'Scanner de Falhas',
    scannerSub: 'Módulo Real Ativo',
    relatorios: 'Relatórios e Óleo',
    relatoriosSub: 'Próx. troca: 2.400 km',
    reconectar: 'Reconectar',
    reconectarSub: 'Tentar novamente',
    
    // Alertas e Modais
    atencaoKm: 'Atenção à Quilometragem',
    ignorar: 'Ignorar',
    atualizarSistema: 'Atualizar Sistema',
    emImplementacao: 'EM IMPLEMENTAÇÃO',
    
    // Scanner
    tituloScanner: 'Scanner OBD-II',
    saudeVeiculo: 'Saúde do Veículo',
    emPerfeitoEstado: 'Em perfeito estado',
    atencaoNecessaria: 'Atenção necessária',
    analisandoEcu: 'Analisando ECU...',
    errosEncontrados: 'erro(s) encontrado(s)',
    codigosFalha: 'Códigos de Falha',
    nenhumaFalha: 'Nenhuma falha detectada!',
    nenhumaFalhaDesc: 'A injeção eletrônica não reportou nenhum código de erro ativo ou pendente.',
    apagando: 'Apagando...',
    apagarMemoria: 'Apagar Memória de Falhas',
    agendarRevisao: 'Agendar Revisão',
    escaneandoEcu: 'Escaneando a ECU...',
    novoEscaneamento: 'Novo Escaneamento',
    critico: 'Crítico',
    aviso: 'Aviso',
    resolvido: 'Resolvido',

    // Relatórios
    tituloRelatorios: 'Relatórios e Óleo',
    proximaTrocaOleo: 'Próxima Troca de Óleo',
    faltamKm: 'Faltam',
    doIntervalo: 'do intervalo',
    consumoMensal: 'Consumo Mensal',
    litrosAbastecidos: 'Litros abastecidos por mês (2025)',
    historicoOleo: 'Histórico de Óleo',
    prox: 'Próx.',
    historicoManutencao: 'Histórico de Manutenção',

    // Gráfico Home
    consumoSemanal: 'Consumo Semanal',
    litrosPorDia: 'Litros por dia',
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
    dom: 'Dom',
  },
  en: {
    // Settings Screen
    configuracoes: 'Settings',
    conta: 'Account & Login',
    contaSub: 'Manage session or logout',
    veiculo: 'Vehicle Configuration',
    veiculoSub: 'Change parameters and pairing',
    idioma: 'Language',
    idiomaSub: 'English (US)',
    tema: 'Theme',
    temaSub: 'Dark Mode',
    temaSubClaro: 'Light Mode',
    
    // Home Screen (index.tsx)
    sistemaOnline: 'System Online',
    conectando: 'Connecting...',
    modoOffline: 'Offline Mode',
    motorOk: 'Engine OK',
    zeroErros: '0 Errors',
    painelTempoReal: 'Real-Time Dashboard',
    kmTotal: 'Total KM',
    kmHoje: 'KM Today',
    temperatura: 'Temperature',
    combustivel: 'Fuel',
    bateria: 'Battery',
    
    // Battery Status
    batCarregando: 'Charging (Alternator)',
    batIdeal: 'Ideal',
    batFraca: 'Warning (Weak)',
    batDesconhecido: 'Unknown',
    
    // Tools
    ferramentas: 'Tools',
    scanner: 'Fault Scanner',
    scannerSub: 'Active Real Module',
    relatorios: 'Reports & Oil',
    relatoriosSub: 'Next change: 2,400 km',
    reconectar: 'Reconnect',
    reconectarSub: 'Try again',
    
    // Alerts and Modals
    atencaoKm: 'Mileage Alert',
    ignorar: 'Ignore',
    atualizarSistema: 'Update System',
    emImplementacao: 'IN PROGRESS',

    // Scanner
    tituloScanner: 'OBD-II Scanner',
    saudeVeiculo: 'Vehicle Health',
    emPerfeitoEstado: 'In perfect condition',
    atencaoNecessaria: 'Attention required',
    analisandoEcu: 'Analyzing ECU...',
    errosEncontrados: 'error(s) found',
    codigosFalha: 'Fault Codes',
    nenhumaFalha: 'No faults detected!',
    nenhumaFalhaDesc: 'The electronic injection did not report any active or pending error codes.',
    apagando: 'Clearing...',
    apagarMemoria: 'Clear Fault Memory',
    agendarRevisao: 'Schedule Service',
    escaneandoEcu: 'Scanning ECU...',
    novoEscaneamento: 'New Scan',
    critico: 'Critical',
    aviso: 'Warning',
    resolvido: 'Resolved',

    // Relatórios
    tituloRelatorios: 'Reports & Oil',
    proximaTrocaOleo: 'Next Oil Change',
    faltamKm: 'Remaining',
    doIntervalo: 'of interval',
    consumoMensal: 'Monthly Fuel',
    litrosAbastecidos: 'Liters refueled per month (2025)',
    historicoOleo: 'Oil History',
    prox: 'Next',
    historicoManutencao: 'Maintenance History',

    // Gráfico Home
    consumoSemanal: 'Weekly Consumption',
    litrosPorDia: 'Liters per day',
    seg: 'Mon',
    ter: 'Tue',
    qua: 'Wed',
    qui: 'Thu',
    sex: 'Fri',
    sab: 'Sat',
    dom: 'Sun',
  }
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<Language>('pt');

  useEffect(() => {
    async function carregarPreferencias() {
      const savedTheme = await AsyncStorage.getItem('@app_theme');
      const savedLang = await AsyncStorage.getItem('@app_lang');
      if (savedTheme) setTheme(savedTheme as Theme);
      if (savedLang) setLanguage(savedLang as Language);
    }
    carregarPreferencias();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('@app_theme', newTheme);
  };

  const toggleLanguage = async () => {
    const newLang = language === 'pt' ? 'en' : 'pt';
    setLanguage(newLang);
    await AsyncStorage.setItem('@app_lang', newLang);
  };

  const t = (key: string) => {
    return dicionario[language][key as keyof typeof dicionario['pt']] || key;
  };

  return (
    <AppContext.Provider value={{ theme, language, toggleTheme, toggleLanguage, t }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);