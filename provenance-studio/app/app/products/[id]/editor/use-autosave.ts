"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SaveStatus } from "./types";

type Saver<P> = (key: string, patch: P) => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Autosave par entité : les modifications d'une même clé sont fusionnées et
 * envoyées `delay` ms après la dernière frappe. En cas d'échec, le patch est
 * conservé et renvoyé à la prochaine modification (ou via `flush`).
 */
export function useAutosave<P extends object>(save: Saver<P>, delay = 800) {
  const pending = useRef(new Map<string, P>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(0);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flushKey = useCallback(async (key: string) => {
    timers.current.delete(key);
    const patch = pending.current.get(key);
    if (!patch) return;
    pending.current.delete(key);
    inFlight.current += 1;
    setStatus("saving");
    const result = await saveRef.current(key, patch);
    inFlight.current -= 1;
    if (!result.ok) {
      // On remet le patch en attente (sous les modifications plus récentes).
      pending.current.set(key, { ...patch, ...(pending.current.get(key) ?? {}) });
      setError(result.error);
      setStatus("error");
      return;
    }
    if (inFlight.current === 0 && pending.current.size === 0) {
      setError(null);
      setStatus("saved");
    }
  }, []);

  const queue = useCallback(
    (key: string, patch: P) => {
      pending.current.set(key, { ...(pending.current.get(key) ?? {}), ...patch });
      setStatus("saving");
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => void flushKey(key), delay),
      );
    },
    [delay, flushKey],
  );

  const flush = useCallback(async () => {
    const keys = [...new Set([...timers.current.keys(), ...pending.current.keys()])];
    for (const key of keys) {
      const t = timers.current.get(key);
      if (t) clearTimeout(t);
    }
    await Promise.all(keys.map((k) => flushKey(k)));
  }, [flushKey]);

  /** Oublie les modifications en attente d'une clé (entité supprimée). */
  const discard = useCallback((key: string) => {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
    pending.current.delete(key);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0 || inFlight.current > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return useMemo(
    () => ({ queue, flush, discard, status, error }),
    [queue, flush, discard, status, error],
  );
}
