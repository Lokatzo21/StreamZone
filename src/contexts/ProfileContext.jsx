import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const ProfileContext = createContext();

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

const DEFAULT_AVATARS = [
  '/avatars/1.webp',
  '/avatars/2.webp',
  '/avatars/3.webp',
  '/avatars/4.webp',
  '/avatars/5.webp',
  '/avatars/6.webp',
  '/avatars/7.webp',
  '/avatars/8.webp',
  '/avatars/9.webp',
  '/avatars/10.webp',
  '/avatars/11.webp'
];

const INITIAL_PROFILES = [
  {
    id: 'profile_1',
    name: 'Manuel',
    avatar: '/avatars/1.webp',
    isKid: false,
    color: '#ff6b00'
  },
  {
    id: 'profile_2',
    name: 'Anime Fan',
    avatar: '/avatars/5.webp',
    isKid: false,
    color: '#8b5cf6'
  },
  {
    id: 'profile_3',
    name: 'Cine & Series',
    avatar: '/avatars/9.webp',
    isKid: false,
    color: '#00e5ff'
  }
];

export const ProfileProvider = ({ children }) => {
  const [profiles, setProfiles] = useLocalStorage('streamzone_profiles_v1', INITIAL_PROFILES);
  const [activeProfileId, setActiveProfileId] = useLocalStorage('streamzone_active_profile_id', 'profile_1');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHiddenModalOpen, setIsHiddenModalOpen] = useState(false);

  // Hidden titles stored per profile in localStorage
  const [hiddenTitles, setHiddenTitles] = useLocalStorage(`streamzone_hidden_titles_${activeProfileId || 'profile_1'}`, []);

  const hideTitle = (item) => {
    if (!item || !item.id) return;
    const strId = String(item.id);
    setHiddenTitles(prev => {
      if (prev.some(t => String(t.id) === strId)) return prev;
      return [...prev, {
        id: item.id,
        title: item.title,
        image: item.image || item.backdrop || item.banner,
        type: item.type || (item.contentType === 'peliculas' ? 'Película' : (item.contentType === 'animes' ? 'Anime' : 'Serie')),
        hiddenAt: new Date().toISOString()
      }];
    });
  };

  const unhideTitle = (itemId) => {
    const strId = String(itemId);
    setHiddenTitles(prev => prev.filter(t => String(t.id) !== strId));
  };

  const isTitleHidden = (itemId) => {
    if (!itemId) return false;
    const strId = String(itemId);
    return hiddenTitles.some(t => String(t.id) === strId);
  };

  const clearAllHidden = () => {
    setHiddenTitles([]);
  };

  // Active profile object
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || INITIAL_PROFILES[0];

  const switchProfile = (profileId) => {
    setActiveProfileId(profileId);
    setIsProfileModalOpen(false);
  };

  const addProfile = ({ name, avatar, isKid = false }) => {
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: name.trim() || 'Nuevo Perfil',
      avatar: avatar || DEFAULT_AVATARS[profiles.length % DEFAULT_AVATARS.length],
      isKid: Boolean(isKid),
      color: ['#ff6b00', '#e50914', '#8b5cf6', '#00e5ff', '#10b981', '#f59e0b'][profiles.length % 6]
    };
    setProfiles(prev => [...prev, newProfile]);
    return newProfile;
  };

  const updateProfile = (profileId, updates) => {
    setProfiles(prev => prev.map(p => {
      if (p.id === profileId) {
        return { ...p, ...updates };
      }
      return p;
    }));
  };

  const deleteProfile = (profileId) => {
    if (profiles.length <= 1) return; // Keep at least one profile
    setProfiles(prev => {
      const remaining = prev.filter(p => p.id !== profileId);
      if (activeProfileId === profileId && remaining.length > 0) {
        setActiveProfileId(remaining[0].id);
      }
      return remaining;
    });
  };

  const value = {
    profiles,
    activeProfile,
    activeProfileId: activeProfile?.id,
    switchProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isHiddenModalOpen,
    setIsHiddenModalOpen,
    hiddenTitles,
    hideTitle,
    unhideTitle,
    isTitleHidden,
    clearAllHidden,
    availableAvatars: DEFAULT_AVATARS
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
