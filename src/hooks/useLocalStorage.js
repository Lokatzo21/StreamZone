import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

// Debounce timer registry for Supabase cloud sync
const syncTimers = {};

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        let parsed = JSON.parse(item);
        if (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('{'))) {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        return parsed;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(prevStoredValue => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          
          // Cross-component sync in current window
          window.dispatchEvent(new CustomEvent('local-storage-sync', {
            detail: { key, newValue: valueToStore }
          }));

          // Up-sync to Supabase user_sync with 2.5s debounce
          if (syncTimers[key]) clearTimeout(syncTimers[key]);
          
          syncTimers[key] = setTimeout(async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('user_sync').upsert({
                  user_id: user.id,
                  key: key,
                  value: valueToStore,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, key' });
              }
            } catch (err) {
              console.warn('Supabase cloud sync deferred:', err?.message || err);
            }
          }, 2500);
        }
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        try {
          let newVal = e.newValue ? JSON.parse(e.newValue) : initialValue;
          if (typeof newVal === 'string' && (newVal.startsWith('[') || newVal.startsWith('{'))) {
            try { newVal = JSON.parse(newVal); } catch {}
          }
          setStoredValue(newVal);
        } catch {}
      }
    };

    const handleCustomSync = (e) => {
      if (e.detail && e.detail.key === key) {
        setStoredValue(e.detail.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-sync', handleCustomSync);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-sync', handleCustomSync);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
