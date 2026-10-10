import { useCallback, useState } from "react";

/**
 * Runs a button's async action and keeps its error, so a failed save shows a message
 * instead of doing nothing. `busy` is for disabling the button while it runs.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);
  return { run, busy, error };
}
