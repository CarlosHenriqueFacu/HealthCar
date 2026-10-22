import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

/** Tipagem estrita para os temas suportados pelo sistema */
type Theme = 'dark' | 'light';

/** Tipagem estrita para os idiomas suportados pela aplicação */
type Language = 'pt' | 'en';

/**
 * @interface AppContextData
 * @description Contrato de dados providos pelo contexto global da aplicação.
 * Encapsula o estado do tema, idioma e os métodos modificadores persistentes.
 */
interface AppContextData {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  /** Função utilitária de internacionalização (i18n) */
  t: (key: string) => string;
}

const AppContext = createContext<AppContextData>({} as AppContextData);

/**
 * @constant dicionario
 * @description Matriz estática de localização. Mapeia chaves identificadoras
 * para strings traduzidas, suportando os escopos de todas as telas da aplicação.
 */
const dicionario = {
  pt: {
    // --- Escopo: Tela de Configurações ---
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
    
    // --- Escopo: Tela Inicial (Dashboard Central) ---
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
    
    // --- Escopo: Métricas de Bateria ---
    batCarregando: 'A Carregar (Alternador)',
    batIdeal: 'Ideal',
    batFraca: 'Atenção (Fraca)',
    batDesconhecido: 'Desconhecido',
    
    // --- Escopo: Menu de Ferramentas ---
    ferramentas: 'Ferramentas',
    scanner: 'Scanner de Falhas',
    scannerSub: 'Módulo Real Ativo',
    relatorios: 'Relatórios e Óleo',
    relatoriosSub: 'Próx. troca: 2.400 km',
    reconectar: 'Reconectar',
    reconectarSub: 'Tentar novamente',
    
    // --- Escopo: Alertas do Sistema ---
    atencaoKm: 'Atenção à Quilometragem',
    ignorar: 'Ignorar',
    atualizarSistema: 'Atualizar Sistema',
    emImplementacao: 'EM IMPLEMENTAÇÃO',
    
    // --- Escopo: Diagnóstico OBD-II (Scanner) ---
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

    // --- Escopo: Relatórios e Manutenção Preventiva ---
    tituloRelatorios: 'Relatórios e Óleo',
    proximaTrocaOleo: 'Próxima Troca de Óleo',
    faltamKm: 'Faltam',
    doIntervalo: 'do intervalo',
    consumoMensal: 'Consumo Mensal',
    litrosAbastecidos: 'Litros abastecidos por mês (2025)',
    historicoOleo: 'Histórico de Óleo',
    prox: 'Próx.',
    historicoManutencao: 'Histórico de Manutenção',

    // --- Escopo: Gráficos da Home e Detalhes de Consumo ---
    consumoSemanal: 'Consumo Semanal',
    litrosPorDia: 'Litros por dia',
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
    dom: 'Dom',

    // --- Escopo: Detalhes Técnicos - Temperatura ---
    temperaturaMotor: 'Temperatura do Motor',
    temperaturaAtual: 'Temperatura Atual',
    normal: 'Normal',
    minima: 'Mínima',
    media: 'Média',
    maxima: 'Máxima',
    oscilacaoTermica: 'Oscilação Térmica (24h)',
    dadosHorarios: 'Dados Horários',

    // --- Escopo: Detalhes Técnicos - RPM ---
    rpmAtual: 'RPM Atual',
    doMaximo: 'do máximo',
    pico: 'Pico',
    picosPorPeriodo: 'Picos por Período (24h)',
    detalhesPorPeriodo: 'Detalhes por Período',

    // --- Escopo: Detalhes Técnicos - Combustível ---
    nivelAtual: 'Nível Atual',
    deAutonomia: 'de autonomia',
    totalSemana: 'Total Semana',
    mediaDiaria: 'Média Diária',
    historicoAbastecimentos: 'Histórico de Abastecimentos',
    abastecimentoCompleto: 'Abastecimento completo',
    nenhumAbastecimento: 'Nenhum abastecimento registrado',
    consumoDiario: 'Consumo Diário',

    // --- Escopo: Detalhes Técnicos - Bateria ---
    carga: 'Carga',
    saude: 'Saúde',
    historicoCarga: 'Histórico de Carga',

    // --- Escopo: Eficiência Energética ---
    total: 'Total',
    eficiencia: 'Eficiência',
    consumoVsEficiencia: 'Consumo vs Eficiência',
    consumoL: 'Consumo (L)',
    eficienciaKml: 'Eficiência (km/l)',
    detalhesDiarios: 'Detalhes Diários',
    consumo: 'Consumo',
    melhorDia: 'Melhor Dia',
    piorDia: 'Pior Dia',
  },
  
  en: {
    // --- Escopo: Tela de Configurações ---
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
    
    // --- Escopo: Tela Inicial (Dashboard Central) ---
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
    
    // --- Escopo: Métricas de Bateria ---
    batCarregando: 'Charging (Alternator)',
    batIdeal: 'Ideal',
    batFraca: 'Warning (Weak)',
    batDesconhecido: 'Unknown',
    
    // --- Escopo: Menu de Ferramentas ---
    ferramentas: 'Tools',
    scanner: 'Fault Scanner',
    scannerSub: 'Active Real Module',
    relatorios: 'Reports & Oil',
    relatoriosSub: 'Next change: 2,400 km',
    reconectar: 'Reconnect',
    reconectarSub: 'Try again',
    
    // --- Escopo: Alertas do Sistema ---
    atencaoKm: 'Mileage Alert',
    ignorar: 'Ignore',
    atualizarSistema: 'Update System',
    emImplementacao: 'IN PROGRESS',

    // --- Escopo: Diagnóstico OBD-II (Scanner) ---
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

    // --- Escopo: Relatórios e Manutenção Preventiva ---
    tituloRelatorios: 'Reports & Oil',
    proximaTrocaOleo: 'Next Oil Change',
    faltamKm: 'Remaining',
    doIntervalo: 'of interval',
    consumoMensal: 'Monthly Fuel',
    litrosAbastecidos: 'Liters refueled per month (2025)',
    historicoOleo: 'Oil History',
    prox: 'Next',
    historicoManutencao: 'Maintenance History',

    // --- Escopo: Gráficos da Home e Detalhes de Consumo ---
    consumoSemanal: 'Weekly Consumption',
    litrosPorDia: 'Liters per day',
    seg: 'Mon',
    ter: 'Tue',
    qua: 'Wed',
    qui: 'Thu',
    sex: 'Fri',
    sab: 'Sat',
    dom: 'Sun',

    // --- Escopo: Detalhes Técnicos - Temperatura ---
    temperaturaMotor: 'Engine Temperature',
    temperaturaAtual: 'Current Temperature',
    normal: 'Normal',
    minima: 'Minimum',
    media: 'Avg',
    maxima: 'Maximum',
    oscilacaoTermica: 'Thermal Oscillation (24h)',
    dadosHorarios: 'Hourly Data',

    // --- Escopo: Detalhes Técnicos - RPM ---
    rpmAtual: 'Current RPM',
    doMaximo: 'of max',
    pico: 'Peak',
    picosPorPeriodo: 'Peaks by Period (24h)',
    detalhesPorPeriodo: 'Details by Period',

    // --- Escopo: Detalhes Técnicos - Combustível ---
    nivelAtual: 'Current Level',
    deAutonomia: 'of range',
    totalSemana: 'Weekly Total',
    mediaDiaria: 'Daily Avg',
    historicoAbastecimentos: 'Refueling History',
    abastecimentoCompleto: 'Full tank refuel',
    nenhumAbastecimento: 'No refueling recorded',
    consumoDiario: 'Daily Consumption',

    // --- Escopo: Detalhes Técnicos - Bateria ---
    carga: 'Charge',
    saude: 'Health',
    historicoCarga: 'Charge History',

    // --- Escopo: Eficiência Energética ---
    total: 'Total',
    eficiencia: 'Efficiency',
    consumoVsEficiencia: 'Consumption vs Efficiency',
    consumoL: 'Consumption (L)',
    eficienciaKml: 'Efficiency (km/l)',
    detalhesDiarios: 'Daily Details',
    consumo: 'Consumption',
    melhorDia: 'Best Day',
    piorDia: 'Worst Day',
  }
};

/**
 * Provedor Global de Contexto (AppProvider)
 * @description Encapsula a árvore de componentes injetando dependências globais.
 * Gerencia a persistência (AsyncStorage) e alternância de Tema e Idioma.
 */
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<Language>('pt');

  // Inicialização assíncrona para resgatar configurações salvas localmente
  useEffect(() => {
    async function carregarPreferencias() {
      const savedTheme = await AsyncStorage.getItem('@app_theme');
      const savedLang = await AsyncStorage.getItem('@app_lang');
      if (savedTheme) setTheme(savedTheme as Theme);
      if (savedLang) setLanguage(savedLang as Language);
    }
    carregarPreferencias();
  }, []);

  /** Comuta o esquema de cores e persiste a escolha no hardware */
  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('@app_theme', newTheme);
  };

  /** Altera o locale ativo e persiste a escolha no hardware */
  const toggleLanguage = async () => {
    const newLang = language === 'pt' ? 'en' : 'pt';
    setLanguage(newLang);
    await AsyncStorage.setItem('@app_lang', newLang);
  };

  /**
   * Resolução da chave de tradução (i18n).
   * @param {string} key Chave de busca no dicionário.
   * @returns {string} Retorna o valor traduzido ou a própria chave como fallback seguro.
   */
  const t = (key: string) => {
    return dicionario[language][key as keyof typeof dicionario['pt']] || key;
  };

  return (
    <AppContext.Provider value={{ theme, language, toggleTheme, toggleLanguage, t }}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Hook utilitário (useApp)
 * @description Facilita o consumo do contexto em qualquer nó da árvore React.
 */
export const useApp = () => useContext(AppContext);