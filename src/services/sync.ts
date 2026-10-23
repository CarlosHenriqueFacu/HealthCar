import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import {
  applyRemoteSyncItem,
  applyRemoteTelemetryChunk,
  getPendingSyncItems,
  getPendingTelemetryPoints,
  getSyncStatus,
  listarVeiculosLocais,
  listarViagensLocais,
  marcarItensSincronizados,
  marcarTelemetriaSincronizada,
  obterCursorColecao,
  salvarCursorColecao,
  salvarCursorSincronizacao,
  salvarErroSincronizacao,
  salvarPerfilLocal,
  salvarVeiculoLocal,
  type SyncQueueItem,
  type SyncEntity,
} from '../database/database';
import { getFirebaseFirestore } from './firebase';
import { subscribeToLocalDataChanges } from './syncSignals';

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'pending' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  pendingCount: number;
  lastSyncedAt: number | null;
  error: string | null;
}

export interface SyncWorker {
  initialSync: Promise<void>;
  syncNow: () => Promise<void>;
  stop: () => void;
}

const PAGE_SIZE = 200;
const TELEMETRY_POINTS_PER_CHUNK = 250;
const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

function timestampMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function vehicleCollection(db: ReturnType<typeof getFirebaseFirestore>, uid: string) {
  return collection(db, 'users', uid, 'vehicles');
}

function tripCollection(
  db: ReturnType<typeof getFirebaseFirestore>,
  uid: string,
  vehicleId: string,
) {
  return collection(db, 'users', uid, 'vehicles', vehicleId, 'trips');
}

function entityDocumentRef(db: ReturnType<typeof getFirebaseFirestore>, item: SyncQueueItem) {
  const { ownerUid, entity, entityId, parentId, data } = item;
  switch (entity) {
    case 'profile':
      return doc(db, 'users', ownerUid);
    case 'vehicle':
      return doc(db, 'users', ownerUid, 'vehicles', entityId);
    case 'trip':
      return doc(db, 'users', ownerUid, 'vehicles', String(data.veiculoId ?? parentId), 'trips', entityId);
    case 'fault':
      return doc(
        db, 'users', ownerUid, 'vehicles', String(data.veiculoId),
        'trips', String(parentId), 'faults', entityId,
      );
    case 'maintenance':
      return doc(db, 'users', ownerUid, 'vehicles', String(parentId), 'maintenance', entityId);
    case 'refuel':
      return doc(db, 'users', ownerUid, 'vehicles', String(parentId), 'refuels', entityId);
  }
}

function cloudPayload(item: SyncQueueItem) {
  const data = item.data;
  const common = {
    id: item.entityId,
    ownerUid: item.ownerUid,
    clientUpdatedAt: Number(data.updatedAt ?? Date.now()),
    updatedAt: serverTimestamp(),
    deletedAt: data.deletedAt ?? null,
  };

  switch (item.entity) {
    case 'profile':
      return {
        ...common,
        displayName: data.displayName ?? '',
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? '',
        vehicleId: data.vehicleId ?? null,
      };
    case 'vehicle':
      return {
        ...common,
        marca: data.marca ?? '',
        modelo: data.veiculo ?? data.modelo ?? '',
        ano: data.ano ?? '',
        motor: data.motor ?? '',
        combustivel: data.combustivel ?? '',
        quilometragem: Number(data.quilometragem ?? data.km ?? 0),
        odometroOffset: Number(data.odometroOffset ?? 0),
        ultimoObdKm: Number(data.ultimoObdKm ?? 0),
        odometroCalibrado: Boolean(data.odometroCalibrado),
      };
    case 'trip':
      return {
        ...common,
        veiculoId: data.veiculoId ?? item.parentId ?? null,
        inicio: Number(data.inicio ?? Date.now()),
        protocolo: data.protocolo ?? '',
        status: data.status ?? 'ATIVA',
        distancia_percorrida: Number(data.distancia_percorrida ?? 0),
      };
    case 'fault':
      return {
        ...common,
        sessaoId: data.sessaoId ?? item.parentId ?? null,
        codigo: data.codigo ?? '',
        descricao: data.descricao ?? '',
        sistema: data.sistema ?? '',
        tipo: data.tipo ?? 'warning',
        detectadoEm: Number(data.detectadoEm ?? Date.now()),
      };
    case 'maintenance':
      return {
        ...common,
        veiculoId: data.veiculoId ?? item.parentId ?? null,
        tipo: data.tipo ?? '',
        dataRealizada: Number(data.dataRealizada ?? Date.now()),
        kmNaOcasiao: Number(data.kmNaOcasiao ?? 0),
        custo: Number(data.custo ?? 0),
        proximoKm: data.proximoKm ?? null,
      };
    case 'refuel':
      return {
        ...common,
        veiculoId: data.veiculoId ?? item.parentId ?? null,
        dataAbastecimento: Number(data.dataAbastecimento ?? Date.now()),
        litros: Number(data.litros ?? 0),
        custoTotal: Number(data.custoTotal ?? 0),
        kmNaOcasiao: Number(data.kmNaOcasiao ?? 0),
      };
  }
}

async function pushPendingRecords(uid: string) {
  const db = getFirebaseFirestore();
  const items = await getPendingSyncItems(uid, PAGE_SIZE);
  if (!items.length) return 0;

  const batch = writeBatch(db);
  for (const item of items) {
    const ref = entityDocumentRef(db, item);
    if (item.operation === 'delete') batch.delete(ref);
    else batch.set(ref, cloudPayload(item), { merge: true });
  }
  await batch.commit();
  await marcarItensSincronizados(uid, items.map((item) => item.outboxId));
  return items.length;
}

async function pushPendingTelemetry(uid: string) {
  const db = getFirebaseFirestore();
  const points = await getPendingTelemetryPoints(uid, TELEMETRY_POINTS_PER_CHUNK);
  if (!points.length) return 0;

  const byTrip = new Map<string, typeof points>();
  for (const point of points) {
    const tripPoints = byTrip.get(point.sessaoId) ?? [];
    tripPoints.push(point);
    byTrip.set(point.sessaoId, tripPoints);
  }

  let sent = 0;
  for (const [tripId, tripPoints] of byTrip) {
    const vehicleId = tripPoints[0].veiculoId;
    if (!vehicleId) continue;
    const firstId = tripPoints[0].id;
    const lastId = tripPoints[tripPoints.length - 1].id;
    const chunkId = `${firstId}_${lastId}`;
    const chunkRef = doc(
      db, 'users', uid, 'vehicles', vehicleId, 'trips', tripId, 'telemetryChunks', chunkId,
    );
    await setDoc(chunkRef, {
      ownerUid: uid,
      tripId,
      vehicleId,
      points: tripPoints.map((point) => ({
        id: point.id,
        sessaoId: point.sessaoId,
        pid: point.pid,
        valor: point.valor,
        unidade: point.unidade,
        timestamp: point.timestamp,
      })),
      clientUpdatedAt: Math.max(...tripPoints.map((point) => point.timestamp)),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await marcarTelemetriaSincronizada(uid, tripPoints.map((point) => point.id));
    sent += tripPoints.length;
  }
  return sent;
}

async function readChangedDocuments(
  ref: CollectionReference<DocumentData>,
  cursor: number | null,
) {
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];
  let maxUpdatedAt = cursor ?? 0;
  let lastDocument: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const constraints: QueryConstraint[] = cursor === null
      ? [orderBy('updatedAt'), orderBy(documentId()), limit(PAGE_SIZE)]
      : [where('updatedAt', '>=', Timestamp.fromMillis(cursor)), orderBy('updatedAt'), orderBy(documentId()), limit(PAGE_SIZE)];
    const pageQuery = lastDocument
      ? query(ref, ...constraints.slice(0, -1), startAfter(lastDocument), limit(PAGE_SIZE))
      : query(ref, ...constraints);
    const snapshot = await getDocs(pageQuery);
    if (snapshot.empty) break;
    docs.push(...snapshot.docs);
    lastDocument = snapshot.docs[snapshot.docs.length - 1];
    for (const document of snapshot.docs) {
      maxUpdatedAt = Math.max(maxUpdatedAt, timestampMillis(document.get('updatedAt')) ?? 0);
    }
    if (snapshot.size < PAGE_SIZE) break;
  }
  return { docs, maxUpdatedAt };
}

async function pullCollection(
  uid: string,
  entity: SyncEntity,
  ref: CollectionReference<DocumentData>,
  collectionKey: string,
  parentId?: string,
  vehicleId?: string,
) {
  const cursor = await obterCursorColecao(uid, collectionKey);
  const result = await readChangedDocuments(ref, cursor);
  for (const snapshot of result.docs) {
    const data = snapshot.data();
    if (data.ownerUid && data.ownerUid !== uid) continue;
    if (entity === 'profile') {
      await applyRemoteSyncItem(uid, 'profile', uid, data);
    } else {
      const parentData = entity === 'trip' || entity === 'maintenance' || entity === 'refuel'
        ? vehicleId
        : entity === 'fault'
          ? parentId
          : undefined;
      const remoteData = entity === 'fault' && vehicleId
        ? { ...data, veiculoId: vehicleId }
        : data;
      await applyRemoteSyncItem(uid, entity, snapshot.id, remoteData, parentData);
    }
  }
  if (result.maxUpdatedAt > 0) {
    await salvarCursorColecao(uid, collectionKey, result.maxUpdatedAt);
  }
}

async function pullTelemetryChunks(
  uid: string,
  vehicleId: string,
  tripId: string,
) {
  const db = getFirebaseFirestore();
  const ref = collection(
    db, 'users', uid, 'vehicles', vehicleId, 'trips', tripId, 'telemetryChunks',
  );
  const collectionKey = `vehicles/${vehicleId}/trips/${tripId}/telemetryChunks`;
  const cursor = await obterCursorColecao(uid, collectionKey);
  const result = await readChangedDocuments(ref, cursor);
  for (const snapshot of result.docs) {
    const data = snapshot.data();
    if (data.ownerUid && data.ownerUid !== uid) continue;
    if (Array.isArray(data.points)) {
      await applyRemoteTelemetryChunk(uid, data.points);
    }
  }
  if (result.maxUpdatedAt > 0) {
    await salvarCursorColecao(uid, collectionKey, result.maxUpdatedAt);
  }
}

async function pullAccountData(uid: string) {
  const db = getFirebaseFirestore();
  const profileSnapshot = await getDoc(doc(db, 'users', uid));
  let remoteProfile: Record<string, any> | null = null;
  if (profileSnapshot.exists()) {
    remoteProfile = profileSnapshot.data();
    if (!remoteProfile.ownerUid || remoteProfile.ownerUid === uid) {
      await applyRemoteSyncItem(uid, 'profile', uid, remoteProfile);
    }
  }

  await pullCollection(uid, 'vehicle', vehicleCollection(db, uid), 'vehicles');

  let vehicles = await listarVeiculosLocais(uid);
  if (!vehicles.length && remoteProfile?.vehicle && typeof remoteProfile.vehicle === 'object') {
    const legacyVehicle = remoteProfile.vehicle;
    const vehicleId = String(remoteProfile.vehicleId ?? `vehicle_${uid.slice(0, 18)}`);
    await salvarVeiculoLocal(uid, {
      marca: legacyVehicle.marca ?? '',
      veiculo: legacyVehicle.veiculo ?? legacyVehicle.modelo ?? '',
      motor: legacyVehicle.motor ?? '',
      ano: legacyVehicle.ano ?? '',
      km: String(legacyVehicle.km ?? legacyVehicle.quilometragem ?? 0),
      combustivel: legacyVehicle.combustivel ?? '',
      odometroOffset: Number(legacyVehicle.odometroOffset ?? 0),
      ultimoObdKm: Number(legacyVehicle.ultimoObdKm ?? 0),
      odometroCalibrado: Boolean(legacyVehicle.odometroCalibrado),
    }, vehicleId);
    await salvarPerfilLocal(uid, {
      displayName: remoteProfile.displayName ?? '',
      firstName: remoteProfile.firstName ?? undefined,
      lastName: remoteProfile.lastName ?? undefined,
      email: remoteProfile.email ?? '',
      vehicleId,
    });
    vehicles = await listarVeiculosLocais(uid);
  }

  for (const vehicle of vehicles) {
    const vehicleId = String(vehicle.id);
    await pullCollection(
      uid, 'trip', tripCollection(db, uid, vehicleId), `vehicles/${vehicleId}/trips`, undefined, vehicleId,
    );
    await pullCollection(
      uid, 'maintenance', collection(db, 'users', uid, 'vehicles', vehicleId, 'maintenance'),
      `vehicles/${vehicleId}/maintenance`, undefined, vehicleId,
    );
    await pullCollection(
      uid, 'refuel', collection(db, 'users', uid, 'vehicles', vehicleId, 'refuels'),
      `vehicles/${vehicleId}/refuels`, undefined, vehicleId,
    );

    const trips = await listarViagensLocais(uid, vehicleId);
    for (const trip of trips) {
      const tripId = String(trip.id);
      await pullCollection(
        uid, 'fault',
        collection(db, 'users', uid, 'vehicles', vehicleId, 'trips', tripId, 'faults'),
        `vehicles/${vehicleId}/trips/${tripId}/faults`, tripId, vehicleId,
      );
      await pullTelemetryChunks(uid, vehicleId, tripId);
    }
  }
}

export async function synchronizeAccount(uid: string) {
  if (!uid) throw new Error('Conta não autenticada para sincronização.');
  await pushPendingRecords(uid);
  await pushPendingTelemetry(uid);
  await pullAccountData(uid);

  // A restauração de perfis legados pode criar uma nova ficha local durante o pull.
  await pushPendingRecords(uid);
  await pushPendingTelemetry(uid);
  await salvarCursorSincronizacao(uid, Date.now());
  await salvarErroSincronizacao(uid, null);
  return getSyncStatus(uid);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'A sincronização não foi concluída. Os dados continuam salvos no aparelho.';
}

export function startSyncWorker(
  uid: string,
  onStatus: (status: SyncStatus) => void,
): SyncWorker {
  let stopped = false;
  let running = false;
  let rerunRequested = false;
  let retryCount = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let currentStatus: SyncStatus = { phase: 'idle', pendingCount: 0, lastSyncedAt: null, error: null };
  let appState: AppStateStatus = AppState.currentState;

  const publish = async (phase: SyncPhase, error: string | null = null) => {
    const local = await getSyncStatus(uid).catch(() => ({
      pendingCount: currentStatus.pendingCount,
      lastSyncedAt: currentStatus.lastSyncedAt,
      lastError: error,
    }));
    currentStatus = {
      phase,
      pendingCount: local.pendingCount,
      lastSyncedAt: local.lastSyncedAt,
      error: error ?? local.lastError,
    };
    onStatus(currentStatus);
  };

  const schedule = (delay: number) => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void runNow();
    }, delay);
  };

  const runNow = async (): Promise<void> => {
    if (stopped) return;
    if (running) {
      rerunRequested = true;
      return;
    }
    running = true;
    rerunRequested = false;
    await publish('syncing');
    try {
      const result = await synchronizeAccount(uid);
      retryCount = 0;
      await publish(result.pendingCount > 0 ? 'pending' : 'synced', null);
      if (result.pendingCount > 0) schedule(2_000);
    } catch (error) {
      retryCount += 1;
      const retryDelay = Math.min(INITIAL_RETRY_MS * 2 ** (retryCount - 1), MAX_RETRY_MS);
      const message = errorMessage(error);
      await salvarErroSincronizacao(uid, message).catch(() => {});
      await publish('error', message);
      schedule(retryDelay);
    } finally {
      running = false;
      if (rerunRequested) schedule(1_000);
    }
  };

  const unsubscribeLocal = subscribeToLocalDataChanges((changedUid) => {
    if (changedUid === uid) schedule(15_000);
  });
  const appStateSubscription = AppState.addEventListener('change', (nextState) => {
    const wasBackgrounded = appState !== 'active';
    appState = nextState;
    if (nextState === 'active' && wasBackgrounded) {
      if (timer) clearTimeout(timer);
      timer = null;
      void runNow();
    }
  });

  const initialSync = runNow();
  return {
    initialSync,
    syncNow: runNow,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      unsubscribeLocal();
      appStateSubscription.remove();
    },
  };
}
