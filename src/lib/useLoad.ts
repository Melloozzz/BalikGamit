import { useEffect, useState } from "react";
import { useDataVersion } from "../data/api";

/**
 * Runs an async loader and re-runs it whenever `deps` change or any write happens
 * through the data layer. Returns `undefined` while the first load is in flight.
 * A failed load is rethrown during render, so the error screen shows it instead of
 * the page spinning forever.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const version = useDataVersion();
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    load().then(
      (v) => {
        if (!alive) return;
        setValue(v);
        setError(null);
      },
      (err) => {
        if (alive) setError(err instanceof Error ? err : new Error(String(err ?? "Couldn't load this page.")));
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
  if (error) throw error;
  return value;
}
