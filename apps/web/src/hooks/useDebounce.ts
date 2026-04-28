'use client';
import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until the user stops typing.
 *
 * Use this on search/filter inputs to avoid firing an API call on every
 * keystroke. Industry standard delay is 300–500ms.
 *
 * @example
 * const debouncedQuery = useDebounce(searchQuery, 400);
 * useEffect(() => { fetch(`/api/search?q=${debouncedQuery}`) }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    // Clear the timer if value changes before delay expires
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
