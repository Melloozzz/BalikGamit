import { useEffect, useState } from "react";
import { useDataVersion } from "../data/api";

/**
 * Runs an async loader and re-runs it whenever `deps` change or any write happens
 * through the data layer. Returns `undefined` while the first load is in flight.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const version = useDataVersion();
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setValue(v));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
  return value;
}
