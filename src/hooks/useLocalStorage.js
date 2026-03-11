import { useState, useEffect, useRef } from 'react';

/**
 * Like useState but persists value to localStorage.
 * Value is read once on mount. Writes are debounced 400ms to avoid
 * hammering storage during drag-resize updates.
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [key, value]);

  return [value, setValue];
}
