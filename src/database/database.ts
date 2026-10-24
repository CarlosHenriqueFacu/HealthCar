import * as SQLite from 'expo-sqlite';

import { notifyLocalDataChanged } from '../services/syncSignals';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface VehicleInput {
  marca: string;
  veiculo: string;
  motor: string;
  ano: string;
  km: string;
  combustivel: string;
  odometroOffset?: number;
  ultimoObdKm?: number;
  odometroCalibrado?: boolean | number;
}

export interface VehicleRecord extends VehicleInput {
  id: string;
  ownerUid: string;
  updatedAt: number;
  odometroOffset: number;
  ultimoObdKm: number;
  odometroCalibrado: boolean;
}

export interface ProfileInput {
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  vehicleId?: string;
}

export interface ProfileRecord extends ProfileInput {
  ownerUid: string;
  updatedAt: number;
}

export type SyncEntity = 'profile' | 'vehicle' | 'trip' | 'fault' | 'maintenance' | 'refuel';

export interface SyncQueueItem {
  outboxId: string;
  ownerUid: string;
  entity: SyncEntity;
  entityId: string;
  operation: 'upsert' | 'delete';
  parentId?: string;
  data: Record<string, unknown>;
}

export interface TelemetryPoint {
  id: string;
  ownerUid: string;
  sessaoId: string;
  veiculoId: string;
  pid: string;
  valor: number;
  unidade: string;
  timestamp: number;
}

export interface LocalSyncStatus {
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

const TABLE_COLUMNS: Record<string, Array<[string, string]>> = {
  veiculo_local: [
    ['ownerUid', 'TEXT'],
    ['combustivel', 'TEXT'],
    ['odometroOffset', 'REAL NOT NULL DEFAULT 0'],
    ['ultimoObdKm', 'INTEGER NOT NULL DEFAULT 0'],
    ['odometroCalibrado', 'INTEGER NOT NULL DEFAULT 0'],
    ['updatedAt', 'INTEGER NOT NULL DEFAULT 0'],
    ['deletedAt', 'INTEGER'],
    ['sincronizado', 'INTEGER NOT NULL DEFAULT 0'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  sessao_local: [
    ['ownerUid', 'TEXT'],
    ['updatedAt', 'INTEGER NOT NULL DEFAULT 0'],
    ['deletedAt', 'INTEGER'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  leitura_local: [
    ['ownerUid', 'TEXT'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  dtc_local: [
    ['ownerUid', 'TEXT'],
    ['updatedAt', 'INTEGER NOT NULL DEFAULT 0'],
    ['deletedAt', 'INTEGER'],
    ['sincronizado', 'INTEGER NOT NULL DEFAULT 0'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  manutencao_local: [
    ['ownerUid', 'TEXT'],
    ['updatedAt', 'INTEGER NOT NULL DEFAULT 0'],
    ['deletedAt', 'INTEGER'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  abastecimento_local: [
    ['ownerUid', 'TEXT'],
    ['updatedAt', 'INTEGER NOT NULL DEFAULT 0'],
    ['deletedAt', 'INTEGER'],
    ['syncStatus', 'INTEGER NOT NULL DEFAULT 0'],
  ],
};

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function requireUid(ownerUid: string) {
  if (!ownerUid?.trim()) {
    throw new Error('É necessário estar conectado a uma conta para salvar dados.');
  }
}

export async function openDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('healthcar.db');
  }
  return dbPromise;
}

async function hasColumn(db: SQLite.SQLiteDatabase, table: string, column: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((item) => item.name === column);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  if (!(await hasColumn(db, table, column))) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function initDatabase() {
  const db = await openDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS veiculo_local (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      ownerUid TEXT,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      ano TEXT NOT NULL,
      motor TEXT,
      combustivel TEXT,
      quilometragem INTEGER NOT NULL,
      odometroOffset REAL NOT NULL DEFAULT 0,
      ultimoObdKm INTEGER NOT NULL DEFAULT 0,
      odometroCalibrado INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      syncStatus INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessao_local (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT,
      veiculoId TEXT NOT NULL,
      inicio INTEGER NOT NULL,
      protocolo TEXT,
      status TEXT,
      distancia_percorrida REAL DEFAULT 0,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      syncStatus INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leitura_local (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT,
      sessaoId TEXT NOT NULL,
      pid TEXT NOT NULL,
      valor REAL NOT NULL,
      unidade TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      syncStatus INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dtc_local (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT,
      sessaoId TEXT NOT NULL,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      sistema TEXT NOT NULL,
      tipo TEXT NOT NULL,
      detectadoEm INTEGER NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      syncStatus INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sessaoId) REFERENCES sessao_local(id)
    );

    CREATE TABLE IF NOT EXISTS manutencao_local (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT,
      veiculoId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      dataRealizada INTEGER NOT NULL,
      kmNaOcasiao INTEGER NOT NULL,
      custo REAL,
      proximoKm INTEGER,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      syncStatus INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (veiculoId) REFERENCES veiculo_local(id)
    );

    CREATE TABLE IF NOT EXISTS abastecimento_local (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT,
      veiculoId TEXT NOT NULL,
      dataAbastecimento INTEGER NOT NULL,
      litros REAL NOT NULL,
      custoTotal REAL,
      kmNaOcasiao INTEGER NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      syncStatus INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (veiculoId) REFERENCES veiculo_local(id)
    );

    CREATE TABLE IF NOT EXISTS perfil_local (
      ownerUid TEXT PRIMARY KEY NOT NULL,
      displayName TEXT NOT NULL DEFAULT '',
      firstName TEXT,
      lastName TEXT,
      email TEXT NOT NULL DEFAULT '',
      vehicleId TEXT,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      syncStatus INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      ownerUid TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT 'upsert',
      createdAt INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      UNIQUE(ownerUid, entity, entityId)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      ownerUid TEXT PRIMARY KEY NOT NULL,
      lastPullAt INTEGER,
      lastSyncedAt INTEGER,
      lastError TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_cursors (
      ownerUid TEXT NOT NULL,
      collectionKey TEXT NOT NULL,
      lastPullAt INTEGER NOT NULL,
      PRIMARY KEY (ownerUid, collectionKey)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
    for (const [column, definition] of columns) {
      await ensureColumn(db, table, column, definition);
    }
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_owner ON veiculo_local(ownerUid, id);
    CREATE INDEX IF NOT EXISTS idx_trip_owner_vehicle ON sessao_local(ownerUid, veiculoId, inicio DESC);
    CREATE INDEX IF NOT EXISTS idx_reading_owner_trip_time ON leitura_local(ownerUid, sessaoId, timestamp);
    CREATE INDEX IF NOT EXISTS idx_fault_owner_trip_time ON dtc_local(ownerUid, sessaoId, detectadoEm DESC);
    CREATE INDEX IF NOT EXISTS idx_maintenance_owner_vehicle ON manutencao_local(ownerUid, veiculoId, dataRealizada DESC);
    CREATE INDEX IF NOT EXISTS idx_refuel_owner_vehicle ON abastecimento_local(ownerUid, veiculoId, dataAbastecimento DESC);
    CREATE INDEX IF NOT EXISTS idx_outbox_owner_created ON sync_outbox(ownerUid, createdAt);
    PRAGMA user_version = 3;
  `);
}

async function enqueue(
  db: SQLite.SQLiteDatabase,
  ownerUid: string,
  entity: SyncEntity,
  entityId: string,
  operation: 'upsert' | 'delete' = 'upsert',
) {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sync_outbox (id, ownerUid, entity, entityId, operation, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ownerUid, entity, entityId) DO UPDATE SET
       id = excluded.id,
       operation = excluded.operation,
       createdAt = excluded.createdAt,
       lastError = NULL`,
    [generateId(), ownerUid, entity, entityId, operation, now],
  );
}

function normalizeVehicle(input: VehicleInput) {
  return {
    marca: input.marca?.trim() ?? '',
    veiculo: input.veiculo?.trim() ?? '',
    motor: input.motor?.trim() ?? '',
    ano: input.ano?.trim() ?? '',
    km: input.km?.trim() ?? '0',
    combustivel: input.combustivel?.trim() ?? '',
    odometroOffset: Number(input.odometroOffset ?? 0),
    ultimoObdKm: Number(input.ultimoObdKm ?? 0),
    odometroCalibrado: input.odometroCalibrado ? 1 : 0,
  };
}

async function writeVehicle(
  db: SQLite.SQLiteDatabase,
  ownerUid: string,
  input: VehicleInput,
  id: string,
  enqueueChange: boolean,
  updatedAt = Date.now(),
) {
  const vehicle = normalizeVehicle(input);
  await db.runAsync(
    `INSERT INTO veiculo_local
      (id, usuarioId, ownerUid, marca, modelo, ano, motor, combustivel, quilometragem,
       odometroOffset, ultimoObdKm, odometroCalibrado,
       updatedAt, deletedAt, sincronizado, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       usuarioId = excluded.usuarioId,
       ownerUid = excluded.ownerUid,
       marca = excluded.marca,
       modelo = excluded.modelo,
       ano = excluded.ano,
       motor = excluded.motor,
       combustivel = excluded.combustivel,
       quilometragem = excluded.quilometragem,
       odometroOffset = excluded.odometroOffset,
       ultimoObdKm = excluded.ultimoObdKm,
       odometroCalibrado = excluded.odometroCalibrado,
       updatedAt = excluded.updatedAt,
       deletedAt = NULL,
       sincronizado = excluded.sincronizado,
       syncStatus = excluded.syncStatus`,
    [id, ownerUid, ownerUid, vehicle.marca, vehicle.veiculo, vehicle.ano, vehicle.motor,
      vehicle.combustivel, Number(vehicle.km) || 0, vehicle.odometroOffset, vehicle.ultimoObdKm,
      vehicle.odometroCalibrado, updatedAt, enqueueChange ? 0 : 1, enqueueChange ? 0 : 1],
  );
  if (enqueueChange) await enqueue(db, ownerUid, 'vehicle', id);
}

export async function salvarVeiculoLocal(
  ownerUid: string,
  input: VehicleInput,
  preferredId?: string,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  let vehicleId = preferredId;
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (!vehicleId) {
      const existing = await tx.getFirstAsync<{ id: string }>(
        'SELECT id FROM veiculo_local WHERE ownerUid = ? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1',
        [ownerUid],
      );
      vehicleId = existing?.id ?? generateId();
    }
    const targetVehicleId = vehicleId ?? generateId();
    vehicleId = targetVehicleId;
    const currentVehicle = await tx.getFirstAsync<{
      odometroOffset: number;
      ultimoObdKm: number;
      odometroCalibrado: number;
    }>(
      'SELECT odometroOffset, ultimoObdKm, odometroCalibrado FROM veiculo_local WHERE ownerUid = ? AND id = ?',
      [ownerUid, targetVehicleId],
    );
    await writeVehicle(tx, ownerUid, {
      ...input,
      odometroOffset: input.odometroOffset ?? currentVehicle?.odometroOffset ?? 0,
      ultimoObdKm: input.ultimoObdKm ?? currentVehicle?.ultimoObdKm ?? 0,
      odometroCalibrado: input.odometroCalibrado ?? currentVehicle?.odometroCalibrado ?? 0,
    }, targetVehicleId, true);
    const profile = await tx.getFirstAsync<ProfileRecord>(
      'SELECT * FROM perfil_local WHERE ownerUid = ?', [ownerUid],
    );
    if (profile) {
      await tx.runAsync(
        'UPDATE perfil_local SET vehicleId = ?, updatedAt = ?, syncStatus = 0 WHERE ownerUid = ?',
        [targetVehicleId, Date.now(), ownerUid],
      );
      await enqueue(tx, ownerUid, 'profile', ownerUid);
    }
  });
  if (!vehicleId) throw new Error('Não foi possível gerar o identificador do veículo.');
  notifyLocalDataChanged(ownerUid);
  return vehicleId;
}

export async function obterVeiculoLocal(ownerUid: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT id, ownerUid, marca, modelo, ano, motor, combustivel, quilometragem, updatedAt,
            odometroOffset, ultimoObdKm, odometroCalibrado
     FROM veiculo_local WHERE ownerUid = ? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1`,
    [ownerUid],
  );
  if (!row) return null;
  return {
    ...row,
    veiculo: row.modelo,
    km: String(row.quilometragem ?? 0),
    odometroCalibrado: Boolean(row.odometroCalibrado),
  } as VehicleRecord;
}

export async function atualizarOdometroVeiculoLocal(
  ownerUid: string,
  vehicleId: string,
  odometroOffset: number,
  ultimoObdKm: number,
  odometroCalibrado: boolean,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `UPDATE veiculo_local SET odometroOffset = ?, ultimoObdKm = ?, odometroCalibrado = ?,
       updatedAt = ?, sincronizado = 0, syncStatus = 0 WHERE ownerUid = ? AND id = ?`,
      [odometroOffset, ultimoObdKm, odometroCalibrado ? 1 : 0, Date.now(), ownerUid, vehicleId],
    );
    await enqueue(tx, ownerUid, 'vehicle', vehicleId);
  });
  notifyLocalDataChanged(ownerUid);
}

export async function atualizarQuilometragemVeiculoLocal(
  ownerUid: string,
  vehicleId: string,
  quilometragem: number,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'UPDATE veiculo_local SET quilometragem = ?, updatedAt = ?, syncStatus = 0, sincronizado = 0 WHERE ownerUid = ? AND id = ?',
      [quilometragem, Date.now(), ownerUid, vehicleId],
    );
    await enqueue(tx, ownerUid, 'vehicle', vehicleId);
  });
  notifyLocalDataChanged(ownerUid);
}

export async function salvarPerfilLocal(ownerUid: string, input: ProfileInput) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO perfil_local (ownerUid, displayName, firstName, lastName, email, vehicleId, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(ownerUid) DO UPDATE SET
         displayName = CASE WHEN excluded.displayName = '' THEN perfil_local.displayName ELSE excluded.displayName END,
         firstName = COALESCE(excluded.firstName, perfil_local.firstName),
         lastName = COALESCE(excluded.lastName, perfil_local.lastName),
         email = CASE WHEN excluded.email = '' THEN perfil_local.email ELSE excluded.email END,
         vehicleId = COALESCE(excluded.vehicleId, perfil_local.vehicleId),
         updatedAt = excluded.updatedAt,
         syncStatus = 0`,
      [ownerUid, input.displayName, input.firstName ?? null, input.lastName ?? null,
        input.email, input.vehicleId ?? null, now],
    );
    await enqueue(tx, ownerUid, 'profile', ownerUid);
  });
  notifyLocalDataChanged(ownerUid);
}

export async function obterPerfilLocal(ownerUid: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getFirstAsync<ProfileRecord>(
    'SELECT * FROM perfil_local WHERE ownerUid = ?', [ownerUid],
  );
}

export async function migrarDadosLegados(
  ownerUid: string,
  legacyVehicle?: VehicleInput & { id?: string },
  profile?: ProfileInput,
  allowLegacyClaim = true,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  let vehicleId: string | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const claimed = await tx.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'legacy_data_owner_uid'",
    );
    const existingVehicle = await tx.getFirstAsync<{ id: string }>(
      'SELECT id FROM veiculo_local WHERE ownerUid = ? ORDER BY updatedAt DESC LIMIT 1', [ownerUid],
    );
    const mayClaimUnowned = claimed ? claimed.value === ownerUid : allowLegacyClaim;
    const unownedVehicle = mayClaimUnowned
      ? await tx.getFirstAsync<{ id: string }>(
          'SELECT id FROM veiculo_local WHERE ownerUid IS NULL OR ownerUid = "" ORDER BY updatedAt DESC LIMIT 1',
        )
      : null;

    vehicleId = existingVehicle?.id ?? legacyVehicle?.id ?? unownedVehicle?.id;

    if (!claimed && allowLegacyClaim && !existingVehicle && !unownedVehicle && legacyVehicle) {
      vehicleId = legacyVehicle.id ?? `vehicle_${ownerUid.slice(0, 18)}`;
    }

    if (mayClaimUnowned) {
      await tx.runAsync('UPDATE veiculo_local SET ownerUid = ?, usuarioId = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid, ownerUid]);
      await tx.runAsync('UPDATE sessao_local SET ownerUid = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid]);
      await tx.runAsync('UPDATE leitura_local SET ownerUid = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid]);
      await tx.runAsync('UPDATE dtc_local SET ownerUid = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid]);
      await tx.runAsync('UPDATE manutencao_local SET ownerUid = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid]);
      await tx.runAsync('UPDATE abastecimento_local SET ownerUid = ? WHERE ownerUid IS NULL OR ownerUid = ""', [ownerUid]);
      if (!claimed && allowLegacyClaim) {
        await tx.runAsync(
          "INSERT INTO app_meta (key, value) VALUES ('legacy_data_owner_uid', ?) ON CONFLICT(key) DO NOTHING",
          [ownerUid],
        );
      }
    }

    if (vehicleId && mayClaimUnowned) {
      if (legacyVehicle) await writeVehicle(tx, ownerUid, legacyVehicle, vehicleId, true);
      await tx.runAsync(
        `UPDATE sessao_local SET veiculoId = ?, updatedAt = ?
         WHERE ownerUid = ? AND veiculoId IN ('VEICULO_DESCONHECIDO', 'veiculo_tcc_padrao')`,
        [vehicleId, Date.now(), ownerUid],
      );
      const orphanFaults = await tx.getAllAsync<{ id: string }>(
        `SELECT d.id FROM dtc_local d
         LEFT JOIN sessao_local s ON s.id = d.sessaoId AND s.ownerUid = d.ownerUid
         WHERE d.ownerUid = ? AND s.id IS NULL`,
        [ownerUid],
      );
      const orphanReadings = await tx.getAllAsync<{ id: string }>(
        `SELECT l.id FROM leitura_local l
         LEFT JOIN sessao_local s ON s.id = l.sessaoId AND s.ownerUid = l.ownerUid
         WHERE l.ownerUid = ? AND s.id IS NULL`,
        [ownerUid],
      );
      if (orphanFaults.length || orphanReadings.length) {
        const legacySessionId = generateId();
        const now = Date.now();
        await tx.runAsync(
          `INSERT INTO sessao_local
           (id, ownerUid, veiculoId, inicio, protocolo, status, distancia_percorrida, updatedAt, syncStatus)
           VALUES (?, ?, ?, ?, 'LEGACY', 'FINALIZADA', 0, ?, 0)`,
          [legacySessionId, ownerUid, vehicleId, now, now],
        );
        await enqueue(tx, ownerUid, 'trip', legacySessionId);
        for (const fault of orphanFaults) {
          await tx.runAsync(
            `UPDATE dtc_local SET sessaoId = ?, updatedAt = ?, sincronizado = 0, syncStatus = 0
             WHERE ownerUid = ? AND id = ?`,
            [legacySessionId, now, ownerUid, fault.id],
          );
          await enqueue(tx, ownerUid, 'fault', fault.id);
        }
        for (const reading of orphanReadings) {
          await tx.runAsync(
            `UPDATE leitura_local SET sessaoId = ?, sincronizado = 0, syncStatus = 0
             WHERE ownerUid = ? AND id = ?`,
            [legacySessionId, ownerUid, reading.id],
          );
        }
      }
      await tx.runAsync(
        `UPDATE manutencao_local SET veiculoId = ?
         WHERE ownerUid = ? AND veiculoId IN ('VEICULO_DESCONHECIDO', 'veiculo_tcc_padrao')`,
        [vehicleId, ownerUid],
      );
      await tx.runAsync(
        `UPDATE abastecimento_local SET veiculoId = ?
         WHERE ownerUid = ? AND veiculoId IN ('VEICULO_DESCONHECIDO', 'veiculo_tcc_padrao')`,
        [vehicleId, ownerUid],
      );
    }

    if (profile) {
      await tx.runAsync(
        `INSERT INTO perfil_local (ownerUid, displayName, firstName, lastName, email, vehicleId, updatedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(ownerUid) DO UPDATE SET
           displayName = CASE WHEN perfil_local.displayName = '' THEN excluded.displayName ELSE perfil_local.displayName END,
           firstName = COALESCE(perfil_local.firstName, excluded.firstName),
           lastName = COALESCE(perfil_local.lastName, excluded.lastName),
           email = CASE WHEN perfil_local.email = '' THEN excluded.email ELSE perfil_local.email END,
           vehicleId = COALESCE(perfil_local.vehicleId, excluded.vehicleId)`,
        [ownerUid, profile.displayName, profile.firstName ?? null, profile.lastName ?? null,
          profile.email, vehicleId ?? profile.vehicleId ?? null, Date.now()],
      );
    }

    if (!claimed || claimed.value === ownerUid) {
      const vehicles = await tx.getAllAsync<{ id: string }>(
        'SELECT id FROM veiculo_local WHERE ownerUid = ? AND syncStatus = 0', [ownerUid],
      );
      for (const item of vehicles) await enqueue(tx, ownerUid, 'vehicle', item.id);
      const trips = await tx.getAllAsync<{ id: string }>(
        'SELECT id FROM sessao_local WHERE ownerUid = ? AND syncStatus = 0', [ownerUid],
      );
      for (const item of trips) await enqueue(tx, ownerUid, 'trip', item.id);
      const faults = await tx.getAllAsync<{ id: string }>(
        'SELECT id FROM dtc_local WHERE ownerUid = ? AND syncStatus = 0', [ownerUid],
      );
      for (const item of faults) await enqueue(tx, ownerUid, 'fault', item.id);
      const maintenance = await tx.getAllAsync<{ id: string }>(
        'SELECT id FROM manutencao_local WHERE ownerUid = ? AND syncStatus = 0', [ownerUid],
      );
      for (const item of maintenance) await enqueue(tx, ownerUid, 'maintenance', item.id);
      const refuels = await tx.getAllAsync<{ id: string }>(
        'SELECT id FROM abastecimento_local WHERE ownerUid = ? AND syncStatus = 0', [ownerUid],
      );
      for (const item of refuels) await enqueue(tx, ownerUid, 'refuel', item.id);
    }
  });
  if (legacyVehicle || profile) notifyLocalDataChanged(ownerUid);
  return obterVeiculoLocal(ownerUid);
}

export async function iniciarSessaoLocal(ownerUid: string, veiculoId: string, protocolo: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const id = generateId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO sessao_local
       (id, ownerUid, veiculoId, inicio, protocolo, status, distancia_percorrida, sincronizado, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, 'ATIVA', 0, 0, ?, 0)`,
      [id, ownerUid, veiculoId, now, protocolo, now],
    );
    await enqueue(tx, ownerUid, 'trip', id);
  });
  notifyLocalDataChanged(ownerUid);
  return id;
}

export async function finalizarSessaoLocal(
  ownerUid: string,
  sessaoId: string,
  distanciaEmMetros: number,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `UPDATE sessao_local SET status = 'FINALIZADA', distancia_percorrida = ?, updatedAt = ?,
       sincronizado = 0, syncStatus = 0 WHERE ownerUid = ? AND id = ?`,
      [distanciaEmMetros, Date.now(), ownerUid, sessaoId],
    );
    await enqueue(tx, ownerUid, 'trip', sessaoId);
  });
  notifyLocalDataChanged(ownerUid);
}

export async function atualizarDistanciaSessaoLocal(
  ownerUid: string,
  sessaoId: string,
  distanciaEmMetros: number,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ distancia_percorrida: number }>(
      'SELECT distancia_percorrida FROM sessao_local WHERE ownerUid = ? AND id = ?',
      [ownerUid, sessaoId],
    );
    if (!current) return;
    await tx.runAsync(
      `UPDATE sessao_local SET distancia_percorrida = ?, updatedAt = ?,
       sincronizado = 0, syncStatus = 0 WHERE ownerUid = ? AND id = ?`,
      [Math.max(0, distanciaEmMetros), Date.now(), ownerUid, sessaoId],
    );
    if (Math.abs((current.distancia_percorrida ?? 0) - distanciaEmMetros) >= 250) {
      await enqueue(tx, ownerUid, 'trip', sessaoId);
    }
  });
  notifyLocalDataChanged(ownerUid);
}

export async function salvarLeituraTelemetria(
  ownerUid: string,
  sessaoId: string,
  pid: string,
  valor: number,
  unidade: string,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO leitura_local (id, ownerUid, sessaoId, pid, valor, unidade, timestamp, sincronizado, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [id, ownerUid, sessaoId, pid, valor, unidade, Date.now()],
  );
  notifyLocalDataChanged(ownerUid);
  return id;
}

export async function salvarFalhaDTCLocal(
  ownerUid: string,
  sessaoId: string,
  codigo: string,
  descricao: string,
  sistema: string,
  tipo: string,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const id = generateId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO dtc_local
       (id, ownerUid, sessaoId, codigo, descricao, sistema, tipo, detectadoEm, sincronizado, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
      [id, ownerUid, sessaoId, codigo, descricao, sistema, tipo, now, now],
    );
    await enqueue(tx, ownerUid, 'fault', id);
  });
  notifyLocalDataChanged(ownerUid);
  return id;
}

export async function salvarManutencaoLocal(
  ownerUid: string,
  veiculoId: string,
  tipo: string,
  dataRealizada: number,
  kmNaOcasiao: number,
  custo: number,
  proximoKm: number | null,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const id = generateId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO manutencao_local
       (id, ownerUid, veiculoId, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm, sincronizado, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
      [id, ownerUid, veiculoId, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm, now],
    );
    await enqueue(tx, ownerUid, 'maintenance', id);
  });
  notifyLocalDataChanged(ownerUid);
  return id;
}

export async function salvarAbastecimentoLocal(
  ownerUid: string,
  veiculoId: string,
  litros: number,
  custoTotal: number,
  kmNaOcasiao: number,
  dataAbastecimento = Date.now(),
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const id = generateId();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO abastecimento_local
       (id, ownerUid, veiculoId, dataAbastecimento, litros, custoTotal, kmNaOcasiao, sincronizado, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
      [id, ownerUid, veiculoId, dataAbastecimento, litros, custoTotal, kmNaOcasiao, now],
    );
    await enqueue(tx, ownerUid, 'refuel', id);
  });
  notifyLocalDataChanged(ownerUid);
  return id;
}

export async function obterResumoSessoes(ownerUid: string, veiculoId?: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  if (veiculoId) {
    return db.getAllAsync<any>(
      `SELECT id, veiculoId, inicio, protocolo, status, distancia_percorrida
       FROM sessao_local WHERE ownerUid = ? AND veiculoId = ? AND deletedAt IS NULL
       ORDER BY inicio DESC LIMIT 100`,
      [ownerUid, veiculoId],
    );
  }
  return db.getAllAsync<any>(
    `SELECT id, veiculoId, inicio, protocolo, status, distancia_percorrida
     FROM sessao_local WHERE ownerUid = ? AND deletedAt IS NULL
     ORDER BY inicio DESC LIMIT 100`,
    [ownerUid],
  );
}

export async function obterDadosGrafico(ownerUid: string, sessaoId: string, pid: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<{ valor: number; timestamp: number }>(
    `SELECT valor, timestamp FROM leitura_local
     WHERE ownerUid = ? AND sessaoId = ? AND pid = ? ORDER BY timestamp ASC`,
    [ownerUid, sessaoId, pid],
  );
}

export async function obterHistoricoAbastecimento(ownerUid: string, veiculoId: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    `SELECT id, dataAbastecimento, litros, custoTotal, kmNaOcasiao
     FROM abastecimento_local WHERE ownerUid = ? AND veiculoId = ? AND deletedAt IS NULL
     ORDER BY dataAbastecimento DESC LIMIT 200`,
    [ownerUid, veiculoId],
  );
}

export async function obterHistoricoManutencao(ownerUid: string, veiculoId: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    `SELECT id, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm
     FROM manutencao_local WHERE ownerUid = ? AND veiculoId = ? AND deletedAt IS NULL
     ORDER BY dataRealizada DESC LIMIT 200`,
    [ownerUid, veiculoId],
  );
}

export async function obterFalhasSessao(ownerUid: string, sessaoId: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    `SELECT id, codigo, descricao, sistema, tipo, detectadoEm
     FROM dtc_local WHERE ownerUid = ? AND sessaoId = ? AND deletedAt IS NULL
     ORDER BY detectadoEm DESC`,
    [ownerUid, sessaoId],
  );
}

export async function obterTodasFalhas(ownerUid: string, veiculoId: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    `SELECT d.id, d.codigo, d.descricao, d.sistema, d.tipo, d.detectadoEm, s.veiculoId
     FROM dtc_local d JOIN sessao_local s ON s.id = d.sessaoId
     WHERE d.ownerUid = ? AND s.ownerUid = ? AND s.veiculoId = ? AND d.deletedAt IS NULL
     ORDER BY d.detectadoEm DESC LIMIT 200`,
    [ownerUid, ownerUid, veiculoId],
  );
}

export async function listarVeiculosLocais(ownerUid: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    'SELECT * FROM veiculo_local WHERE ownerUid = ? AND deletedAt IS NULL ORDER BY updatedAt DESC',
    [ownerUid],
  );
}

export async function listarViagensLocais(ownerUid: string, veiculoId: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<any>(
    'SELECT * FROM sessao_local WHERE ownerUid = ? AND veiculoId = ? AND deletedAt IS NULL ORDER BY inicio DESC',
    [ownerUid, veiculoId],
  );
}

export async function getPendingSyncItems(ownerUid: string, maxItems = 200) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const queue = await db.getAllAsync<any>(
    `SELECT id, entity, entityId, operation FROM sync_outbox
     WHERE ownerUid = ? ORDER BY createdAt ASC LIMIT ?`,
    [ownerUid, maxItems],
  );
  const items: SyncQueueItem[] = [];
  for (const queued of queue) {
    let data: any = null;
    let parentId: string | undefined;
    switch (queued.entity as SyncEntity) {
      case 'profile':
        data = await db.getFirstAsync<any>('SELECT * FROM perfil_local WHERE ownerUid = ?', [ownerUid]);
        break;
      case 'vehicle':
        data = await db.getFirstAsync<any>(
          'SELECT * FROM veiculo_local WHERE ownerUid = ? AND id = ?', [ownerUid, queued.entityId],
        );
        if (data) data = { ...data, veiculo: data.modelo, km: String(data.quilometragem) };
        break;
      case 'trip':
        data = await db.getFirstAsync<any>(
          'SELECT * FROM sessao_local WHERE ownerUid = ? AND id = ?', [ownerUid, queued.entityId],
        );
        if (data) parentId = data.veiculoId;
        break;
      case 'fault':
        data = await db.getFirstAsync<any>(
          `SELECT d.*, s.veiculoId FROM dtc_local d
           JOIN sessao_local s ON s.id = d.sessaoId AND s.ownerUid = d.ownerUid
           WHERE d.ownerUid = ? AND d.id = ?`, [ownerUid, queued.entityId],
        );
        if (data) parentId = data.sessaoId;
        break;
      case 'maintenance':
        data = await db.getFirstAsync<any>(
          'SELECT * FROM manutencao_local WHERE ownerUid = ? AND id = ?', [ownerUid, queued.entityId],
        );
        if (data) parentId = data.veiculoId;
        break;
      case 'refuel':
        data = await db.getFirstAsync<any>(
          'SELECT * FROM abastecimento_local WHERE ownerUid = ? AND id = ?', [ownerUid, queued.entityId],
        );
        if (data) parentId = data.veiculoId;
        break;
    }
    if (!data && queued.operation !== 'delete') {
      await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [queued.id]);
      continue;
    }
    items.push({
      outboxId: queued.id,
      ownerUid,
      entity: queued.entity,
      entityId: queued.entityId,
      operation: queued.operation,
      parentId,
      data: data ?? {},
    });
  }
  return items;
}

export async function marcarItensSincronizados(ownerUid: string, outboxIds: string[]) {
  requireUid(ownerUid);
  if (!outboxIds.length) return;
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const outboxId of outboxIds) {
      const item = await tx.getFirstAsync<{ entity: SyncEntity; entityId: string }>(
        'SELECT entity, entityId FROM sync_outbox WHERE ownerUid = ? AND id = ?', [ownerUid, outboxId],
      );
      if (!item) continue;
      const table = tableForEntity(item.entity);
      if (table) {
        await tx.runAsync(
          `UPDATE ${table} SET syncStatus = 1, sincronizado = 1 WHERE ownerUid = ? AND id = ?`,
          [ownerUid, item.entityId],
        );
      } else if (item.entity === 'profile') {
        await tx.runAsync('UPDATE perfil_local SET syncStatus = 1 WHERE ownerUid = ?', [ownerUid]);
      }
      await tx.runAsync('DELETE FROM sync_outbox WHERE id = ?', [outboxId]);
    }
  });
}

function tableForEntity(entity: SyncEntity) {
  switch (entity) {
    case 'vehicle': return 'veiculo_local';
    case 'trip': return 'sessao_local';
    case 'fault': return 'dtc_local';
    case 'maintenance': return 'manutencao_local';
    case 'refuel': return 'abastecimento_local';
    default: return null;
  }
}

export async function getPendingTelemetryPoints(ownerUid: string, maxItems = 250) {
  requireUid(ownerUid);
  const db = await openDatabase();
  return db.getAllAsync<TelemetryPoint>(
    `SELECT l.id, l.ownerUid, l.sessaoId, s.veiculoId, l.pid, l.valor, l.unidade, l.timestamp
     FROM leitura_local l JOIN sessao_local s ON s.id = l.sessaoId
     WHERE l.ownerUid = ? AND s.ownerUid = ? AND l.syncStatus = 0
     ORDER BY l.timestamp ASC, l.id ASC LIMIT ?`,
    [ownerUid, ownerUid, maxItems],
  );
}

export async function marcarTelemetriaSincronizada(ownerUid: string, ids: string[]) {
  requireUid(ownerUid);
  if (!ids.length) return;
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const id of ids) {
      await tx.runAsync(
        'UPDATE leitura_local SET syncStatus = 1, sincronizado = 1 WHERE ownerUid = ? AND id = ?',
        [ownerUid, id],
      );
    }
  });
}

export async function applyRemoteSyncItem(
  ownerUid: string,
  entity: SyncEntity,
  entityId: string,
  data: Record<string, any>,
  parentId?: string,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const rawUpdatedAt = data.clientUpdatedAt ?? data.updatedAt;
  const timestampValue = rawUpdatedAt && typeof rawUpdatedAt.toMillis === 'function'
    ? Number(rawUpdatedAt.toMillis())
    : Number(rawUpdatedAt);
  const clientUpdatedAt = Number.isFinite(timestampValue) ? timestampValue : Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const pending = await tx.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox WHERE ownerUid = ? AND entity = ? AND entityId = ?',
      [ownerUid, entity, entityId],
    );
    if ((pending?.count ?? 0) > 0) return;
    switch (entity) {
      case 'profile':
        await tx.runAsync(
          `INSERT INTO perfil_local (ownerUid, displayName, firstName, lastName, email, vehicleId, updatedAt, syncStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(ownerUid) DO UPDATE SET
             displayName = excluded.displayName, firstName = excluded.firstName,
             lastName = excluded.lastName, email = excluded.email,
             vehicleId = COALESCE(excluded.vehicleId, perfil_local.vehicleId),
             updatedAt = excluded.updatedAt, syncStatus = 1`,
          [ownerUid, data.displayName ?? '', data.firstName ?? null, data.lastName ?? null,
            data.email ?? '', data.vehicleId ?? null, clientUpdatedAt],
        );
        break;
      case 'vehicle':
        await writeVehicle(tx, ownerUid, {
          marca: data.marca ?? '', veiculo: data.veiculo ?? data.modelo ?? '',
          motor: data.motor ?? '', ano: data.ano ?? '', km: String(data.km ?? data.quilometragem ?? 0),
          combustivel: data.combustivel ?? '',
          odometroOffset: Number(data.odometroOffset ?? 0),
          ultimoObdKm: Number(data.ultimoObdKm ?? 0),
          odometroCalibrado: Boolean(data.odometroCalibrado),
        }, entityId, false, clientUpdatedAt);
        break;
      case 'trip':
        await tx.runAsync(
          `INSERT INTO sessao_local
           (id, ownerUid, veiculoId, inicio, protocolo, status, distancia_percorrida, sincronizado, updatedAt, deletedAt, syncStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET ownerUid = excluded.ownerUid, veiculoId = excluded.veiculoId,
             inicio = excluded.inicio, protocolo = excluded.protocolo, status = excluded.status,
             distancia_percorrida = excluded.distancia_percorrida, updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt, syncStatus = 1, sincronizado = 1`,
          [entityId, ownerUid, data.veiculoId ?? parentId, data.inicio ?? Date.now(), data.protocolo ?? '',
            data.status ?? 'FINALIZADA', data.distancia_percorrida ?? 0, clientUpdatedAt, data.deletedAt ?? null],
        );
        break;
      case 'fault':
        await tx.runAsync(
          `INSERT OR IGNORE INTO dtc_local
           (id, ownerUid, sessaoId, codigo, descricao, sistema, tipo, detectadoEm, sincronizado, updatedAt, deletedAt, syncStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
          [entityId, ownerUid, data.sessaoId ?? parentId, data.codigo ?? '', data.descricao ?? '',
            data.sistema ?? '', data.tipo ?? '', data.detectadoEm ?? Date.now(), clientUpdatedAt, data.deletedAt ?? null],
        );
        break;
      case 'maintenance':
        await tx.runAsync(
          `INSERT INTO manutencao_local
           (id, ownerUid, veiculoId, tipo, dataRealizada, kmNaOcasiao, custo, proximoKm, sincronizado, updatedAt, deletedAt, syncStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET ownerUid = excluded.ownerUid, veiculoId = excluded.veiculoId,
             tipo = excluded.tipo, dataRealizada = excluded.dataRealizada, kmNaOcasiao = excluded.kmNaOcasiao,
             custo = excluded.custo, proximoKm = excluded.proximoKm, sincronizado = 1,
             updatedAt = excluded.updatedAt, deletedAt = excluded.deletedAt, syncStatus = 1`,
          [entityId, ownerUid, data.veiculoId ?? parentId, data.tipo ?? '', data.dataRealizada ?? Date.now(),
            data.kmNaOcasiao ?? 0, data.custo ?? 0, data.proximoKm ?? null, clientUpdatedAt, data.deletedAt ?? null],
        );
        break;
      case 'refuel':
        await tx.runAsync(
          `INSERT INTO abastecimento_local
           (id, ownerUid, veiculoId, dataAbastecimento, litros, custoTotal, kmNaOcasiao, sincronizado, updatedAt, deletedAt, syncStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET ownerUid = excluded.ownerUid, veiculoId = excluded.veiculoId,
             dataAbastecimento = excluded.dataAbastecimento, litros = excluded.litros,
             custoTotal = excluded.custoTotal, kmNaOcasiao = excluded.kmNaOcasiao,
             sincronizado = 1, updatedAt = excluded.updatedAt, deletedAt = excluded.deletedAt, syncStatus = 1`,
          [entityId, ownerUid, data.veiculoId ?? parentId, data.dataAbastecimento ?? Date.now(), data.litros ?? 0,
            data.custoTotal ?? 0, data.kmNaOcasiao ?? 0, clientUpdatedAt, data.deletedAt ?? null],
        );
        break;
    }
  });
}

export async function applyRemoteTelemetryChunk(
  ownerUid: string,
  points: Array<Record<string, any>>,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const point of points) {
      if (!point.id || !point.sessaoId) continue;
      const localPending = await tx.getFirstAsync<{ syncStatus: number }>(
        'SELECT syncStatus FROM leitura_local WHERE ownerUid = ? AND id = ?', [ownerUid, point.id],
      );
      if (localPending?.syncStatus === 0) continue;
      await tx.runAsync(
        `INSERT OR IGNORE INTO leitura_local
         (id, ownerUid, sessaoId, pid, valor, unidade, timestamp, sincronizado, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [point.id, ownerUid, point.sessaoId, point.pid ?? '', point.valor ?? 0,
          point.unidade ?? '', point.timestamp ?? Date.now()],
      );
    }
  });
}

export async function obterCursorSincronizacao(ownerUid: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ lastPullAt: number | null }>(
    'SELECT lastPullAt FROM sync_state WHERE ownerUid = ?', [ownerUid],
  );
  return row?.lastPullAt ?? null;
}

export async function obterCursorColecao(ownerUid: string, collectionKey: string) {
  requireUid(ownerUid);
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ lastPullAt: number }>(
    'SELECT lastPullAt FROM sync_cursors WHERE ownerUid = ? AND collectionKey = ?',
    [ownerUid, collectionKey],
  );
  return row?.lastPullAt ?? null;
}

export async function salvarCursorColecao(
  ownerUid: string,
  collectionKey: string,
  lastPullAt: number,
) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO sync_cursors (ownerUid, collectionKey, lastPullAt) VALUES (?, ?, ?)
     ON CONFLICT(ownerUid, collectionKey) DO UPDATE SET
       lastPullAt = MAX(sync_cursors.lastPullAt, excluded.lastPullAt)`,
    [ownerUid, collectionKey, lastPullAt],
  );
}

export async function salvarCursorSincronizacao(ownerUid: string, lastPullAt: number) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO sync_state (ownerUid, lastPullAt, lastSyncedAt, lastError)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(ownerUid) DO UPDATE SET
       lastPullAt = MAX(COALESCE(sync_state.lastPullAt, 0), excluded.lastPullAt),
       lastSyncedAt = excluded.lastSyncedAt, lastError = NULL`,
    [ownerUid, lastPullAt, Date.now()],
  );
}

export async function salvarErroSincronizacao(ownerUid: string, message: string | null) {
  requireUid(ownerUid);
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO sync_state (ownerUid, lastError) VALUES (?, ?)
     ON CONFLICT(ownerUid) DO UPDATE SET lastError = excluded.lastError`,
    [ownerUid, message],
  );
}

export async function getSyncStatus(ownerUid: string): Promise<LocalSyncStatus> {
  requireUid(ownerUid);
  const db = await openDatabase();
  const pending = await db.getFirstAsync<{ count: number }>(
    `SELECT
       (SELECT COUNT(*) FROM sync_outbox WHERE ownerUid = ?) +
       (SELECT COUNT(*) FROM leitura_local WHERE ownerUid = ? AND syncStatus = 0) AS count`,
    [ownerUid, ownerUid],
  );
  const state = await db.getFirstAsync<any>(
    'SELECT lastSyncedAt, lastError FROM sync_state WHERE ownerUid = ?', [ownerUid],
  );
  return {
    pendingCount: pending?.count ?? 0,
    lastSyncedAt: state?.lastSyncedAt ?? null,
    lastError: state?.lastError ?? null,
  };
}

export async function registrarFalhasLegadas(
  ownerUid: string,
  veiculoId: string,
  faults: Array<Record<string, any>>,
) {
  requireUid(ownerUid);
  if (!faults.length) return;
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    let session = await tx.getFirstAsync<{ id: string }>(
      `SELECT id FROM sessao_local WHERE ownerUid = ? AND veiculoId = ? ORDER BY inicio DESC LIMIT 1`,
      [ownerUid, veiculoId],
    );
    if (!session) {
      const sessionId = generateId();
      const now = Date.now();
      await tx.runAsync(
        `INSERT INTO sessao_local (id, ownerUid, veiculoId, inicio, protocolo, status, updatedAt, syncStatus)
         VALUES (?, ?, ?, ?, 'LEGACY', 'FINALIZADA', ?, 0)`,
        [sessionId, ownerUid, veiculoId, now, now],
      );
      await enqueue(tx, ownerUid, 'trip', sessionId);
      session = { id: sessionId };
    }
    for (const fault of faults) {
      const id = String(fault.id ?? generateId());
      const now = Number(fault.detectadoEm ?? Date.now());
      await tx.runAsync(
        `INSERT OR IGNORE INTO dtc_local
         (id, ownerUid, sessaoId, codigo, descricao, sistema, tipo, detectadoEm, updatedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, ownerUid, session.id, fault.codigo ?? '', fault.descricao ?? '', fault.sistema ?? '',
          fault.tipo ?? 'warning', now, now],
      );
      await enqueue(tx, ownerUid, 'fault', id);
    }
  });
  notifyLocalDataChanged(ownerUid);
}
