import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, List, Volume2, ArrowLeft,
  Moon, Sun, Keyboard, X, Sparkles, Check, Server, Play,
  Eye, EyeOff, Maximize, SkipForward
} from 'lucide-react';
import AdvancedPlayer from '../../components/CustomPlayer/AdvancedPlayer';
import { api } from '../../services/api';
import './Watch.css';

const LANG_PRIORITY = ['latino', 'sub', 'castellano'];

const LANG_LABELS = {
  latino: 'Español Latino',
  sub: 'Japonés Subtitulado',
  castellano: 'Español Castellano'
};

const isDirectStream = (s) => {
  if (!s || !s.url) return false;
  const u = String(s.url).toLowerCase();
  const n = String(s.name || '').toLowerCase();
  return (
    u.includes('.mp4') ||
    u.includes('.m3u8') ||
    u.includes('streamproxy') ||
    u.includes('.p3x8') ||
    u.includes('rumble') ||
    n.includes('arcando') ||
    n.includes('cinebel') ||
    n.includes('mediafire') ||
    Boolean(s.isDirectMp4 || s.isHls)
  );
};

const pickBestServer = (serverList) => {
  if (!serverList || serverList.length === 0) return null;
  const direct = serverList.filter(isDirectStream);
  return direct.length > 0 ? direct[0] : serverList[0];
};

const Watch = () => {
  const { id, episode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const episodeNumber = parseInt(episode || '1', 10);
  const querySeason = searchParams.get('season') ? parseInt(searchParams.get('season'), 10) : 1;

  const [animeInfo, setAnimeInfo] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [rawServers, setRawServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('latino');
  const [selectedSeasonTab, setSelectedSeasonTab] = useState(querySeason);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [externalControlsVisible, setExternalControlsVisible] = useState(true);
  const playerRef = useRef(null);

  // Proactive features: Theater / Lights Off Mode & Shortcuts Modal
  const [theaterMode, setTheaterMode] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const handleToggleControls = () => {
    setExternalControlsVisible(prev => !prev);
  };

  const handleFullscreenFromToolbar = () => {
    if (playerRef.current?.toggleFullscreen) {
      playerRef.current.toggleFullscreen();
    }
  };

  // Load Media Info & All Episodes
  useEffect(() => {
    let isMounted = true;
    const fetchMedia = async () => {
      try {
        setLoading(true);
        const [info, epList] = await Promise.all([
          api.getAnimeInfo(id),
          api.getAnimeEpisodes(id)
        ]);

        if (isMounted) {
          setAnimeInfo(info);
          setEpisodes(epList);
        }
      } catch (err) {
        console.error('Error fetching watch media:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMedia();
    return () => { isMounted = false; };
  }, [id]);

  // Esc key exits theater mode
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && theaterMode) {
        setTheaterMode(false);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [theaterMode]);

  // Load All Streaming Servers for current episode (without static language restriction)
  useEffect(() => {
    if (!animeInfo) return;

    let isMounted = true;
    const fetchServers = async () => {
      try {
        const srvs = await api.getEpisodeServers(
          animeInfo.title,
          episodeNumber,
          null, // pass null so we get ALL language tracks available in DB
          animeInfo.id,
          querySeason
        );

        if (isMounted && srvs && srvs.length > 0) {
          setRawServers(srvs);

          // Extract unique languages actually present in the database for this title & episode
          const langsInEpisode = Array.from(new Set(
            srvs.map(s => s.lang).filter(l => l && l !== 'none')
          ));

          // Sort prioritizing Español Latino
          langsInEpisode.sort((a, b) => {
            const ia = LANG_PRIORITY.indexOf(a);
            const ib = LANG_PRIORITY.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          });

          setAvailableLanguages(langsInEpisode);

          // Auto-select Latino if available, otherwise first available
          let chosenLang = selectedLanguage;
          if (!langsInEpisode.includes(chosenLang)) {
            chosenLang = langsInEpisode.includes('latino') ? 'latino' : (langsInEpisode[0] || 'latino');
            setSelectedLanguage(chosenLang);
          }

          const filtered = srvs.filter(s => s.lang === chosenLang);
          const best = pickBestServer(filtered.length > 0 ? filtered : srvs);
          setActiveServer(best);
        } else if (isMounted) {
          setRawServers([]);
          setActiveServer(null);
          setAvailableLanguages([]);
        }
      } catch (err) {
        console.error('Error fetching episode servers:', err);
      }
    };

    fetchServers();
    return () => { isMounted = false; };
  }, [animeInfo, episodeNumber, querySeason]);

  // When user switches language, filter servers (prioritizing direct playable streams)
  useEffect(() => {
    if (rawServers.length === 0) return;
    const filtered = rawServers.filter(s => s.lang === selectedLanguage);
    const best = pickBestServer(filtered.length > 0 ? filtered : rawServers);
    setActiveServer(best);
  }, [selectedLanguage, rawServers]);

  // Group episodes by season for sidebar
  const seasonsMap = {};
  episodes.forEach(ep => {
    const s = ep.season || 1;
    if (!seasonsMap[s]) seasonsMap[s] = [];
    seasonsMap[s].push(ep);
  });
  const availableSeasons = Object.keys(seasonsMap).map(Number).sort((a, b) => a - b);
  const currentSeasonEpisodes = seasonsMap[selectedSeasonTab] || episodes;

  // Find current episode object
  const currentEp = episodes.find(e => Number(e.id) === episodeNumber) || {
    id: episodeNumber,
    title: `Episodio ${episodeNumber}`,
    season: querySeason
  };

  // Relative episode index in current season
  const activeSeasonList = seasonsMap[querySeason] || currentSeasonEpisodes;
  const episodeInSeasonIdx = activeSeasonList.findIndex(e => Number(e.id) === episodeNumber);
  const relativeEpNum = episodeInSeasonIdx !== -1 ? episodeInSeasonIdx + 1 : episodeNumber;
  // Content Type Detection (Película, Saga, Serie, Anime)
  const isMovie = Boolean(
    animeInfo?.isMovie ||
    animeInfo?.contentType === 'peliculas' ||
    /pel[ií]cula/i.test(animeInfo?.type || '') ||
    (episodes.length === 1 && !animeInfo?.number_of_seasons && (!animeInfo?.totalEpisodes || Number(animeInfo?.totalEpisodes) === 1))
  );

  const isSaga = Boolean(
    animeInfo?.isCollection ||
    /saga|colecci[oó]n/i.test(animeInfo?.title || '') ||
    /saga/i.test(animeInfo?.type || '')
  );

  const isAnime = Boolean(
    animeInfo?.contentType === 'animes' ||
    /anime/i.test(animeInfo?.type || '') ||
    (Array.isArray(animeInfo?.genres) && animeInfo.genres.some(g => /animaci[oó]n|anime/i.test(typeof g === 'string' ? g : g.name)))
  );

  const isSeries = !isMovie && !isSaga && !isAnime;

  const currentEpDisplayTitle = isMovie
    ? 'Película Completa'
    : (currentEp?.title && !currentEp.title.toLowerCase().startsWith('episodio')
        ? currentEp.title
        : `Episodio ${relativeEpNum}`);

  const currentIndex = episodes.findIndex(e => Number(e.id) === episodeNumber);
  const hasNext = currentIndex !== -1 && currentIndex < episodes.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNextEpisode = () => {
    if (hasNext) {
      const nextEp = episodes[currentIndex + 1];
      navigate(`/watch/${id}/${nextEp.id}?season=${nextEp.season || querySeason}`);
    }
  };

  const handlePrevEpisode = () => {
    if (hasPrev) {
      const prevEp = episodes[currentIndex - 1];
      navigate(`/watch/${id}/${prevEp.id}?season=${prevEp.season || querySeason}`);
    }
  };

  return (
    <div className={`watch-page-container ${theaterMode ? 'theater-mode-active' : ''}`}>
      {/* Lights Off Backdrop Tint */}
      {theaterMode && (
        <div
          className="theater-backdrop-overlay fade-in"
          onClick={() => setTheaterMode(false)}
          title="Haz clic para encender las luces (o presiona Escape)"
        />
      )}

      {/* Top Theater Header */}
      <div className="watch-top-navbar">
        <Link to={`/anime/${id}`} className="back-to-details-btn">
          <ArrowLeft size={18} />
          <span>Volver a la ficha</span>
        </Link>

        <div className="watch-title-breadcrumbs">
          <span className="crumb-title">{animeInfo?.title}</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-ep">
            {isMovie
              ? 'Película Completa'
              : isSaga
                ? (currentEp?.title && currentEp.title !== animeInfo?.title ? currentEp.title : `Parte ${relativeEpNum}`)
                : availableSeasons.length > 1
                  ? `T${querySeason}: ${currentEpDisplayTitle}`
                  : currentEpDisplayTitle}
          </span>
        </div>

        <div className="watch-top-tools">
          {/* Toggle Sidebar (Only if not a single movie) */}
          {(!isMovie || episodes.length > 1) && (
            <button
              className={`toggle-sidebar-btn ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(prev => !prev)}
              aria-label={isSidebarOpen ? 'Ocultar lista' : 'Ver episodios'}
            >
              <List size={18} />
              <span className="tool-btn-text">
                {isSidebarOpen ? 'Ocultar Lista' : (isSaga ? 'Películas' : 'Episodios')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Theater Stage */}
      <div className={`watch-stage-layout ${isSidebarOpen && (!isMovie || episodes.length > 1) ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Left Video Area */}
        <div className="player-stage-column">
          {/* Player Toolbar: Outside and ABOVE the Player (AnimeZona / Clean UX Style) */}
          <div className="watch-player-toolbar glass-panel">
            <button
              className={`toolbar-btn ${theaterMode ? 'active' : ''}`}
              onClick={() => setTheaterMode(t => !t)}
              title={theaterMode ? 'Encender luces' : 'Modo Cine'}
            >
              {theaterMode ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theaterMode ? 'Luces ON' : 'Modo Cine'}</span>
            </button>

            <button
              className={`toolbar-btn ${!externalControlsVisible ? 'active' : ''}`}
              onClick={handleToggleControls}
              title={externalControlsVisible ? 'Ocultar controles del reproductor' : 'Mostrar controles del reproductor'}
            >
              {externalControlsVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              <span>{externalControlsVisible ? 'Ocultar Controles' : 'Mostrar Controles'}</span>
            </button>

            <button
              className="toolbar-btn"
              onClick={handleFullscreenFromToolbar}
              title="Pantalla Completa"
            >
              <Maximize size={17} />
              <span>Pantalla Completa</span>
            </button>

            {hasNext && (
              <button
                className="toolbar-btn"
                onClick={handleNextEpisode}
                title={isSaga ? 'Siguiente Película' : 'Siguiente Episodio'}
              >
                <SkipForward size={17} />
                <span>{isSaga ? 'Siguiente Película' : 'Siguiente Ep.'}</span>
              </button>
            )}

            <button
              className="toolbar-btn shortcuts-btn"
              onClick={() => setShowShortcutsHelp(true)}
              title="Atajos de teclado en PC"
            >
              <Keyboard size={17} />
              <span>Atajos en PC</span>
            </button>
          </div>

          <AdvancedPlayer
            ref={playerRef}
            animeInfo={animeInfo}
            episodeInfo={currentEp}
            servers={rawServers}
            activeServer={activeServer}
            onSelectServer={setActiveServer}
            onNextEpisode={handleNextEpisode}
            onPrevEpisode={handlePrevEpisode}
            hasNextEpisode={hasNext}
            hasPrevEpisode={hasPrev}
            onToggleTheater={() => setTheaterMode(t => !t)}
            onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
            externalControlsVisible={externalControlsVisible}
            onToggleControls={handleToggleControls}
            isMovie={isMovie}
            isSaga={isSaga}
          />

          {/* Episode Navigation Row (only if not a single movie) */}
          {(!isMovie || episodes.length > 1) && (
            <div className="watch-nav-controls-row glass-panel">
              <button
                className="nav-control-btn"
                disabled={!hasPrev}
                onClick={handlePrevEpisode}
              >
                <ChevronLeft size={20} />
                <span>{isSaga ? 'Película Anterior' : 'Episodio Anterior'}</span>
              </button>

              <button
                className={`nav-control-btn list-btn ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(prev => !prev)}
              >
                <List size={20} />
                <span>{isSidebarOpen ? 'Ocultar Lista' : (isSaga ? 'Ver Películas' : 'Lista de Episodios')}</span>
              </button>

              <button
                className="nav-control-btn"
                disabled={!hasNext}
                onClick={handleNextEpisode}
              >
                <span>{isSaga ? 'Siguiente Película' : 'Siguiente Episodio'}</span>
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Right Episodes Sidebar Drawer (Only if not a single movie) */}
        {isSidebarOpen && (!isMovie || episodes.length > 1) && (
          <aside className="episodes-sidebar-drawer glass-panel fade-in">
            <div className="sidebar-drawer-header">
              <h3 className="drawer-title">{isSaga ? 'Películas de la Saga' : 'Episodios'}</h3>
              <span className="drawer-count">{episodes.length} {isSaga ? 'películas' : 'totales'}</span>
            </div>

            {/* Season Selector Tabs in Sidebar (if > 1 season and not saga) */}
            {!isSaga && availableSeasons.length > 1 && (
              <div className="sidebar-season-tabs">
                {availableSeasons.map(s => (
                  <button
                    key={s}
                    className={`sidebar-season-tab ${selectedSeasonTab === s ? 'active' : ''}`}
                    onClick={() => setSelectedSeasonTab(s)}
                  >
                    T{s}
                  </button>
                ))}
              </div>
            )}

            <div className="sidebar-episodes-scroll">
              {currentSeasonEpisodes.map((ep, idx) => {
                const isSelected = Number(ep.id) === episodeNumber;
                return (
                  <button
                    key={ep.id || idx}
                    className={`sidebar-ep-card ${isSelected ? 'active' : ''}`}
                    onClick={() => navigate(`/watch/${id}/${ep.id}?season=${ep.season || querySeason}`)}
                  >
                    <div className="ep-badge-num">
                      {isSelected ? '▶' : (idx + 1)}
                    </div>
                    <div className="ep-info-col">
                      <span className="sidebar-ep-title">
                        {isSaga
                          ? (ep.title && ep.title !== animeInfo?.title ? ep.title : `Película ${idx + 1}`)
                          : (ep.title && !ep.title.toLowerCase().startsWith('episodio') ? ep.title : `Episodio ${idx + 1}`)}
                      </span>
                      <span className="sidebar-ep-season">
                        {isSaga ? `Película ${idx + 1}` : `Temporada ${ep.season || selectedSeasonTab}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="shortcuts-modal-backdrop" onClick={() => setShowShortcutsHelp(false)}>
          <div className="shortcuts-modal-card glass-panel fade-in" onClick={e => e.stopPropagation()}>
            <div className="shortcuts-header">
              <div className="shortcuts-title-wrap">
                <Keyboard size={22} className="shortcuts-icon" />
                <h3>Atajos de Teclado del Reproductor</h3>
              </div>
              <button className="close-shortcuts-btn" onClick={() => setShowShortcutsHelp(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-key">Espacio / K</span>
                <span className="shortcut-action">Reproducir / Pausar</span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-key">← / →</span>
                <span className="shortcut-action">Retroceder / Adelantar 10s</span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-key">↑ / ↓</span>
                <span className="shortcut-action">Subir / Bajar Volumen 10%</span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-key">F</span>
                <span className="shortcut-action">Pantalla Completa</span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-key">M</span>
                <span className="shortcut-action">Silenciar / Activar Sonido</span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-key">N</span>
                <span className="shortcut-action">Siguiente Episodio</span>
              </div>
            </div>

            <div className="shortcuts-footer">
              <button className="btn-accent" onClick={() => setShowShortcutsHelp(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watch;
