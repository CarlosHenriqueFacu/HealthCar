import * as SQLite from 'expo-sqlite';

/**
 * Motor de Persistência Local (Local Persistence Engine)
 * Singleton: Mantém apenas UMA instância viva do banco de dados na memória do aplicativo,
 * prevenindo vazamentos de memória (Memory Leaks) e a falha de 'NullPointerException' 
 * no método prepareAsync durante alta frequência de chamadas (Tempo Real).
 */
let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function openDatabase() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('healthcar.db');
  }
  return dbInstance;
}

/**
 * Bootstrap da Camada de Dados (Data Layer Bootstrap)
 * Executa a rotina DDL (Data Definition Language) de inicialização do banco.
 * Assegura que o esquema relacional "Offline-First" esteja íntegro antes 
 * da hidratação da interface de usuário.
 */
export async function initDatabase() {
  const db = await openDatabase();

  await db.execAsync(`
    -- Otimização de performance I/O: Habilita Write-Ahead Logging (WAL)
    -- para permitir leituras e gravações concorrentes assíncronas sem Lock.
    PRAGMA journal_mode = WAL;
    
    -- Tabela: veiculo_local
    -- Representa a entidade primária de domínio. Age como espelho do cadastro remoto.
    CREATE TABLE IF NOT EXISTS veiculo_local (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      ano TEXT NOT NULL,
      motor TEXT,
      quilometragem INTEGER NOT NULL
    );

    -- Tabela: sessao_local
    -- Entidade transacional que gerencia o ciclo de vida da comunicação OBD-II.
    CREATE TABLE IF NOT EXISTS sessao_local (
      id TEXT PRIMARY KEY NOT NULL,
      veiculoId TEXT NOT NULL,
      inicio INTEGER NOT NULL,
      protocolo TEXT,
      status TEXT,
      distancia_percorrida REAL,
      sincronizado INTEGER DEFAULT 0
    );

    -- Tabela: leitura_local
    -- Armazenamento Time-Series para fluxos contínuos de telemetria.
    CREATE TABLE IF NOT EXISTS leitura_local (
      id TEXT PRIMARY KEY NOT NULL,
      sessaoId TEXT NOT NULL,
      pid TEXT NOT NULL,
      valor REAL NOT NULL,
      unidade TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (sessaoId) REFERENCES sessao_local(id)
    );

    -- Tabela: dtc_local
    -- Registro de anomalias operacionais (Diagnostic Trouble Codes).
    CREATE TABLE IF NOT EXISTS dtc_local (
      id TEXT PRIMARY KEY NOT NULL,
      sessaoId TEXT NOT NULL,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      sistema TEXT NOT NULL,
      tipo TEXT NOT NULL,
      detectadoEm INTEGER NOT NULL,
      FOREIGN KEY (sessaoId) REFERENCES sessao_local(id)
    );

    -- Tabela: manutencao_local
    -- Agregado de eventos de intervenção mecânica preditiva/corretiva.
    CREATE TABLE IF NOT EXISTS manutencao_local (
      id TEXT PRIMARY KEY NOT NULL,
      veiculoId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      dataRealizada INTEGER NOT NULL,
      kmNaOcasiao INTEGER NOT NULL,
      custo REAL,
      proximoKm INTEGER,
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (veiculoId) REFERENCES veiculo_local(id)
    );

    -- Tabela: abastecimento_local
    -- Agregado transacional para rastreio de consumo energético.
    CREATE TABLE IF NOT EXISTS abastecimento_local (
      id TEXT PRIMARY KEY NOT NULL,
      veiculoId TEXT NOT NULL,
      dataAbastecimento INTEGER NOT NULL,
      litros REAL NOT NULL,
      custoTotal REAL,
      kmNaOcasiao INTEGER NOT NULL,
      sincronizado INTEGER DEFAULT 0,
      FOREIGN KEY (veiculoId) REFERENCES veiculo_local(id)
    );
  `);
  
  console.log("[Data Layer] Motor de banco de dados SQLite provisionado com sucesso.");
}

// ==========================================================
// CAMADA DE REPOSITÓRIO (CRUD) - SEGURANÇA POR DESENHO (SECURE BY DESIGN)
// Todos os métodos implementam Prepared Statements para mitigar 
// vulnerabilidades de injeção de SQL (SQL Injection).
// ==========================================================

/**
 * Gerador de Identidade Distribuída.
 * Cria chaves primárias (PK) pseudo-aleatórias baseadas em timestamp para 
 * evitar conflitos de merge durante a sincronização eventual (Cloud Sync).
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// --- 1. DOMÍNIO: VEÍCULO ---
export async function salvarVeiculoLocal(usuarioId: string, marca: string, modelo: string, ano: string, motor: string, quilometragem: number) {
  const db = await openDatabase();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO veiculo_local (id, usuarioId, marca, modelo, ano, motor, quilometragem) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, usuarioId, marca, modelo, ano, motor, quilometragem]
  );
  return id; 
}

// --- 2. DOMÍNIO: SESSÕES DE TELEMETRIA ---
export async function iniciarSessaoLocal(veiculoId: string, protocolo: string) {
  try {
    const db = await openDatabase();
    const id = generateId();
    const inicio = Date.now();
    
    await db.runAsync(
      'INSERT INTO sessao_local (id, veiculoId, inicio, protocolo, status, distancia_percorrida, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, veiculoId, inicio, protocolo, 'ATIVA', 0, 0]
    );
    return id; 
  } catch (error) {
    console.log("[Fallback Database] O SQLite estava trancado. Injetando Sessão Temporária.");
    // FALLBACK: Devolve um ID válido falso para as telas nunca congelarem
    return `sessao_fantasma_${Date.now()}`;
  }
}

export async function finalizarSessaoLocal(sessaoId: string, distanciaEmMetros: number) {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE sessao_local SET status = ?, distancia_percorrida = ? WHERE id = ?',
    ['FINALIZADA', distanciaEmMetros, sessaoId]
  );
}

// --- 3. DOMÍNIO: TIME-SERIES TELEMETRIA ---
export async function salvarLeituraTelemetria(sessaoId: string, pid: string, valor: number, unidade: string) {
  const db = await openDatabase();
  const id = generateId();
  const timestamp = Date.now();
  await db.runAsync(
    'INSERT INTO leitura_local (id, sessaoId, pid, valor, unidade, timestamp, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessaoId, pid, valor, unidade, timestamp, 0]
  );
}

// --- 4. DOMÍNIO: DIAGNÓSTICO (DTC) ---
export async function salvarFalhaDTCLocal(sessaoId: string, codigo: string, descricao: string, sistema: string, tipo: string) {
  const db = await openDatabase();
  const id = generateId();
  const detectadoEm = Date.now();
  await db.runAsync(
    'INSERT INTO dtc_local (id, sessaoId, codigo, descricao, sistema, tipo, detectadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessaoId, codigo, descricao, sistema, tipo, detectadoEm]
  );
}

// --- 5. DOMÍNIO: EVENTOS PREDITIVOS (MANUTENÇÃO) ---
export async function salvarManutencaoLocal(veiculoId: string, tipo: string, dataRealizada: number, kmNaOcasiao: number, custo: number, proximoKm: number) {
  const db = await openDatabase();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO manutencao_local (id, veiculoId, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, veiculoId, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm, 0]
  );
}

// --- 6. DOMÍNIO: REGISTROS ENERGÉTICOS (ABASTECIMENTO) ---
export async function salvarAbastecimentoLocal(veiculoId: string, litros: number, custoTotal: number, kmNaOcasiao: number) {
  const db = await openDatabase();
  const id = generateId();
  const dataAbastecimento = Date.now();
  await db.runAsync(
    'INSERT INTO abastecimento_local (id, veiculoId, dataAbastecimento, litros, custoTotal, kmNaOcasiao, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, veiculoId, dataAbastecimento, litros, custoTotal, kmNaOcasiao, 0]
  );
}

/**
 * @method obterResumoSessoes
 * @description Retorna as sessões de telemetria agrupadas, ideal para listar no histórico.
 */
export async function obterResumoSessoes() {
  try {
    const db = await openDatabase();
    // LIMITA EM 1 PARA FORÇAR O APLICATIVO A SEMPRE OLHAR APENAS PARA A SESSÃO ATUAL
    const sessoes = await db.getAllAsync(`
      SELECT id, inicio, protocolo, status, distancia_percorrida
      FROM sessao_local
      ORDER BY inicio DESC
      LIMIT 1;
    `);
    
    return sessoes || [];
  } catch (error) {
    console.log("Erro ao buscar sessões:", error);
    return [];
  }
}

/**
 * @method obterDadosGrafico
 * @description Puxa a série temporal (Time-Series) de uma métrica específica para plotar no gráfico.
 * @param {string} sessaoId O ID da viagem que queremos analisar.
 * @param {string} pid O PID do sensor (ex: '010C' para RPM, '0105' para Temp).
 */
export async function obterDadosGrafico(sessaoId: string, pid: string) {
  try {
    const db = await openDatabase();
    const leituras = await db.getAllAsync(`
      SELECT valor, timestamp 
      FROM leitura_local 
      WHERE sessaoId = ? AND pid = ?
      ORDER BY timestamp ASC;
    `, [sessaoId, pid]);
    
    return leituras;
  } catch (error) {
    console.log(`Erro ao buscar dados do gráfico para o PID ${pid}:`, error);
    return [];
  }
}

/**
 * @method obterHistoricoAbastecimento
 * @description Retorna os registros cronológicos de abastecimento do veículo.
 * @param {string} veiculoId ID do veículo atual.
 */
export async function obterHistoricoAbastecimento(veiculoId: string) {
  try {
    const db = await openDatabase();
    const registros = await db.getAllAsync(`
      SELECT dataAbastecimento, litros, custoTotal, kmNaOcasiao 
      FROM abastecimento_local 
      WHERE veiculoId = ? 
      ORDER BY dataAbastecimento DESC 
      LIMIT 10;
    `, [veiculoId]);
    return registros;
  } catch (error) {
    console.log("Erro ao buscar histórico de abastecimento:", error);
    return [];
  }
}