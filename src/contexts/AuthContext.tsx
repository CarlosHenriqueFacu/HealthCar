import type { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isFirebaseConfigured,
  observeAuthState,
} from '../services/firebase';
import {
  migrarDadosLegados,
  obterVeiculoLocal,
  type VehicleInput,
} from '../database/database';
import {
  startSyncWorker,
  type SyncStatus,
  type SyncWorker,
} from '../services/sync';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  isAccountLoading: boolean;
  syncStatus: SyncStatus;
  syncNow: () => Promise<void>;
}

const idleSyncStatus: SyncStatus = {
  phase: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
};

const AuthContext = createContext<AuthContextData | undefined>(undefined);

function parseLegacyVehicle(value: string | null): (VehicleInput & { id?: string }) | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return {
      id: typeof parsed.id === 'string' ? parsed.id : undefined,
      marca: parsed.marca ?? '',
      veiculo: parsed.veiculo ?? parsed.modelo ?? '',
      motor: parsed.motor ?? '',
      ano: parsed.ano ?? '',
      km: String(parsed.km ?? parsed.quilometragem ?? 0),
      combustivel: parsed.combustivel ?? '',
      odometroOffset: Number(parsed.odometroOffset ?? 0),
      ultimoObdKm: Number(parsed.ultimoObdKm ?? 0),
      odometroCalibrado: Boolean(parsed.odometroCalibrado),
    };
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(idleSyncStatus);
  const workerRef = useRef<SyncWorker | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    return observeAuthState(
      (nextUser) => {
        setUser(nextUser);
        setIsLoading(false);
      },
      (error) => {
        console.error('[AuthContext] Falha ao observar a sessão Firebase:', error);
        setIsLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    workerRef.current?.stop();
    workerRef.current = null;

    if (!user) {
      setIsAccountLoading(false);
      setSyncStatus(idleSyncStatus);
      return;
    }

    let cancelled = false;
    const currentUser = user;
    setSyncStatus(idleSyncStatus);
    setIsAccountLoading(true);

    async function prepareAccount() {
      const legacyValue = await AsyncStorage.getItem('@veiculo_cadastrado').catch(() => null);
      const cachedUid = await AsyncStorage.getItem('@veiculo_cadastrado_uid').catch(() => null);
      const rememberedLegacyUid = await AsyncStorage.getItem('@legacy_data_owner_uid').catch(() => null);
      const legacyOwnerUid = rememberedLegacyUid ?? cachedUid;
      const mayClaimLegacyData = !legacyOwnerUid || legacyOwnerUid === currentUser.uid;
      const stashedVehicleKey = `@legacy_vehicle:${currentUser.uid}`;
      const stashedVehicle = await AsyncStorage.getItem(stashedVehicleKey).catch(() => null);
      const legacyVehicle = mayClaimLegacyData
        ? parseLegacyVehicle(cachedUid === currentUser.uid ? legacyValue : stashedVehicle ?? legacyValue)
        : undefined;

      const legacyStorageOwnerUid = mayClaimLegacyData ? currentUser.uid : legacyOwnerUid;
      const legacyKeys = ['@virtual_odometro', '@viagem_atual', '@falhas_count'] as const;
      if (legacyStorageOwnerUid) {
        const scopedPairs = legacyKeys.map((key) => [key, `${key}:${legacyStorageOwnerUid}`] as const);
        const legacyValues = await AsyncStorage.multiGet([...legacyKeys]);
        const scopedValues = await AsyncStorage.multiGet(scopedPairs.map(([, key]) => key));
        const scopedByKey = new Map(scopedValues);
        const valuesToMove = legacyValues.flatMap(([key, value]) => {
          const scopedKey = scopedPairs.find(([legacyKey]) => legacyKey === key)?.[1];
          return value && scopedKey && !scopedByKey.get(scopedKey) ? [[scopedKey, value] as [string, string]] : [];
        });
        if (valuesToMove.length) await AsyncStorage.multiSet(valuesToMove);
        await AsyncStorage.multiRemove([...legacyKeys]);
      }
      if (!mayClaimLegacyData) {
        if (legacyValue && cachedUid === legacyOwnerUid) {
          await AsyncStorage.setItem(`@legacy_vehicle:${legacyOwnerUid}`, legacyValue);
        }
        if (legacyOwnerUid) await AsyncStorage.setItem('@legacy_data_owner_uid', legacyOwnerUid);
        await AsyncStorage.multiRemove([
          '@veiculo_cadastrado',
          '@veiculo_cadastrado_uid',
        ]);
      }

      await migrarDadosLegados(
        currentUser.uid,
        legacyVehicle,
        {
          displayName: currentUser.displayName ?? '',
          firstName: currentUser.displayName?.split(' ')[0],
          email: currentUser.email ?? '',
        },
        mayClaimLegacyData,
      );

      const existingVehicle = await obterVeiculoLocal(currentUser.uid);
      if (existingVehicle) {
        await AsyncStorage.multiSet([
          ['@veiculo_cadastrado', JSON.stringify(existingVehicle)],
          ['@veiculo_cadastrado_uid', currentUser.uid],
        ]);
        await AsyncStorage.removeItem(stashedVehicleKey);
        if (rememberedLegacyUid === currentUser.uid) {
          await AsyncStorage.removeItem('@legacy_data_owner_uid');
        }
      } else {
        if (!mayClaimLegacyData) {
          await AsyncStorage.multiRemove(['@veiculo_cadastrado', '@veiculo_cadastrado_uid']);
        }
      }

      if (!cancelled) setIsAccountLoading(!existingVehicle);

      const worker = startSyncWorker(currentUser.uid, (nextStatus) => {
        if (!cancelled) setSyncStatus(nextStatus);
      });
      workerRef.current = worker;

      // A profile is created from Firebase Auth before restoration. The vehicle is
      // the reliable signal that this device has already restored account data.
      if (!existingVehicle) {
        await worker.initialSync;
      }

      const restoredVehicle = await obterVeiculoLocal(currentUser.uid);
      if (!cancelled && restoredVehicle) {
        await AsyncStorage.multiSet([
          ['@veiculo_cadastrado', JSON.stringify(restoredVehicle)],
          ['@veiculo_cadastrado_uid', currentUser.uid],
        ]);
      }

      if (!cancelled) setIsAccountLoading(false);
    }

    prepareAccount().catch((error) => {
      console.error('[AuthContext] Falha ao preparar dados locais da conta:', error);
      if (!cancelled) setIsAccountLoading(false);
    });

    return () => {
      cancelled = true;
      workerRef.current?.stop();
      workerRef.current = null;
    };
  }, [user]);

  const syncNow = async () => {
    await workerRef.current?.syncNow();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAccountLoading, syncStatus, syncNow }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
