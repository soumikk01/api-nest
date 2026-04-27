'use client';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * useFetch — auto-fetches on mount and whenever `path` changes.
 *
 * ✅ AbortController: if the component unmounts or `path` changes before the
 *    previous request finishes, the in-flight request is cancelled. This
 *    prevents race conditions and stale state updates.
 */
export function useFetch<T>(path: string, options?: RequestInit) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // Keep a stable ref to the latest options to avoid re-triggering the effect
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const url = path.startsWith('http') ? path : `${API}${path}`;

  const execute = useCallback(
    async (signal?: AbortSignal): Promise<T | undefined> => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        // fetchWithAuth automatically handles:
        // 1. Injecting the Bearer token
        // 2. Refreshing on 401
        // 3. Rejecting/Logging out if refresh fails
        const res = await fetchWithAuth(url, {
          ...optionsRef.current,
          signal,
          headers: {
            'Content-Type': 'application/json',
            ...(optionsRef.current?.headers ?? {}),
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
          throw new Error(err.message ?? `HTTP ${res.status}`);
        }

        const data = await res.json() as T;
        setState({ data, loading: false, error: null });
        return data;
      } catch (err) {
        // AbortError is expected on cleanup — do NOT update state for cancelled requests
        if ((err as Error).name === 'AbortError') return;

        const msg = (err as Error).message;
        setState({ data: null, loading: false, error: msg });
        throw err;
      }
    },
    [url],
  );

  useEffect(() => {
    // Create a new AbortController for every fetch cycle
    const controller = new AbortController();

    void execute(controller.signal);

    // Cleanup: cancel the request if the component unmounts or `url` changes
    return () => controller.abort();
  }, [execute]);

  // Manual refetch (e.g. pull-to-refresh) — creates its own controller
  const refetch = useCallback(() => {
    const controller = new AbortController();
    void execute(controller.signal);
    return () => controller.abort();
  }, [execute]);

  return { ...state, refetch };
}

/**
 * useApi — imperative one-off requests (POST / PUT / PATCH / DELETE).
 *
 * ✅ Prevents duplicate submissions: `isLoading` is true while a request is
 *    in flight. Callers should disable their submit button while `isLoading`.
 * ✅ AbortController: call the returned `abort` function to cancel.
 */
export function useApi() {
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const request = useCallback(async <T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
    body?: unknown,
  ): Promise<T> => {
    // Cancel any previous in-flight request from this hook instance
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetchWithAuth(`${API}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const data = await res.json() as T & { message?: string };
      if (!res.ok) throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err; // let caller handle
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Allow callers to cancel an in-flight mutation
  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { request, isLoading, abort };
}
