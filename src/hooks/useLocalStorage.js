import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

// Debounce timer registry for Supabase cloud sync
const syncTimers = {};

export function useLocalStorage(key, initialValue) {
  const instanceId = useRef(Math.random().toString(36).substring(2)).current;
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const readValue = useCallback(() => {
    if (!key || typeof window === 'undefined') {
      return initialValueRef.current;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        let parsed = JSON.parse(item);
        if (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('{'))) {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        return parsed;
      }
      return initialValueRef.current;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValueRef.current;
    }
  }, [key]);

  const [storedValue, setStoredValue] = useState(readValue);

  // Reload when key changes (e.g. user logs in, switches profile, or logs out)
  useEffect(() => {
    setStoredValue(readValue());
  }, [key, readValue]);

  const setValue = useCallback((value) => {
    try {
      setStoredValue(prevStoredValue => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        if (!key || typeof window === 'undefined') {
          return valueToStore;
        }

        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (e) {
          console.error(`Error writing to localStorage key "${key}":`, e);
        }

        // Notify other components asynchronously outside the current state tick
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('local-storage-sync', {
            detail: { key, newValue: valueToStore, senderId: instanceId }
          }));
        }, 0);

        // Up-sync to Supabase user_sync with 2.5s debounce ONLY if authenticated
        if (syncTimers[key]) clearTimeout(syncTimers[key]);
        
        syncTimers[key] = setTimeout(async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && key) {
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

        return valueToStore;
      });
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, instanceId]);

  useEffect(() => {
    if (!key) return;

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
      if (e.detail && e.detail.key === key && e.detail.senderId !== instanceId) {
        setStoredValue(e.detail.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-sync', handleCustomSync);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-sync', handleCustomSync);
    };
  }, [key, initialValue, instanceId]);

  return [storedValue, setValue];
}
