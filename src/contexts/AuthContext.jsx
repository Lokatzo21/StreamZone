import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export const ADMIN_EMAILS = [
  'manuelminuttimoreno@gmail.com',
  'manuelminuttimoreno21@gmail.com',
  'manuelminuttimoreno2109@gmail.com',
  'manuelminuttimoreno2109uni@gmail.com'
];

export const isUserAdmin = (user) => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
};

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');

  const requireAuth = (callback, reason = 'Debes iniciar sesión para realizar esta acción.') => {
    if (user) {
      if (typeof callback === 'function') callback();
      return true;
    }
    setAuthModalReason(reason);
    setIsAuthModalOpen(true);
    return false;
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalReason('');
  };

  const syncDown = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_sync')
        .select('key, value')
        .eq('user_id', userId);
        
      if (data && !error) {
        data.forEach((row) => {
          let valToStore = row.value;
          if (typeof valToStore === 'string') {
            try {
              const parsed = JSON.parse(valToStore);
              if (parsed !== null && typeof parsed === 'object') {
                valToStore = parsed;
              }
            } catch {}
          }
          const strForStorage = JSON.stringify(valToStore);
          const scopedKey = row.key.startsWith(`streamzone_${userId}_`) 
            ? row.key 
            : `streamzone_${userId}_${row.key.replace(/^streamzone_/, '')}`;
          window.localStorage.setItem(scopedKey, strForStorage);
          window.dispatchEvent(new CustomEvent('local-storage-sync', {
            detail: { key: scopedKey, newValue: valToStore }
          }));
        });
      }
    } catch (e) {
      console.error('Error in cloud down-sync:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          setUser(freshUser ?? session.user);
          syncDown(session.user.id);
        });
      } else {
        setUser(null);
        setLoading(false);
        // Clean any residual unscoped streamzone keys for guests
        try {
          const keysToRemove = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith('streamzone_') && !k.match(/streamzone_[0-9a-fA-F-]{36}_/)) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
        } catch {}
      }
    });

    let syncChannel = null;

    const setupSyncChannel = (userId) => {
      if (syncChannel) supabase.removeChannel(syncChannel);
      syncChannel = supabase
        .channel(`user_sync_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_sync',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const row = payload.new;
            if (row && row.key) {
              let valToStore = row.value;
              if (typeof valToStore === 'string') {
                try {
                  const parsed = JSON.parse(valToStore);
                  if (parsed !== null && typeof parsed === 'object') {
                    valToStore = parsed;
                  }
                } catch {}
              }
              const scopedKey = row.key.startsWith(`streamzone_${userId}_`) 
                ? row.key 
                : `streamzone_${userId}_${row.key.replace(/^streamzone_/, '')}`;
              window.localStorage.setItem(scopedKey, JSON.stringify(valToStore));
              window.dispatchEvent(new CustomEvent('local-storage-sync', {
                detail: { key: scopedKey, newValue: valToStore }
              }));
            }
          }
        )
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        syncDown(currentUser.id);
        setupSyncChannel(currentUser.id);
      } else {
        if (syncChannel) supabase.removeChannel(syncChannel);
        // Clear all streamzone keys from localStorage on logout
        try {
          const keysToRemove = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith('streamzone_')) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
        } catch {}
      }
    });

    const handleFocusSync = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          syncDown(session.user.id);
        }
      });
    };

    window.addEventListener('focus', handleFocusSync);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocusSync();
    });

    return () => {
      subscription.unsubscribe();
      if (syncChannel) supabase.removeChannel(syncChannel);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, []);

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ email, password });
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith('streamzone_') || k.startsWith('az_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => window.localStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('Error clearing localStorage on logout:', e);
    }
    return supabase.auth.signOut();
  };

  const updateProfile = async ({ username, avatarUrl }) => {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        username: username,
        avatar_url: avatarUrl
      }
    });
    if (data?.user) {
      setUser(data.user);
    }
    return { data, error };
  };

  const value = {
    user,
    isAdmin: isUserAdmin(user),
    signUp,
    signIn,
    signOut,
    updateProfile,
    isAuthModalOpen,
    authModalReason,
    requireAuth,
    closeAuthModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
