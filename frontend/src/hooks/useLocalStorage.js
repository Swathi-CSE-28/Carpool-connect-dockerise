import { useState, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue) => {
      setValue((prev) => {
        const resolved = typeof newValue === 'function' ? newValue(prev) : newValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore storage write failures (e.g. private browsing)
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
}
