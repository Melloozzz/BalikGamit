// Tiny change-notification store: every write calls emit(), and useLoad() re-runs its
// loader, so pages show fresh data after any change.
import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

export function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
