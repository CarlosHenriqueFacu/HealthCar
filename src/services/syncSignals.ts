type SyncListener = (ownerUid: string) => void;

const listeners = new Set<SyncListener>();

export function notifyLocalDataChanged(ownerUid: string) {
  if (!ownerUid) return;
  for (const listener of listeners) listener(ownerUid);
}

export function subscribeToLocalDataChanges(listener: SyncListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
