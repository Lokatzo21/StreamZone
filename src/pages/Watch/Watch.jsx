import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, List, Volume2, ArrowLeft,
  Moon, Sun, Keyboard, X, Sparkles, Check
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

  // Proactive features: Theater / Lights Off Mode & Shortcuts Modal
  const [theaterMode, setTheaterMode] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

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
          setActiveServer(filtered.length > 0 ? filtered[0] : srvs[0]);
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

  // When user switches language, filter servers
  useEffect(() => {
    if (rawServers.length === 0) return;
    const filtered = rawServers.filter(s => s.lang === selectedLanguage);
    if (filtered.length > 0) {
      setActiveServer(filtered[0]);
    } else {
      setActiveServer(rawServers[0]);
    }
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
  const currentEpDisplayTitle = currentEp?.title && !currentEp.title.toLowerCase().startsWith('episodio')
    ? currentEp.title
    : `Episodio ${relativeEpNum}`;

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

  // Filtered server list matching current language
  const currentLanguageServers = rawServers.filter(s => s.lang === selectedLanguage);
  const displayServers = currentLanguageServers.length > 0 ? currentLanguageServers : rawServers;

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
            {availableSeasons.length > 1 ? `T${querySeason}: ${currentEpDisplayTitle}` : currentEpDisplayTitle}
          </span>
        </div>

        <div className="watch-top-tools">
          {/* Theater / Lights Out Mode Toggle */}
          <button
            className={`theater-mode-btn ${theaterMode ? 'active' : ''}`}
            onClick={() => setTheaterMode(t => !t)}
            title={theaterMode ? 'Encender luces' : 'Modo Cine / Apagar luces'}
            aria-label="Modo Cine"
          >
            {theaterMode ? <Sun size={17} /> : <Moon size={17} />}
            <span className="tool-btn-text">{theaterMode ? 'Luces ON' : 'Modo Cine'}</span>
          </button>

          {/* Keyboard Shortcuts Help */}
          <button
            className="shortcuts-help-btn"
            onClick={() => setShowShortcutsHelp(true)}
            title="Atajos de teclado (?)"
            aria-label="Atajos de teclado"
          >
            <Keyboard size={17} />
          </button>

          {/* Toggle Sidebar */}
          <button
            className={`toggle-sidebar-btn ${isSidebarOpen ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(prev => !prev)}
            aria-label={isSidebarOpen ? 'Ocultar lista' : 'Ver episodios'}
          >
            <List size={18} />
            <span className="tool-btn-text">{isSidebarOpen ? 'Ocultar Lista' : 'Episodios'}</span>
          </button>
        </div>
      </div>

      {/* Main Theater Stage */}
      <div className={`watch-stage-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Left Video Area */}
        <div className="player-stage-column">
          <AdvancedPlayer
            animeInfo={animeInfo}
            episodeInfo={currentEp}
            servers={displayServers}
            activeServer={activeServer}
            onSelectServer={setActiveServer}
            onNextEpisode={handleNextEpisode}
            onPrevEpisode={handlePrevEpisode}
            hasNextEpisode={hasNext}
            hasPrevEpisode={hasPrev}
            onToggleTheater={() => setTheaterMode(t => !t)}
            onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
          />

          {/* Player Metadata & Dynamic Language Bar */}
          <div className="watch-under-player-row glass-panel">
            <div className="media-summary-left">
              <h2 className="under-title">{animeInfo?.title}</h2>
              <p className="under-episode-name">
                {availableSeasons.length > 1
                  ? `Temporada ${querySeason} • ${currentEpDisplayTitle}`
                  : currentEpDisplayTitle}
              </p>
            </div>

            {/* DYNAMIC AUDIO LANGUAGES (ONLY AVAILABLE ONES IN DB) */}
            <div className="audio-languages-container">
              {availableLanguages.length > 1 ? (
                <div className="audio-lang-selector-pills">
                  <span className="lang-selector-label">
                    <Volume2 size={15} />
                    <span>Audio:</span>
                  </span>
                  {availableLanguages.map(lang => (
                    <button
                      key={lang}
                      className={`lang-pill ${selectedLanguage === lang ? 'active' : ''}`}
                      onClick={() => setSelectedLanguage(lang)}
                    >
                      {selectedLanguage === lang && <Check size={14} className="lang-check" />}
                      <span>{LANG_LABELS[lang] || lang.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              ) : availableLanguages.length === 1 ? (
                <div className="single-lang-badge">
                  <Volume2 size={15} />
                  <span>Disponible en: <strong>{LANG_LABELS[availableLanguages[0]] || availableLanguages[0].toUpperCase()}</strong></span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Episodes Sidebar Drawer */}
        {isSidebarOpen && (
          <aside className="episodes-sidebar-drawer glass-panel fade-in">
            <div className="sidebar-drawer-header">
              <h3 className="drawer-title">Episodios</h3>
              <span className="drawer-count">{episodes.length} totales</span>
            </div>

            {/* Season Selector Tabs in Sidebar (if > 1 season) */}
            {availableSeasons.length > 1 && (
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
                        {ep.title && !ep.title.toLowerCase().startsWith('episodio') ? ep.title : `Episodio ${idx + 1}`}
                      </span>
                      <span className="sidebar-ep-season">Temporada {ep.season || selectedSeasonTab}</span>
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
