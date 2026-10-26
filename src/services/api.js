import { supabase } from './supabase';
import {
  TMDB_GENRES,
  TMDB_GENRES_REVERSE,
  isEcchiOrNSFW,
  CUSTOM_MEDIA_ENRICHMENT,
  DB_CATALOG_ITEMS,
  DB_CATALOG_LIST,
  buildOrderedCatalogList,
  dedupeCatalogList
} from './catalogData';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '372574501f2196723577821c44adb688';
const BASE_URL = 'https://api.themoviedb.org/3';

export { TMDB_GENRES, isEcchiOrNSFW };

// Request rate-limiting delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastRequestTime = 0;

const fetchWithDelay = async (url) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 80) { 
    await delay(80 - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.status}`);
  }
  return response.json();
};

// Map TMDB raw item to uniform media object
export const mapAnimeData = (item) => {
  const hasBackdrop = Boolean(item.backdrop_path);
  const backdropUrl = hasBackdrop 
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
    : null;
  const posterUrl = item.poster_path 
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
    : 'https://via.placeholder.com/225x318?text=No+Image';

  const isMovie = item.media_type === 'movie' || Boolean(item.title && !item.name);
  const isJapanese = item.original_language === 'ja' || (Array.isArray(item.origin_country) && item.origin_country.includes('JP'));

  // Detect Asian animation (donghua, anime, Super Cubo, etc.)
  const titleStr = `${item.title || ''} ${item.name || ''} ${item.original_name || ''} ${item.original_title || ''}`.toLowerCase();
  const isAnimation = Array.isArray(item.genres)
    ? item.genres.some(g => (typeof g === 'object' ? g.id === 16 || g.name === 'Animación' : g === 16 || g === 'Animación'))
    : (Array.isArray(item.genre_ids) && item.genre_ids.includes(16));
  const isAsianAnimation = (isJapanese || item.original_language === 'zh' || item.original_language === 'ko' ||
    (Array.isArray(item.origin_country) && (item.origin_country.includes('CN') || item.origin_country.includes('KR')))) && isAnimation;
  const isAnimeTitle = /super cubo|super cube|berserk|mysteries|donghua|anime/i.test(titleStr);
  const isAnime = !isMovie && (isJapanese || isAsianAnimation || isAnimeTitle);

  let contentType = 'series';
  if (isMovie) contentType = 'peliculas';
  else if (isAnime) contentType = 'animes';

  const releaseYear = (item.release_date || item.first_air_date || '').split('-')[0] || '';
  const runtime = item.runtime || (Array.isArray(item.episode_run_time) && item.episode_run_time.length > 0 ? item.episode_run_time[0] : null);
  
  const cast = (item.credits?.cast || item.cast || []).slice(0, 15).map(c => ({
    id: c.id,
    name: c.name,
    character: c.character || 'Personaje',
    avatar: c.profile_path ? (c.profile_path.startsWith('http') ? c.profile_path : `https://image.tmdb.org/t/p/w185${c.profile_path}`) : (c.avatar || null)
  }));

  return {
    id: item.id,
    title: item.title || item.name || item.original_name || item.original_title,
    image: posterUrl,
    banner: backdropUrl || posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1920&q=95',
    backdrop: backdropUrl,
    hasBackdrop,
    score: item.vote_average ? (item.vote_average).toFixed(1) : '8.0',
    totalEpisodes: isMovie ? 1 : (item.number_of_episodes || null), 
    episodes: isMovie ? 1 : (item.number_of_episodes || null),
    number_of_seasons: isMovie ? 1 : (item.number_of_seasons || 1),
    type: isMovie ? 'Película' : (isAnime ? 'Anime' : 'Serie'),
    contentType,
    isMovie,
    releaseYear,
    runtime,
    cast,
    description: item.overview || 'Sin sinopsis disponible.',
    genres: item.genres 
      ? item.genres.map(g => (typeof g === 'object' ? g.name : g)) 
      : (item.genre_ids ? item.genre_ids.map(id => TMDB_GENRES_REVERSE[id]).filter(Boolean) : []),
    status: item.status === 'Ended' ? 'Finalizado' : item.status === 'Returning Series' ? 'En emisión' : (isMovie ? 'Finalizado' : item.status || 'En emisión'),
    trailer: item.videos?.results?.length > 0 ? `https://www.youtube.com/embed/${item.videos.results[0].key}` : null,
    isCustom: false,
    isSecret: false
  };
};

// Map custom database items (custom_animes) with strict image priority
export const mapCustomAnime = (item) => {
  const isSingleMovie = Number(item.total_episodes) === 1;
  const isSagaCollection = /colecci[oó]n|saga/i.test(item.title);
  const isMovieOrSaga = isSingleMovie || isSagaCollection || 
    /pel[ií]cula|harry potter|piratas del caribe|arma mortal|animales fant[aá]sticos|deadpool/i.test(item.title);
  const isAnime = /berserk|mysteries|cube|anime/i.test(item.title) || 
    (Array.isArray(item.genres) && item.genres.includes('Animación') && !isMovieOrSaga);
  const isSeries = !isMovieOrSaga && !isAnime;

  const titleKey = (item.title || '').trim().toLowerCase();
  const enrichment = CUSTOM_MEDIA_ENRICHMENT[titleKey] || 
    Object.entries(CUSTOM_MEDIA_ENRICHMENT).find(([k]) => titleKey.includes(k))?.[1] || {};

  // CRITICAL: Database-persisted image always takes absolute priority
  const posterImage = (item.image && typeof item.image === 'string' && item.image.trim().length > 0 && !item.image.includes('placeholder.com')) 
    ? item.image.trim() 
    : (enrichment.image || item.image || 'https://via.placeholder.com/225x318?text=No+Image');

  const backdropUrl = (item.banner && typeof item.banner === 'string' && item.banner.trim().length > 0)
    ? item.banner.trim()
    : (enrichment.backdrop || null);
  const hasBackdrop = Boolean(backdropUrl);

  return {
    id: item.id,
    title: item.title,
    image: posterImage,
    banner: backdropUrl || posterImage || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1920&q=95',
    backdrop: backdropUrl,
    hasBackdrop,
    score: item.score || '8.5',
    totalEpisodes: isSingleMovie ? 1 : (item.total_episodes || null),
    total_episodes: isSingleMovie ? 1 : (item.total_episodes || 12),
    episodes: isSingleMovie ? 1 : (item.total_episodes || null),
    type: isMovieOrSaga ? 'Película' : (isSeries ? 'Serie' : 'Anime'),
    contentType: isMovieOrSaga ? 'peliculas' : (isSeries ? 'series' : 'animes'),
    isMovie: isSingleMovie,
    isCollection: isSagaCollection,
    description: item.description || 'Sin sinopsis disponible.',
    genres: item.genres || [],
    cast: item.cast || [],
    runtime: item.runtime || null,
    releaseYear: item.releaseYear || item.release_year || '',
    status: item.status || 'En emisión',
    trailer: null,
    isCustom: !String(item.id || '').trim() || String(item.id || '').startsWith('custom-'),
    is_secret: item.is_secret || false,
    episode_names: item.episode_names || {}
  };
};

// Smart media classifier: disambiguates between Movie, Western Series and Anime
export const resolveMediaClassification = (row, movData, tvData) => {
  const sTitleNorm = (row.search_title || '').toLowerCase().trim();
  const hasMultipleEps = Number(row.total_episodes) > 1 || Number(row.max_season) > 1;

  if (!movData && !tvData) return null;
  if (movData && !tvData) return { data: movData, isMovie: true };
  if (!movData && tvData) return { data: tvData, isMovie: false };

  const movTitle = (movData.title || movData.original_title || '').toLowerCase().trim();
  const tvTitle = (tvData.name || tvData.original_name || '').toLowerCase().trim();

  const movMatch = movTitle && (sTitleNorm.includes(movTitle) || movTitle.includes(sTitleNorm));
  const tvMatch = tvTitle && (sTitleNorm.includes(tvTitle) || tvTitle.includes(sTitleNorm));

  const movVotes = Number(movData.vote_count || 0);
  const tvVotes = Number(tvData.vote_count || 0);

  // 1. Official movie collection
  if (movData.belongs_to_collection && movVotes > 500) {
    return { data: movData, isMovie: true };
  }

  // 2. Exact movie title match
  if (movMatch && !tvMatch) {
    return { data: movData, isMovie: true };
  }

  // 3. Exact TV title match
  if (tvMatch && !movMatch) {
    return { data: tvData, isMovie: false };
  }

  // 4. Overwhelming vote count disparity
  if (movVotes > 1000 && tvVotes < 100) {
    return { data: movData, isMovie: true };
  }
  if (tvVotes > 1000 && movVotes < 100) {
    return { data: tvData, isMovie: false };
  }

  // 5. Multiple episodes & legitimate seasons
  if (hasMultipleEps && tvVotes > 50 && Number(tvData.number_of_seasons || 1) >= 1 && !movData.belongs_to_collection) {
    return { data: tvData, isMovie: false };
  }

  // 6. Default by popularity / votes
  const isMov = movVotes >= tvVotes;
  return { data: isMov ? movData : tvData, isMovie: isMov };
};

const mapDynamicTmdbItem = (tmdbData, isMovie, row) => {
  const movieGenreLookup = {
    16: 'Animación',
    28: 'Action & Adventure',
    12: 'Action & Adventure',
    878: 'Sci-Fi & Fantasy',
    14: 'Sci-Fi & Fantasy',
    35: 'Comedia',
    18: 'Drama',
    9648: 'Misterio',
    10759: 'Action & Adventure',
    10765: 'Sci-Fi & Fantasy'
  };

  const isAnime = !isMovie && (tmdbData.original_language === 'ja' || (Array.isArray(tmdbData.origin_country) && tmdbData.origin_country.includes('JP')));
  const mappedGenres = new Set();
  if (Array.isArray(tmdbData.genres)) {
    tmdbData.genres.forEach(g => {
      if (movieGenreLookup[g.id]) mappedGenres.add(movieGenreLookup[g.id]);
      if (TMDB_GENRES[g.name]) mappedGenres.add(g.name);
    });
  }
  if (Array.isArray(tmdbData.genre_ids)) {
    tmdbData.genre_ids.forEach(gid => {
      if (movieGenreLookup[gid]) mappedGenres.add(movieGenreLookup[gid]);
    });
  }
  if (mappedGenres.size === 0) {
    mappedGenres.add(isAnime ? 'Animación' : 'Drama');
  }

  const poster = tmdbData.poster_path
    ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
    : 'https://via.placeholder.com/225x318?text=No+Image';
  const backdrop = tmdbData.backdrop_path
    ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`
    : poster;
  const totalEps = isMovie ? 1 : Math.max(Number(row.total_episodes || 1), 1);
  const maxSeason = isMovie ? 1 : Math.max(Number(row.max_season || tmdbData.number_of_seasons || 1), 1);

  return {
    id: Number(tmdbData.id),
    title: tmdbData.title || tmdbData.name || row.search_title,
    searchTitle: row.search_title || '',
    image: poster,
    banner: backdrop,
    backdrop: backdrop,
    hasBackdrop: Boolean(tmdbData.backdrop_path),
    score: tmdbData.vote_average ? Number(tmdbData.vote_average).toFixed(1) : '8.0',
    totalEpisodes: totalEps,
    episodes: totalEps,
    number_of_seasons: maxSeason,
    type: isMovie ? 'Película' : (isAnime ? 'TV' : 'Serie'),
    contentType: isMovie ? 'peliculas' : (isAnime ? 'animes' : 'series'),
    isMovie,
    description: tmdbData.overview || 'Sin sinopsis disponible.',
    genres: Array.from(mappedGenres),
    status: isMovie ? 'Finalizado' : (tmdbData.status === 'Ended' ? 'Finalizado' : 'En emisión'),
    isCustom: false,
    isSecret: false
  };
};

let lastDynamicSyncTime = 0;
let dynamicSyncPromise = null;
const AUTO_CATALOG_STORAGE_KEY = 'az_dynamic_media_cache_v2';

// Hydrate cached items from localStorage if available (instant 0ms on TV browsers)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cachedJson = localStorage.getItem(AUTO_CATALOG_STORAGE_KEY);
    if (cachedJson) {
      const cachedItems = JSON.parse(cachedJson);
      if (typeof cachedItems === 'object' && cachedItems !== null) {
        let hasBad = false;
        for (const [k, item] of Object.entries(cachedItems)) {
          // Purge items with placeholder or missing images
          if (!item?.image || item.image.includes('placeholder') || item.image.includes('No Image')) {
            delete cachedItems[k];
            hasBad = true;
            continue;
          }
          if (!DB_CATALOG_ITEMS[k] && item && item.id) {
            DB_CATALOG_ITEMS[k] = item;
            DB_CATALOG_LIST.unshift(item);
          }
        }
        if (hasBad) {
          localStorage.setItem(AUTO_CATALOG_STORAGE_KEY, JSON.stringify(cachedItems));
        }
      }
    }
  }
} catch (e) {
  // Ignore localStorage read errors in restricted contexts
}

const fetchWithTimeout = async (url, ms = 8000) => {
  if (typeof AbortController === 'undefined') {
    return fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response.ok ? response.json() : null;
  } catch {
    clearTimeout(id);
    return null;
  }
};

// Real-time auto-discovery of newly added movies, series, or anime in anime_episodes
const syncDynamicEpisodesCatalog = async (customAnimes = []) => {
  const now = Date.now();
  if (dynamicSyncPromise) return dynamicSyncPromise;
  if (now - lastDynamicSyncTime < 5000) return;

  dynamicSyncPromise = (async () => {
    try {
      let summaryRows = [];
      const { data: viewData, error: viewErr } = await supabase
        .from('catalog_episodes_summary')
        .select('*')
        .order('max_id', { ascending: false });

      if (!viewErr && Array.isArray(viewData) && viewData.length > 0) {
        summaryRows = viewData;
      } else {
        const { data: rawEps } = await supabase
          .from('anime_episodes')
          .select('id, anime_tmdb_id, search_title, episode_name, episode_number, season_number')
          .order('id', { ascending: false })
          .limit(500);
        if (Array.isArray(rawEps)) {
          const mapByGroup = new Map();
          for (const ep of rawEps) {
            const tmdbId = ep.anime_tmdb_id ? String(ep.anime_tmdb_id).trim() : '';
            const sTitle = (ep.search_title || '').trim();
            if (!sTitle) continue;
            const gKey = tmdbId || sTitle.toLowerCase();
            if (!mapByGroup.has(gKey)) {
              mapByGroup.set(gKey, {
                anime_tmdb_id: tmdbId || null,
                search_title: sTitle,
                sample_episode_name: ep.episode_name || sTitle,
                epsSet: new Set([Number(ep.episode_number || 1)]),
                max_season: Number(ep.season_number || 1),
                max_id: Number(ep.id || 0)
              });
            } else {
              const g = mapByGroup.get(gKey);
              g.epsSet.add(Number(ep.episode_number || 1));
              if (Number(ep.season_number || 1) > g.max_season) g.max_season = Number(ep.season_number || 1);
            }
          }
          summaryRows = Array.from(mapByGroup.values()).map(g => ({
            anime_tmdb_id: g.anime_tmdb_id,
            search_title: g.search_title,
            sample_episode_name: g.sample_episode_name,
            total_episodes: g.epsSet.size,
            max_season: g.max_season,
            max_id: g.max_id
          }));
        }
      }

      const customIds = new Set(customAnimes.map(c => String(c.id).trim()));
      const customTitles = new Set(customAnimes.map(c => (c.title || '').toLowerCase().trim()));
      const existingTitles = new Set(
        Object.values(DB_CATALOG_ITEMS).flatMap(it => [
          (it.title || '').toLowerCase().trim(),
          (it.searchTitle || '').toLowerCase().trim()
        ]).filter(Boolean)
      );

      // Separate rows: update existing counts vs resolve truly new items
      const toResolve = [];
      for (const row of summaryRows) {
        const idStr = row.anime_tmdb_id ? String(row.anime_tmdb_id).trim() : '';
        const sTitleNorm = (row.search_title || '').toLowerCase().trim();
        if (!sTitleNorm) continue;

        if (idStr && DB_CATALOG_ITEMS[idStr]) {
          const item = DB_CATALOG_ITEMS[idStr];
          const hasValidImage = item.image && !item.image.includes('placeholder') && !item.image.includes('No Image');
          if (hasValidImage) {
            if (!item.searchTitle && row.search_title) item.searchTitle = row.search_title;
            if (!item.isMovie && item.contentType !== 'peliculas') {
              if (Number(row.total_episodes) > Number(item.totalEpisodes || 0)) {
                item.totalEpisodes = Number(row.total_episodes);
                item.episodes = Number(row.total_episodes);
              }
              if (Number(row.max_season) > Number(item.number_of_seasons || 1)) {
                item.number_of_seasons = Number(row.max_season);
              }
            }
            continue;
          }
        }

        if (idStr && idStr.startsWith('custom-') && customIds.has(idStr)) {
          continue;
        }

        if (!idStr && (customTitles.has(sTitleNorm) || existingTitles.has(sTitleNorm))) {
          continue;
        }

        toResolve.push(row);
      }

      // Process truly new items in small concurrent batches (e.g. 4) with timeout to keep Roku/Samsung snappy
      const newlyDiscovered = {};
      const BATCH_SIZE = 4;
      for (let i = 0; i < toResolve.length; i += BATCH_SIZE) {
        const batch = toResolve.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (row) => {
          const idStr = row.anime_tmdb_id ? String(row.anime_tmdb_id).trim() : '';
          try {
            const hasMultipleEps = Number(row.total_episodes) > 1 || Number(row.max_season) > 1;
            let resolvedItem = null;

            if (idStr && /^\d+$/.test(idStr)) {
              const [tvData, movData] = await Promise.all([
                fetchWithTimeout(`${BASE_URL}/tv/${idStr}?api_key=${TMDB_API_KEY}&language=es-MX`),
                fetchWithTimeout(`${BASE_URL}/movie/${idStr}?api_key=${TMDB_API_KEY}&language=es-MX`)
              ]);

              const resolved = resolveMediaClassification(row, movData, tvData);
              if (resolved) {
                resolvedItem = mapDynamicTmdbItem(resolved.data, resolved.isMovie, row);
              }
            } else {
              const endpoint = hasMultipleEps ? 'tv' : 'multi';
              const searchRes = await fetchWithTimeout(`${BASE_URL}/search/${endpoint}?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(row.search_title)}&include_adult=false`);
              const firstHit = (searchRes?.results || []).find(r => r.media_type !== 'person');
              if (firstHit && firstHit.id) {
                const isMov = !hasMultipleEps && (firstHit.media_type === 'movie' || Boolean(firstHit.title && !firstHit.name));
                resolvedItem = mapDynamicTmdbItem(firstHit, isMov, row);
              }
            }

            if (resolvedItem) {
              const key = String(resolvedItem.id);
              DB_CATALOG_ITEMS[key] = resolvedItem;
              DB_CATALOG_LIST.unshift(resolvedItem);
              newlyDiscovered[key] = resolvedItem;
            }
          } catch (e) {
            console.warn('Auto-discovery error for row:', row.search_title, e);
          }
        }));
      }

      // Persist newly discovered items into localStorage
      if (Object.keys(newlyDiscovered).length > 0 && typeof window !== 'undefined' && window.localStorage) {
        try {
          const prevCache = JSON.parse(localStorage.getItem(AUTO_CATALOG_STORAGE_KEY) || '{}');
          const merged = { ...prevCache, ...newlyDiscovered };
          localStorage.setItem(AUTO_CATALOG_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // Ignore quota errors
        }
      }
    } catch (err) {
      console.warn('Dynamic episodes sync error:', err);
    } finally {
      lastDynamicSyncTime = Date.now();
      dynamicSyncPromise = null;
    }
  })();

  return dynamicSyncPromise;
};

export const api = {
  // Custom Animes from Supabase
  getCustomAnimes: async (includeSecret = false) => {
    try {
      let query = supabase.from('custom_animes').select('*').order('created_at', { ascending: false });
      if (!includeSecret) {
        query = query.eq('is_secret', false);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching custom animes:', error);
        return [];
      }
      return data ? data.map(mapCustomAnime) : [];
    } catch (e) {
      console.error('Failed to get custom animes:', e);
      return [];
    }
  },

  // Complete Catalog
  getCatalogAnimes: async (includeSecret = false) => {
    const customAnimes = await api.getCustomAnimes(includeSecret);
    await syncDynamicEpisodesCatalog(customAnimes);
    return dedupeCatalogList([...DB_CATALOG_LIST, ...customAnimes]);
  },

  // Instant Sync Data for Home (0ms initial render, zero layout shift)
  getInstantHomeData: () => {
    const anime = DB_CATALOG_LIST.filter(a => a.contentType === 'animes' || (!a.isMovie && a.genres?.includes('Animación') && a.contentType !== 'series'));
    const movies = DB_CATALOG_LIST.filter(a => a.contentType === 'peliculas' || a.isMovie);
    const series = DB_CATALOG_LIST.filter(a => a.contentType === 'series' && !/cubo|cube/i.test(a.title || ''));

    // Top 10: Interleave blockbuster movies and acclaimed series first
    const topPicks = [];
    const maxTop = Math.max(movies.length, series.length);
    for (let i = 0; i < maxTop; i++) {
      if (movies[i]) topPicks.push(movies[i]);
      if (series[i]) topPicks.push(series[i]);
    }
    const top10 = dedupeCatalogList([...topPicks, ...movies, ...series]).slice(0, 10);

    const heroPicks = [
      ...(movies.slice(0, 2)),
      ...(series.slice(0, 2)),
      ...(anime.slice(0, 2))
    ].filter(Boolean);

    // Recién agregados instantáneo: mezcla simétrica de películas, series y anime
    const recentMixed = [];
    const maxRec = Math.max(movies.length, series.length, anime.length);
    for (let i = 0; i < maxRec; i++) {
      if (movies[i]) recentMixed.push(movies[i]);
      if (series[i]) recentMixed.push(series[i]);
      if (anime[i]) recentMixed.push(anime[i]);
    }

    return {
      featuredItems: heroPicks.length > 0 ? heroPicks : DB_CATALOG_LIST.slice(0, 5),
      top10Items: top10,
      topAnime: top10,
      trendingMovies: movies.slice(0, 18),
      trendingSeries: series.slice(0, 18),
      trendingAnime: anime.slice(0, 18),
      recentAnime: recentMixed.slice(0, 18),
      recentlyAdded: recentMixed.slice(0, 18)
    };
  },

  // Top 10 Most Popular Mixed (Movies + Western Series + Top Hits)
  getTop10Mixed: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const movies = allCatalog.filter(a => a.contentType === 'peliculas' || a.isMovie);
      const series = allCatalog.filter(a => a.contentType === 'series' && !/cubo|cube/i.test(a.title || ''));

      const topPicks = [];
      const maxLen = Math.max(movies.length, series.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) topPicks.push(movies[i]);
        if (series[i]) topPicks.push(series[i]);
      }
      return dedupeCatalogList([...topPicks, ...movies, ...series]).slice(0, 10);
    } catch (error) {
      console.error('Error fetching top 10 mixed:', error);
      return [];
    }
  },

  // Trending Anime (Home)
  getTrendingAnime: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const catalogAnimes = allCatalog.filter(a => a.contentType === 'animes' || (!a.isMovie && a.genres?.includes('Animación') && a.contentType !== 'series'));
      const url1 = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=popularity.desc&page=1&include_adult=false`;
      const url2 = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=popularity.desc&page=2&include_adult=false`;
      const [res1, res2] = await Promise.all([
        fetchWithDelay(url1).catch(() => ({ results: [] })),
        fetchWithDelay(url2).catch(() => ({ results: [] }))
      ]);
      const combined = [...(res1?.results || []), ...(res2?.results || [])]
        .filter(r => Boolean(r && r.poster_path))
        .map(mapAnimeData);
      return dedupeCatalogList([...catalogAnimes, ...combined]);
    } catch (error) {
      console.error('Error fetching trending anime:', error);
      return [];
    }
  },

  // Top Rated Anime
  getTopAnime: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const catalogAnimes = allCatalog.filter(a => a.contentType === 'animes' || (!a.isMovie && a.genres?.includes('Animación') && a.contentType !== 'series'));
      const url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=500&page=1&include_adult=false`;
      const data = await fetchWithDelay(url).catch(() => ({ results: [] }));
      const mapped = (data?.results || [])
        .filter(r => Boolean(r && r.poster_path))
        .map(mapAnimeData);
      return dedupeCatalogList([...catalogAnimes.slice(0, 10), ...mapped]);
    } catch (error) {
      console.error('Error fetching top anime:', error);
      return [];
    }
  },

  // Trending Series (Home)
  getTrendingSeries: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const catalogSeries = allCatalog.filter(a => a.contentType === 'series' && !/cubo|cube/i.test(a.title || ''));
      const url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&without_original_language=ja&sort_by=popularity.desc&page=1&include_adult=false`;
      const data = await fetchWithDelay(url).catch(() => ({ results: [] }));
      const mapped = (data?.results || [])
        .filter(r => Boolean(r && r.poster_path))
        .map(mapAnimeData);
      return dedupeCatalogList([...catalogSeries, ...mapped]);
    } catch (error) {
      console.error('Error fetching trending series:', error);
      return [];
    }
  },

  // Trending Movies and Sagas (Home)
  getTrendingMovies: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const catalogMovies = allCatalog.filter(a => a.contentType === 'peliculas' || a.isMovie);
      const url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=es-MX&sort_by=popularity.desc&page=1&include_adult=false`;
      const data = await fetchWithDelay(url).catch(() => ({ results: [] }));
      const mapped = (data?.results || [])
        .filter(r => Boolean(r && r.poster_path))
        .map(item => mapAnimeData({ ...item, media_type: 'movie' }));
      return dedupeCatalogList([...catalogMovies, ...mapped]);
    } catch (error) {
      console.error('Error fetching trending movies:', error);
      return [];
    }
  },

  // Recent Releases (Anime legacy method)
  getRecentAnime: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);
      const catalogAnimes = allCatalog.filter(a => a.contentType === 'animes');
      const url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=first_air_date.desc&page=1&include_adult=false`;
      const data = await fetchWithDelay(url).catch(() => ({ results: [] }));
      const mapped = (data?.results || [])
        .filter(r => Boolean(r && r.poster_path))
        .map(mapAnimeData);
      return dedupeCatalogList([...catalogAnimes, ...mapped]);
      return dedupeCatalogList([...catalogAnimes, ...(data.results || []).map(mapAnimeData)]);
    } catch (error) {
      console.error('Error fetching recent anime:', error);
      return [];
    }
  },

  // Recién Agregados: Real mix of newly added movies, series, and animes directly from DB additions
  getRecentlyAddedAll: async () => {
    try {
      const allCatalog = await api.getCatalogAnimes(false);

      // 1. Fetch latest additions directly from Supabase anime_episodes
      const { data: recentEps } = await supabase
        .from('anime_episodes')
        .select('id, anime_tmdb_id, search_title, created_at')
        .order('id', { ascending: false })
        .limit(50);

      const recentSupabaseItems = [];
      const seenIds = new Set();

      if (Array.isArray(recentEps)) {
        for (const ep of recentEps) {
          const tmdbId = ep.anime_tmdb_id ? String(ep.anime_tmdb_id).trim() : '';
          const sTitle = (ep.search_title || '').trim().toLowerCase();

          let matched = null;
          if (tmdbId && DB_CATALOG_ITEMS[tmdbId]) {
            matched = DB_CATALOG_ITEMS[tmdbId];
          } else if (tmdbId) {
            matched = allCatalog.find(c => String(c.id).trim() === tmdbId);
          }
          if (!matched && sTitle) {
            matched = allCatalog.find(c =>
              (c.title || '').trim().toLowerCase() === sTitle ||
              (c.searchTitle || '').trim().toLowerCase() === sTitle
            );
          }

          if (matched && !seenIds.has(String(matched.id))) {
            seenIds.add(String(matched.id));
            recentSupabaseItems.push(matched);
          }
        }
      }

      // 2. Custom titles from DB (custom_animes)
      const customAdded = allCatalog.filter(a => String(a.id).startsWith('custom-') && !seenIds.has(String(a.id)));
      customAdded.forEach(c => seenIds.add(String(c.id)));

      // 3. Absolute top priority: User's real database additions (newest episodes/movies + custom items)
      const topDbRecent = [...recentSupabaseItems, ...customAdded];

      // 4. Also fetch latest releases from TMDB in parallel for filler
      const [recentMoviesData, recentSeriesData, recentAnimeData] = await Promise.all([
        fetchWithDelay(`${BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=es-MX&page=1`).catch(() => ({ results: [] })),
        fetchWithDelay(`${BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&language=es-MX&page=1`).catch(() => ({ results: [] })),
        fetchWithDelay(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=first_air_date.desc&page=1`).catch(() => ({ results: [] }))
      ]);

      const tmdbMovies = (recentMoviesData?.results || []).filter(m => Boolean(m && m.poster_path)).map(m => mapAnimeData({ ...m, media_type: 'movie' }));
      const tmdbSeries = (recentSeriesData?.results || []).filter(s => Boolean(s && s.poster_path)).map(mapAnimeData);
      const tmdbAnime = (recentAnimeData?.results || []).filter(a => Boolean(a && a.poster_path)).map(mapAnimeData);

      const movies = allCatalog.filter(a => (a.contentType === 'peliculas' || a.isMovie) && !seenIds.has(String(a.id)));
      const series = allCatalog.filter(a => a.contentType === 'series' && !seenIds.has(String(a.id)));
      const anime = allCatalog.filter(a => a.contentType === 'animes' && !seenIds.has(String(a.id)));

      const allRecentMovies = dedupeCatalogList([...movies, ...tmdbMovies]);
      const allRecentSeries = dedupeCatalogList([...series, ...tmdbSeries]);
      const allRecentAnime = dedupeCatalogList([...anime, ...tmdbAnime]);

      const interleaved = [];
      const maxLen = Math.max(allRecentMovies.length, allRecentSeries.length, allRecentAnime.length);
      for (let i = 0; i < maxLen; i++) {
        if (allRecentMovies[i]) interleaved.push(allRecentMovies[i]);
        if (allRecentSeries[i]) interleaved.push(allRecentSeries[i]);
        if (allRecentAnime[i]) interleaved.push(allRecentAnime[i]);
      }

      return dedupeCatalogList([...topDbRecent, ...interleaved]).slice(0, 30);
    } catch (error) {
      console.error('Error fetching recently added content:', error);
      return [];
    }
  },

  // Catalog Discovery with Category and Genre filters
  getDiscoverAnime: async (page = 1, genreName = 'Todos', typeFilter = 'todos') => {
    try {
      let customAnimes = [];
      if (page === 1) {
        customAnimes = await api.getCatalogAnimes(false);
        if (typeFilter && typeFilter !== 'todos') {
          customAnimes = customAnimes.filter(ca => ca.contentType === typeFilter);
        }
        if (genreName !== 'Todos') {
          customAnimes = customAnimes.filter(ca => ca.genres && ca.genres.includes(genreName));
        }
      }

      let url = '';
      if (typeFilter === 'peliculas') {
        const movieGenreId = {
          'Animación': 16,
          'Action & Adventure': 28,
          'Sci-Fi & Fantasy': 878,
          'Comedia': 35,
          'Drama': 18,
          'Misterio': 9648
        }[genreName];
        
        url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=es-MX&sort_by=popularity.desc&page=${page}&include_adult=false`;
        if (genreName !== 'Todos' && movieGenreId) {
          url += `&with_genres=${movieGenreId}`;
        }
      } else if (typeFilter === 'series') {
        url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&without_original_language=ja&sort_by=popularity.desc&page=${page}&include_adult=false`;
        if (genreName !== 'Todos' && TMDB_GENRES[genreName]) {
          url += `&with_genres=${TMDB_GENRES[genreName]}`;
        }
      } else if (typeFilter === 'animes') {
        url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=popularity.desc&page=${page}&include_adult=false`;
        if (genreName !== 'Todos' && TMDB_GENRES[genreName]) {
          url += `&with_genres=${TMDB_GENRES[genreName]}`;
        }
      } else {
        url = `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=es-MX&with_original_language=ja&sort_by=popularity.desc&page=${page}&include_adult=false`;
        if (genreName !== 'Todos' && TMDB_GENRES[genreName]) {
          url += `&with_genres=${TMDB_GENRES[genreName]}`;
        }
      }

      const data = await fetchWithDelay(url).catch(() => ({ results: [] }));
      const mapped = (data.results || []).filter(r => Boolean(r && r.poster_path)).map(mapAnimeData);
      return dedupeCatalogList([...customAnimes, ...mapped]);
    } catch (error) {
      console.error('Error fetching discover anime:', error);
      return [];
    }
  },

  // Media Details by ID
  getAnimeInfo: async (id, preferredType = null) => {
    try {
      if (!id) return null;
      const strId = String(id).trim();

      if (DB_CATALOG_ITEMS[strId]) {
        const item = { ...DB_CATALOG_ITEMS[strId] };
        if (!item.cast || item.cast.length === 0) {
          try {
            const endpoint = (item.isMovie || item.contentType === 'peliculas') ? 'movie' : 'tv';
            const tmdbExtra = await fetchWithDelay(`${BASE_URL}/${endpoint}/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=credits,videos,recommendations`).catch(() => null);
            if (tmdbExtra?.credits?.cast) {
              item.cast = tmdbExtra.credits.cast.slice(0, 15).map(c => ({
                id: c.id,
                name: c.name,
                character: c.character || 'Personaje',
                avatar: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
              }));
              DB_CATALOG_ITEMS[strId].cast = item.cast;
            }
          } catch {}
        }
        return item;
      }

      // Check custom_animes table
      try {
        const { data: customData } = await supabase.from('custom_animes').select('*').eq('id', strId).maybeSingle();
        if (customData) {
          const mapped = mapCustomAnime(customData);
          if (/^\d+$/.test(strId)) {
            try {
              const endpoint = mapped.isMovie ? 'movie' : 'tv';
              const tmdbExtra = await fetchWithDelay(`${BASE_URL}/${endpoint}/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`).catch(() => null);
              if (tmdbExtra && tmdbExtra.id) {
                if (!mapped.hasBackdrop && tmdbExtra.backdrop_path) {
                  mapped.backdrop = `https://image.tmdb.org/t/p/original${tmdbExtra.backdrop_path}`;
                  mapped.banner = mapped.backdrop;
                  mapped.hasBackdrop = true;
                }
                if ((!mapped.score || mapped.score === 'N/A') && tmdbExtra.vote_average) {
                  mapped.score = Number(tmdbExtra.vote_average).toFixed(1);
                }
                if (!mapped.trailer && tmdbExtra.videos?.results?.length > 0) {
                  mapped.trailer = `https://www.youtube.com/embed/${tmdbExtra.videos.results[0].key}`;
                }
                if (tmdbExtra.credits?.cast) {
                  mapped.cast = tmdbExtra.credits.cast.slice(0, 15).map(c => ({
                    id: c.id,
                    name: c.name,
                    character: c.character || 'Personaje',
                    avatar: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                  }));
                }
                if (tmdbExtra.runtime) {
                  mapped.runtime = tmdbExtra.runtime;
                }
                if (tmdbExtra.release_date || tmdbExtra.first_air_date) {
                  mapped.releaseYear = (tmdbExtra.release_date || tmdbExtra.first_air_date).split('-')[0];
                }
              }
            } catch {}
          } else {
            // For custom- IDs (e.g. custom-1790138009692: "Piratas del Caribe")
            try {
              const cleanTitle = (mapped.title || '')
                .replace(/colecci[oó]n|saga|completa|temporada \d+|latino|castellano/gi, '')
                .trim();
              if (cleanTitle) {
                const searchType = (mapped.isMovie || mapped.contentType === 'peliculas') ? 'movie' : 'multi';
                const searchRes = await fetchWithDelay(`${BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(cleanTitle)}&include_adult=false`).catch(() => null);
                const bestHit = searchRes?.results?.[0];
                if (bestHit?.id) {
                  const hitType = bestHit.media_type || (searchType === 'movie' ? 'movie' : 'tv');
                  const tmdbExtra = await fetchWithDelay(`${BASE_URL}/${hitType}/${bestHit.id}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=credits,videos`).catch(() => null);
                  if (tmdbExtra?.credits?.cast) {
                    mapped.cast = tmdbExtra.credits.cast.slice(0, 15).map(c => ({
                      id: c.id,
                      name: c.name,
                      character: c.character || 'Personaje',
                      avatar: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                    }));
                  }
                  if (!mapped.runtime && tmdbExtra?.runtime) {
                    mapped.runtime = tmdbExtra.runtime;
                  }
                  if (!mapped.releaseYear && (tmdbExtra?.release_date || tmdbExtra?.first_air_date)) {
                    mapped.releaseYear = (tmdbExtra.release_date || tmdbExtra.first_air_date).split('-')[0];
                  }
                }
              }
            } catch {}
          }
          return mapped;
        }
      } catch {}

      if (strId.startsWith('custom-')) {
        return null;
      }

      // Check if registered in anime_episodes
      try {
        const { data: dbRows } = await supabase
          .from('anime_episodes')
          .select('anime_tmdb_id, search_title, episode_name, episode_number')
          .eq('anime_tmdb_id', strId)
          .limit(1);

        if (dbRows && dbRows.length > 0) {
          const row = dbRows[0];
          const [tvData, movieData] = await Promise.all([
            fetchWithDelay(`${BASE_URL}/tv/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`).catch(() => null),
            fetchWithDelay(`${BASE_URL}/movie/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`).catch(() => null)
          ]);

          const resolved = resolveMediaClassification({
            search_title: row.search_title || '',
            total_episodes: 1,
            max_season: 1
          }, movieData, tvData);

          if (resolved) {
            const mapped = mapAnimeData({ ...resolved.data, media_type: resolved.isMovie ? 'movie' : 'tv' });
            if (resolved.isMovie) {
              mapped.saga_collection_title = row.search_title;
              mapped.saga_episode_name = row.episode_name;
              mapped.saga_episode_number = row.episode_number;
            }
            return mapped;
          }
        }
      } catch (err) {}

      // Preferred type fallback
      const wantsMovie = preferredType === 'movie' || preferredType === 'Película' || preferredType === 'peliculas';
      if (wantsMovie) {
        try {
          const movieData = await fetchWithDelay(`${BASE_URL}/movie/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`);
          if (movieData && (movieData.title || movieData.original_title)) {
            return mapAnimeData({ ...movieData, media_type: 'movie' });
          }
        } catch {}
      }

      // General fallback
      let tvData = null;
      let movieData = null;

      try {
        tvData = await fetchWithDelay(`${BASE_URL}/tv/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`);
      } catch {}

      try {
        movieData = await fetchWithDelay(`${BASE_URL}/movie/${strId}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=videos,credits,recommendations`);
      } catch {}

      const fallbackResolved = resolveMediaClassification({
        search_title: '',
        total_episodes: 1,
        max_season: 1
      }, movieData, tvData);

      if (fallbackResolved) {
        return mapAnimeData({ ...fallbackResolved.data, media_type: fallbackResolved.isMovie ? 'movie' : 'tv' });
      }

      return null;
    } catch (error) {
      console.error('Error fetching anime info:', error);
      return null;
    }
  },

  getAnimeById: (id) => api.getAnimeInfo(id),

  // Search in Navbar Modal
  searchAnime: async (query) => {
    try {
      if (!query || !query.trim()) return [];
      const customAnimes = await api.getCatalogAnimes(true);
      const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
      
      const matchedCustom = customAnimes.filter(ca => {
        if (ca.isSecret) return false;
        const titleLower = `${ca.title || ''} ${ca.searchTitle || ''}`.toLowerCase();
        return queryWords.every(word => titleLower.includes(word));
      });

      const multiUrl = `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(query)}&include_adult=false`;
      const data = await fetchWithDelay(multiUrl).catch(() => ({ results: [] }));
      const tmdbHits = (data?.results || [])
        .filter(item => (item.media_type === 'tv' || item.media_type === 'movie') && !isEcchiOrNSFW(item))
        .map(mapAnimeData);
      return dedupeCatalogList([...matchedCustom, ...tmdbHits]);
    } catch (error) {
      console.error('Error searching anime:', error);
      return [];
    }
  },

  // Dedicated Catalog Search
  searchCatalog: async (query, typeFilter = 'todos', genreName = 'Todos') => {
    try {
      if (!query || !query.trim()) return [];
      const cleanQ = query.trim().toLowerCase();
      const queryWords = cleanQ.split(/\s+/).filter(Boolean);

      const customAnimes = await api.getCatalogAnimes(false);
      let matchedCustom = customAnimes.filter(ca => {
        const titleLower = `${ca.title || ''} ${ca.searchTitle || ''}`.toLowerCase();
        const descLower = (ca.description || '').toLowerCase();
        return queryWords.every(w => titleLower.includes(w) || descLower.includes(w));
      });

      if (typeFilter === 'peliculas') {
        matchedCustom = matchedCustom.filter(ca => ca.contentType === 'peliculas');
      } else if (typeFilter === 'series') {
        matchedCustom = matchedCustom.filter(ca => ca.contentType === 'series');
      }
      if (genreName && genreName !== 'Todos') {
        matchedCustom = matchedCustom.filter(ca => ca.genres && ca.genres.includes(genreName));
      }

      let tmdbResults = [];
      if (typeFilter === 'peliculas') {
        const movieUrl = `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(cleanQ)}&include_adult=false`;
        const data = await fetchWithDelay(movieUrl).catch(() => ({ results: [] }));
        tmdbResults = (data.results || []).map(item => mapAnimeData({ ...item, media_type: 'movie' }));
      } else if (typeFilter === 'series') {
        const tvUrl = `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(cleanQ)}&include_adult=false`;
        const data = await fetchWithDelay(tvUrl).catch(() => ({ results: [] }));
        tmdbResults = (data.results || []).map(mapAnimeData);
      } else {
        const movieUrl = `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(cleanQ)}&include_adult=false`;
        const tvUrl = `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(cleanQ)}&include_adult=false`;
        const [movieRes, tvRes] = await Promise.all([
          fetchWithDelay(movieUrl).catch(() => ({ results: [] })),
          fetchWithDelay(tvUrl).catch(() => ({ results: [] }))
        ]);
        const mappedMovies = (movieRes?.results || []).map(item => mapAnimeData({ ...item, media_type: 'movie' }));
        const mappedTv = (tvRes?.results || []).map(mapAnimeData);
        tmdbResults = [...mappedMovies, ...mappedTv];
      }

      if (genreName && genreName !== 'Todos') {
        tmdbResults = tmdbResults.filter(item => item.genres && item.genres.includes(genreName));
      }

      return dedupeCatalogList([...matchedCustom, ...tmdbResults]);
    } catch (error) {
      console.error('Error searching catalog:', error);
      return [];
    }
  },

  // Episode List Builder (Supabase + TMDB)
  getAnimeEpisodes: async (id, totalEpisodesHint = null) => {
    try {
      const strId = String(id || '').trim();
      const { data: customData } = !DB_CATALOG_ITEMS[strId]
        ? await supabase.from('custom_animes').select('*').eq('id', strId).maybeSingle()
        : { data: null };

      if (customData || strId.startsWith('custom-')) {
        if (!customData) return [];
        
        const isSingleCustomMovie = Number(customData.total_episodes) === 1;

        let scrapedEps = [];
        const { data: byTitleEps } = await supabase
          .from('anime_episodes')
          .select('episode_number, season_number, episode_name')
          .ilike('search_title', customData.title)
          .order('episode_number', { ascending: true });
        if (byTitleEps && byTitleEps.length > 0) {
          scrapedEps = byTitleEps;
        } else if (!strId.startsWith('custom-')) {
          const { data: byIdEps } = await supabase
            .from('anime_episodes')
            .select('episode_number, season_number, episode_name')
            .eq('anime_tmdb_id', strId)
            .order('episode_number', { ascending: true });
          if (byIdEps && byIdEps.length > 0) scrapedEps = byIdEps;
        }

        if (scrapedEps && scrapedEps.length > 0) {
          const uniqueEps = [];
          const seen = new Set();
          for (const ep of scrapedEps) {
            const key = `${ep.season_number || 1}-${ep.episode_number}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueEps.push(ep);
            }
          }
          uniqueEps.sort((a, b) => {
            const sa = Number(a.season_number || 1);
            const sb = Number(b.season_number || 1);
            if (sa !== sb) return sa - sb;
            return Number(a.episode_number) - Number(b.episode_number);
          });

          let absCount = 1;
          return uniqueEps.map((ep) => {
            const s = ep.season_number || 1;
            let customName = null;
            const customEp = customData.episode_names?.[ep.episode_number] || customData.episode_names?.[String(ep.episode_number)];
            if (customEp && typeof customEp === 'object') {
              customName = customEp.name || customEp.title;
            } else if (typeof customEp === 'string' && customEp.trim()) {
              customName = customEp.replace(/^T\d+E\d+\s*[-:]*\s*/i, '');
            }

            let finalName = ep.episode_name;
            if (!finalName || /^Episodio\s+\d+$/i.test(finalName)) {
              finalName = customName || finalName || (`Episodio ${ep.episode_number}`);
            }

            return {
              id: ep.episode_number,
              title: finalName,
              url: ep.episode_number,
              season: s,
              season_number: s,
              absolute_id: absCount++
            };
          });
        }

        const names = customData.episode_names || {};
        const total = isSingleCustomMovie ? 1 : (customData.total_episodes || Math.max(Object.keys(names).length, 1));
        return Array.from({ length: total }, (_, i) => {
          const epNum = i + 1;
          const epVal = names[epNum] || names[String(epNum)];
          let epSeason = 1;
          let epTitle = isSingleCustomMovie ? (customData.title || 'Película Completa') : `T1E${epNum}`;

          if (epVal && typeof epVal === 'object') {
            epSeason = Number(epVal.season) || 1;
            epTitle = epVal.name || epVal.title || `T${epSeason}E${epVal.episode || epNum}`;
          } else if (typeof epVal === 'string' && epVal.trim()) {
            epTitle = epVal;
            const match = epVal.match(/^T(\d+)E/i) || epVal.match(/^Temporada\s*(\d+)/i);
            if (match) {
              epSeason = parseInt(match[1], 10);
            }
          }

          return {
            id: epNum,
            tmdb_episode_id: epNum,
            title: epTitle,
            url: epNum,
            season: epSeason,
            season_number: epSeason,
            absolute_id: epNum
          };
        });
      }

      const info = await api.getAnimeInfo(id);
      if (!info) return [];
      
      if (info.type === 'Película' || info.contentType === 'peliculas' || info.isMovie || Number(info.totalEpisodes) === 1 || Number(totalEpisodesHint) === 1) {
        return [{
          id: 1,
          tmdb_episode_id: 1,
          title: info.title || 'Película Completa',
          url: 1,
          season: 1,
          season_number: 1,
          isMovie: true
        }];
      }

      let dbEps = [];
      try {
        const { data } = await supabase
          .from('anime_episodes')
          .select('episode_number, season_number, episode_name')
          .eq('anime_tmdb_id', String(info.id))
          .order('episode_number', { ascending: false });
          
        if (data && data.length > 0) {
          dbEps = data;
        }
      } catch (e) {
        console.warn('Error fetching Supabase episodes:', e);
      }

      if (dbEps.length > 0) {
        const byEpKey = new Map();
        for (const ep of dbEps) {
          const sNum = Number(ep.season_number || 1);
          const epNum = Number(ep.episode_number);
          const key = `${sNum}-${epNum}`;
          const existing = byEpKey.get(key);
          if (!existing || (!existing.episode_name && ep.episode_name) || (/^Episodio\s+\d+$/i.test(existing.episode_name || '') && ep.episode_name && !/^Episodio\s+\d+$/i.test(ep.episode_name))) {
            byEpKey.set(key, ep);
          }
        }
        const sortedUnique = Array.from(byEpKey.values()).sort((a, b) => {
          const sa = Number(a.season_number || 1);
          const sb = Number(b.season_number || 1);
          if (sa !== sb) return sa - sb;
          return Number(a.episode_number) - Number(b.episode_number);
        });
        return sortedUnique.map((ep, idx) => ({
          id: ep.episode_number,
          tmdb_episode_id: ep.episode_number,
          title: ep.episode_name || `Episodio ${ep.episode_number}`,
          url: ep.episode_number,
          season: ep.season_number || 1,
          season_number: ep.season_number || 1,
          absolute_id: idx + 1
        }));
      }

      // If not in database, fallback to TMDB TV seasons
      const numSeasons = info.number_of_seasons || 1; 
      let allEpisodes = [];
      let absoluteEpCount = 1;

      for (let s = 1; s <= Math.min(numSeasons, 15); s++) {
        try {
          const seasonData = await fetchWithDelay(`${BASE_URL}/tv/${id}/season/${s}?api_key=${TMDB_API_KEY}&language=es-MX`);
          if (seasonData.episodes && seasonData.episodes.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const seasonEps = seasonData.episodes
              .filter(ep => !ep.air_date || ep.air_date <= today)
              .map(ep => ({
                id: ep.episode_number,
                title: `T${s}E${ep.episode_number} - ${ep.name}`,
                url: ep.episode_number,
                season: s,
                season_number: s,
                absolute_id: absoluteEpCount++ 
              }));
            allEpisodes = [...allEpisodes, ...seasonEps];
          }
        } catch (e) {
          console.warn(`Error fetching TMDB season ${s}:`, e);
        }
      }

      if (allEpisodes.length > 0) return allEpisodes;
      
      const total = info.number_of_episodes || (info.type === 'Película' ? 1 : 12);
      return Array.from({ length: total }, (_, i) => ({
        id: i + 1,
        tmdb_episode_id: i + 1,
        title: `Episodio ${i + 1}`,
        url: i + 1,
        season: 1,
        season_number: 1
      }));
    } catch (error) {
      console.error('Error fetching anime episodes:', error);
      return [];
    }
  },

  // Streaming Servers (Direct MP4, HLS, Rumble, Filemoon, etc.)
  getEpisodeServers: async (animeTitle, episodeId, language = 'sub', animeId = null, seasonNumber = 1) => {
    const cleanTitle = (animeTitle || '').trim();
    const shortTitle = cleanTitle.split(/[:\-\(]/)[0].trim();
    let serversData = [];

    try {
      if (animeId) {
        const idStr = String(animeId).trim();
        if (seasonNumber) {
          const { data: bySeasonData } = await supabase
            .from('anime_episodes')
            .select('*')
            .eq('anime_tmdb_id', idStr)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeId)
            .order('created_at', { ascending: false });

          if (bySeasonData && bySeasonData.length > 0) {
            serversData = bySeasonData;
          }
        }

        if (serversData.length === 0) {
          let q = supabase.from('anime_episodes').select('*').eq('anime_tmdb_id', idStr);
          if (!idStr.startsWith('custom-')) {
            q = q.eq('episode_number', episodeId);
          }
          const { data: byIdData } = await q.order('created_at', { ascending: false });
          if (byIdData && byIdData.length > 0) {
            serversData = byIdData;
          } else if (!idStr.startsWith('custom-')) {
            const { data: anyById } = await supabase.from('anime_episodes').select('*').eq('anime_tmdb_id', idStr);
            if (anyById && anyById.length > 0) {
              serversData = anyById;
            }
          }
        }
      }

      if (serversData.length === 0 && cleanTitle) {
        if (seasonNumber) {
          const { data: byTitleSeason } = await supabase
            .from('anime_episodes')
            .select('*')
            .ilike('search_title', cleanTitle)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeId)
            .order('created_at', { ascending: false });

          if (byTitleSeason && byTitleSeason.length > 0) {
            serversData = byTitleSeason;
          }
        }

        if (serversData.length === 0) {
          const { data: bySearchTitle } = await supabase
            .from('anime_episodes')
            .select('*')
            .ilike('search_title', cleanTitle)
            .eq('episode_number', episodeId)
            .order('created_at', { ascending: false });

          if (bySearchTitle && bySearchTitle.length > 0) {
            serversData = bySearchTitle;
          } else if (shortTitle && shortTitle !== cleanTitle) {
            const { data: byShortSearch } = await supabase
              .from('anime_episodes')
              .select('*')
              .ilike('search_title', shortTitle)
              .eq('episode_number', episodeId)
              .order('created_at', { ascending: false });
            if (byShortSearch && byShortSearch.length > 0) {
              serversData = byShortSearch;
            }
          }
        }
      }

      if (serversData.length === 0 && cleanTitle) {
        const { data: byEpName } = await supabase
          .from('anime_episodes')
          .select('*')
          .ilike('episode_name', `%${cleanTitle}%`)
          .order('created_at', { ascending: false });

        if (byEpName && byEpName.length > 0) {
          serversData = byEpName;
        }
      }

      if (serversData.length > 0) {
        let servers = serversData.map(lat => {
          const rawLang = String(lat.language || 'sub').toLowerCase().trim();
          let normalizedLang = 'sub';
          if (rawLang.includes('lat') || rawLang === 'es' || rawLang === 'español' || rawLang === 'spanish') normalizedLang = 'latino';
          else if (rawLang.includes('cast')) normalizedLang = 'castellano';
          else if (rawLang.includes('sub') || rawLang.includes('jap') || rawLang === 'ja') normalizedLang = 'sub';
          else if (rawLang === 'none') normalizedLang = 'none';
          else normalizedLang = rawLang;

          const sName = (lat.server_name || 'Servidor').toUpperCase();
          const isDirectMp4 = (lat.video_url || '').includes('.mp4') || sName.includes('RUMBLE') || sName.includes('ARCHIVE');
          const isHls = (lat.video_url || '').includes('.m3u8');

          return {
            name: lat.server_name || 'Servidor',
            description: `Servidor Oficial (${normalizedLang.toUpperCase()})`,
            url: lat.video_url,
            isDirectMp4,
            isHls,
            color: sName.includes('RUMBLE') ? '#00e5ff' :
                   sName.includes('FILEMOON') ? '#3b82f6' : 
                   sName.includes('EARNVIDS') ? '#10b981' : 
                   sName.includes('STREAMWISH') ? '#8b5cf6' : 
                   sName.includes('ZOPLAYER') ? '#f59e0b' : '#ff6b00',
            lang: normalizedLang,
            skip_start: lat.skip_start || null,
            skip_end: lat.skip_end || null,
            outro_start: lat.outro_start || null
          };
        });

        // Deduplicate servers by URL
        const unique = servers.filter((server, index, self) =>
          index === self.findIndex((t) => t.url === server.url)
        );

        // Sort by quality & reliability: Direct MP4 / Rumble / Archive first, then HLS, then embed
        return unique.sort((a, b) => {
          if (a.isDirectMp4 && !b.isDirectMp4) return -1;
          if (!a.isDirectMp4 && b.isDirectMp4) return 1;
          if (a.isHls && !b.isHls) return -1;
          if (!a.isHls && b.isHls) return 1;
          return 0;
        });
      }
    } catch (e) {
      console.error('Error fetching servers from Supabase:', e);
    }

    return [{
      name: 'No Disponible',
      description: 'Este episodio aún no tiene un servidor configurado.',
      url: '',
      color: '#4b5563',
      lang: 'none'
    }];
  },

  // Available Languages for title badge - Strict and prioritized for Español Latino
  getAnimeLanguages: async (animeId, animeTitle) => {
    try {
      const strId = String(animeId || '').trim();
      let query = supabase.from('anime_episodes').select('language');
      if (strId && !strId.startsWith('custom-')) {
        query = query.eq('anime_tmdb_id', strId);
      } else if (animeTitle) {
        query = query.ilike('search_title', animeTitle.trim());
      }
      const { data } = await query.limit(100);
      if (data && data.length > 0) {
        const langs = new Set();
        data.forEach(r => {
          const raw = String(r.language || '').toLowerCase().trim();
          if (raw.includes('lat') || raw === 'es' || raw === 'español' || raw === 'spanish') langs.add('Latino');
          else if (raw.includes('cast')) langs.add('Castellano');
          else if (raw.includes('sub') || raw.includes('jap') || raw === 'ja') langs.add('Subtitulado');
          else if (raw && raw !== 'none') langs.add(raw.charAt(0).toUpperCase() + raw.slice(1));
        });

        // Strict priority sorting: Latino first, then Subtitulado, then Castellano
        const ORDER = ['Latino', 'Subtitulado', 'Castellano'];
        return Array.from(langs).sort((a, b) => {
          const ia = ORDER.indexOf(a);
          const ib = ORDER.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
      }
    } catch (e) {
      console.error('Error fetching languages:', e);
    }
    return [];
  },

  // Get Similar & Recommended Titles for Details page
  getSimilarTitles: async (mediaItem) => {
    try {
      if (!mediaItem) return [];
      const strId = String(mediaItem.id || '').trim();

      // 1. If official TMDB ID, fetch recommendations from TMDB
      if (/^\d+$/.test(strId)) {
        const endpoint = mediaItem.isMovie ? 'movie' : 'tv';
        const url = `${BASE_URL}/${endpoint}/${strId}/recommendations?api_key=${TMDB_API_KEY}&language=es-MX&page=1`;
        const res = await fetchWithDelay(url).catch(() => ({ results: [] }));
        if (res?.results && res.results.length > 0) {
          const mapped = res.results.filter(r => !isEcchiOrNSFW(r)).slice(0, 10).map(mapAnimeData);
          if (mapped.length > 0) return mapped;
        }
      }

      // 2. Fallback: match catalog titles sharing genres or content type
      const allCatalog = await api.getCatalogAnimes(false);
      const targetGenres = new Set(mediaItem.genres || []);
      const matches = allCatalog.filter(item => {
        if (String(item.id) === strId) return false;
        if (item.contentType !== mediaItem.contentType) return false;
        if (targetGenres.size > 0 && item.genres) {
          return item.genres.some(g => targetGenres.has(g));
        }
        return true;
      });

      return matches.slice(0, 10);
    } catch (e) {
      console.warn('Error fetching similar titles:', e);
      return [];
    }
  },

  // Linked Saga or Franchise Info (Harry Potter, Piratas del Caribe, etc.)
  getSagaInfo: async (animeId, animeTitle) => {
    try {
      const cleanTitle = (animeTitle || '').trim().toLowerCase();
      const strId = String(animeId || '').trim();

      let { data: collEps } = await supabase
        .from('anime_episodes')
        .select('anime_tmdb_id, search_title, episode_name, episode_number, season_number')
        .or(`search_title.ilike.%${cleanTitle}%,anime_tmdb_id.eq.${strId}`)
        .order('episode_number', { ascending: true });

      if (!collEps || collEps.length === 0) {
        const { data: movieRow } = await supabase
          .from('anime_episodes')
          .select('search_title, episode_name, episode_number')
          .eq('anime_tmdb_id', strId)
          .limit(1);

        if (movieRow && movieRow.length > 0) {
          const parentTitle = movieRow[0].search_title;
          const { data: parentEps } = await supabase
            .from('anime_episodes')
            .select('anime_tmdb_id, search_title, episode_name, episode_number, season_number')
            .ilike('search_title', parentTitle)
            .order('episode_number', { ascending: true });
          collEps = parentEps;
        }
      }

      if (!collEps || collEps.length === 0) return null;

      const isExplicitCollection = /colecci[oó]n|saga|trilog[ií]a|tetralog[ií]a|antolog[ií]a/i.test(collEps[0]?.search_title || '') ||
                                  /colecci[oó]n|saga|trilog[ií]a|tetralog[ií]a|antolog[ií]a/i.test(cleanTitle);

      const hasMultipleSeasons = collEps.some(ep => Number(ep.season_number) > 1);
      if (hasMultipleSeasons && !isExplicitCollection) return null;

      const distinctTmdbIds = new Set(collEps.map(e => e.anime_tmdb_id).filter(Boolean));
      if (!isExplicitCollection && distinctTmdbIds.size <= 1) return null;

      const uniqueMoviesMap = new Map();
      const sagaTitle = collEps[0].search_title || 'Colección';

      collEps.forEach(ep => {
        if (!uniqueMoviesMap.has(ep.episode_number)) {
          uniqueMoviesMap.set(ep.episode_number, {
            episode_number: ep.episode_number,
            title: ep.episode_name || `Película ${ep.episode_number}`,
            tmdb_id: ep.anime_tmdb_id,
            season: ep.season_number || 1
          });
        }
      });

      const moviesList = Array.from(uniqueMoviesMap.values()).sort((a, b) => a.episode_number - b.episode_number);
      if (moviesList.length <= 1) return null;

      const { data: customColl } = await supabase
        .from('custom_animes')
        .select('*')
        .ilike('title', sagaTitle)
        .limit(1);

      const collectionItem = customColl && customColl.length > 0 ? customColl[0] : null;

      return {
        sagaTitle,
        collectionId: collectionItem ? collectionItem.id : null,
        collectionImage: collectionItem ? collectionItem.image : null,
        totalMovies: moviesList.length,
        movies: moviesList,
        isParentCollection: isExplicitCollection && cleanTitle === sagaTitle.toLowerCase()
      };
    } catch (err) {
      console.error('Error fetching saga info:', err);
      return null;
    }
  },

  // Update Skip Times in DB
  updateEpisodeTimes: async (tmdbId, episodeNumber, times) => {
    try {
      const { error } = await supabase
        .from('anime_episodes')
        .update(times)
        .eq('anime_tmdb_id', String(tmdbId))
        .eq('episode_number', parseInt(episodeNumber, 10));
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error updating episode times:', e);
      return false;
    }
  },

  // Delete Custom Anime
  deleteCustomAnime: async (id) => {
    return supabase.from('custom_animes').delete().eq('id', id);
  }
};
