import React, { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useProfile } from './ProfileContext';
import { useAuth } from './AuthContext';

const WatchProgressContext = createContext();

export const useWatchProgress = () => {
  const context = useContext(WatchProgressContext);
  if (!context) {
    throw new Error('useWatchProgress must be used within a WatchProgressProvider');
  }
  return context;
};

export const WatchProgressProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeProfileId } = useProfile();

  const userId = user?.id || null;

  // Scoped storage keys strictly bound to authenticated user ID
  const progressKey = userId ? `streamzona_${userId}_progress_${activeProfileId || 'profile_1'}` : null;
  const myListKey = userId ? `streamzona_${userId}_mylist_${activeProfileId || 'profile_1'}` : null;
  const favoritesKey = userId ? `streamzona_${userId}_favorites_${activeProfileId || 'profile_1'}` : null;
  const customListsKey = userId ? `streamzona_${userId}_custom_lists_${activeProfileId || 'profile_1'}` : null;

  const [rawWatchHistory, setWatchHistory] = useLocalStorage(progressKey, {});
  const [rawMyList, setMyList] = useLocalStorage(myListKey, []);
  const [rawFavorites, setFavorites] = useLocalStorage(favoritesKey, []);
  const [rawCustomLists, setCustomLists] = useLocalStorage(customListsKey, []);

  // Strict isolation: unauthenticated guests always receive clean, empty state
  const watchHistory = user ? (rawWatchHistory || {}) : {};
  const myList = user ? (rawMyList || []) : [];
  const favorites = user ? (rawFavorites || []) : [];
  const customLists = user ? (rawCustomLists || []) : [];

  const createCustomList = ({ name, description = '' }) => {
    if (!user || !name || !name.trim()) return null;
    const newList = {
      id: `list_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
      items: []
    };
    setCustomLists(prev => [...(prev || []), newList]);
    return newList;
  };

  const deleteCustomList = (listId) => {
    if (!user) return;
    setCustomLists(prev => (prev || []).filter(l => l.id !== listId));
  };

  const addItemToCustomList = (listId, item) => {
    if (!user || !item || !item.id) return;
    const strId = String(item.id);
    setCustomLists(prev => (prev || []).map(l => {
      if (l.id === listId) {
        if (l.items.some(i => String(i.id) === strId)) return l;
        return { ...l, items: [item, ...(l.items || [])] };
      }
      return l;
    }));
  };

  const removeItemFromCustomList = (listId, itemId) => {
    if (!user) return;
    const strId = String(itemId);
    setCustomLists(prev => (prev || []).map(l => {
      if (l.id === listId) {
        return { ...l, items: (l.items || []).filter(i => String(i.id) !== strId) };
      }
      return l;
    }));
  };

  const isInCustomList = (listId, itemId) => {
    if (!user) return false;
    const target = customLists.find(l => l.id === listId);
    if (!target) return false;
    return (target.items || []).some(i => String(i.id) === String(itemId));
  };

  // Save playback timestamp and progress
  const saveProgress = ({
    animeId,
    animeTitle,
    episodeId,
    seasonNumber = 1,
    episodeTitle = '',
    currentTime = 0,
    duration = 0,
    image = '',
    banner = '',
    isMovie = false
  }) => {
    if (!user || !animeId || !duration || duration <= 0) return;

    const percentage = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
    const strId = String(animeId);

    setWatchHistory(prev => {
      const currentEntry = prev?.[strId] || {};
      const episodesMap = currentEntry.episodes || {};

      const updatedEpisodes = {
        ...episodesMap,
        [`s${seasonNumber}_e${episodeId}`]: {
          episodeId,
          seasonNumber,
          episodeTitle,
          currentTime,
          duration,
          percentage,
          updatedAt: Date.now(),
          completed: percentage >= 92
        }
      };

      return {
        ...(prev || {}),
        [strId]: {
          animeId: strId,
          animeTitle,
          lastEpisodeId: episodeId,
          lastSeasonNumber: seasonNumber,
          lastEpisodeTitle: episodeTitle,
          currentTime,
          duration,
          percentage,
          image,
          banner,
          isMovie,
          lastWatched: Date.now(),
          episodes: updatedEpisodes
        }
      };
    });
  };

  // Remove an entire title from watch history
  const removeProgress = (animeId) => {
    if (!user) return;
    setWatchHistory(prev => {
      const copy = { ...(prev || {}) };
      delete copy[String(animeId)];
      return copy;
    });
  };

  // Remove a specific episode from watch history (1x1 deletion)
  const removeEpisodeProgress = (animeId, seasonNumber, episodeId) => {
    if (!user) return;
    const strId = String(animeId);
    setWatchHistory(prev => {
      const currentEntry = prev?.[strId];
      if (!currentEntry) return prev;
      const copy = { ...(prev || {}) };
      const updatedEpisodes = { ...(currentEntry.episodes || {}) };
      const epKey = `s${seasonNumber}_e${episodeId}`;
      delete updatedEpisodes[epKey];

      // If no episodes remain watched for this title, remove the title completely
      if (Object.keys(updatedEpisodes).length === 0) {
        delete copy[strId];
      } else {
        copy[strId] = {
          ...currentEntry,
          episodes: updatedEpisodes
        };
      }
      return copy;
    });
  };

  // Global reset: Clear all watch history
  const clearAllHistory = () => {
    if (!user) return;
    setWatchHistory({});
  };

  // List of active "Continuar Viendo" items (strictly authenticated)
  const continueWatchingList = useMemo(() => {
    if (!user || !watchHistory) return [];
    return Object.values(watchHistory)
      .filter(item => item && item.percentage > 2 && item.percentage < 95)
      .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));
  }, [user, watchHistory]);

  // Complete List of all Watched Episodes (strictly authenticated)
  const watchedHistoryList = useMemo(() => {
    if (!user || !watchHistory) return [];
    const list = [];
    Object.values(watchHistory).forEach(entry => {
      if (!entry) return;
      if (entry.episodes && Object.keys(entry.episodes).length > 0) {
        Object.values(entry.episodes).forEach(ep => {
          list.push({
            animeId: entry.animeId,
            animeTitle: entry.animeTitle,
            image: entry.image,
            banner: entry.banner,
            isMovie: entry.isMovie,
            episodeId: ep.episodeId,
            seasonNumber: ep.seasonNumber || 1,
            episodeTitle: ep.episodeTitle || `Episodio ${ep.episodeId}`,
            percentage: ep.percentage || 0,
            completed: ep.completed || ep.percentage >= 90,
            updatedAt: ep.updatedAt || entry.lastWatched || 0
          });
        });
      } else {
        list.push({
          animeId: entry.animeId,
          animeTitle: entry.animeTitle,
          image: entry.image,
          banner: entry.banner,
          isMovie: entry.isMovie,
          episodeId: entry.lastEpisodeId || 1,
          seasonNumber: entry.lastSeasonNumber || 1,
          episodeTitle: entry.lastEpisodeTitle || `Episodio ${entry.lastEpisodeId || 1}`,
          percentage: entry.percentage || 0,
          completed: entry.percentage >= 90,
          updatedAt: entry.lastWatched || 0
        });
      }
    });
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [user, watchHistory]);

  // Check if item is in My List
  const isInMyList = (id) => {
    if (!id) return false;
    const strId = String(id);
    const list = Array.isArray(myList) ? myList : [];
    return list.some(item => String(item.id || item.anime_tmdb_id || item.tmdb_id) === strId);
  };

  // Add / Remove from My List
  const toggleMyList = (item) => {
    if (!item) return;
    const targetId = item.id || item.anime_tmdb_id || item.tmdb_id;
    if (!targetId) return;
    const strId = String(targetId);
    setMyList(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some(i => String(i.id || i.anime_tmdb_id || i.tmdb_id) === strId);
      if (exists) {
        return list.filter(i => String(i.id || i.anime_tmdb_id || i.tmdb_id) !== strId);
      } else {
        return [{ ...item, id: strId }, ...list];
      }
    });
  };

  // Check if item is Favorite
  const isFavorite = (id) => {
    if (!id) return false;
    const strId = String(id);
    const list = Array.isArray(favorites) ? favorites : [];
    return list.some(item => {
      const itemId = item.id || item.anime_tmdb_id || item.tmdb_id;
      return String(itemId) === strId;
    });
  };

  // Toggle favorite
  const toggleFavorite = (item) => {
    if (!item) return;
    const targetId = item.id || item.anime_tmdb_id || item.tmdb_id;
    if (!targetId) return;
    const strId = String(targetId);
    setFavorites(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some(i => {
        const itemId = i.id || i.anime_tmdb_id || i.tmdb_id;
        return String(itemId) === strId;
      });
      if (exists) {
        return list.filter(i => {
          const itemId = i.id || i.anime_tmdb_id || i.tmdb_id;
          return String(itemId) !== strId;
        });
      } else {
        return [{ ...item, id: strId }, ...list];
      }
    });
  };

  // Get specific progress for an episode
  const getEpisodeProgress = (animeId, seasonNumber, episodeId) => {
    if (!user) return null;
    const entry = watchHistory?.[String(animeId)];
    if (!entry) return null;
    return entry.episodes?.[`s${seasonNumber}_e${episodeId}`] || null;
  };

  const value = useMemo(() => ({
    watchHistory,
    continueWatchingList,
    watchedHistoryList,
    saveProgress,
    removeProgress,
    removeEpisodeProgress,
    clearAllHistory,
    getEpisodeProgress,
    myList,
    isInMyList,
    toggleMyList,
    favorites,
    isFavorite,
    toggleFavorite,
    customLists,
    createCustomList,
    deleteCustomList,
    addItemToCustomList,
    removeItemFromCustomList,
    isInCustomList
  }), [
    watchHistory,
    continueWatchingList,
    watchedHistoryList,
    myList,
    favorites,
    customLists
  ]);

  return (
    <WatchProgressContext.Provider value={value}>
      {children}
    </WatchProgressContext.Provider>
  );
};
