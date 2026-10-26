import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Plus, Check, Star, Heart, Share2, Film,
  Layers, Volume2, Calendar, Clock, ChevronDown, Sparkles, User,
  ChevronLeft, ChevronRight, Trash2, EyeOff, Eye, FolderPlus, FolderCheck
} from 'lucide-react';
import ContentCard from '../../components/ContentCard/ContentCard';
import { api } from '../../services/api';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import './Details.css';

const Details = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, requireAuth } = useAuth();
  const { hideTitle, unhideTitle, isTitleHidden } = useProfile();
  const {
    isInMyList,
    toggleMyList,
    isFavorite,
    toggleFavorite,
    watchHistory,
    removeEpisodeProgress,
    customLists,
    addItemToCustomList,
    removeItemFromCustomList,
    isInCustomList,
    createCustomList
  } = useWatchProgress();

  const [mediaInfo, setMediaInfo] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [sagaInfo, setSagaInfo] = useState(null);
  const [similarTitles, setSimilarTitles] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [shareToast, setShareToast] = useState(false);
  const [showCustomListsMenu, setShowCustomListsMenu] = useState(false);
  const [quickListName, setQuickListName] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const castTrackRef = useRef(null);
  const customListsMenuRef = useRef(null);

  // Close custom lists dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customListsMenuRef.current && !customListsMenuRef.current.contains(e.target)) {
        setShowCustomListsMenu(false);
        setShowQuickCreate(false);
      }
    };
    if (showCustomListsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomListsMenu]);

  const handleCastScroll = (direction) => {
    if (castTrackRef.current) {
      const scrollAmount = 360;
      castTrackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const inList = isInMyList(id);
  const isFav = isFavorite(id);
  const isInAnyCustomList = customLists.some(l => isInCustomList(l.id, id));
  const itemProgress = watchHistory[String(id)];

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      try {
        setLoading(true);
        const [info, epList] = await Promise.all([
          api.getAnimeInfo(id),
          api.getAnimeEpisodes(id)
        ]);

        if (isMounted && info) {
          setMediaInfo(info);
          setEpisodes(epList);

          // Get linked saga, dynamic languages, and similar recommendations in parallel
          const [langs, saga, similar] = await Promise.all([
            api.getAnimeLanguages(info.id, info.title),
            api.getSagaInfo(info.id, info.title),
            api.getSimilarTitles(info)
          ]);

          if (isMounted) {
            setLanguages(langs);
            setSagaInfo(saga);
            setSimilarTitles(similar);
          }
        }
      } catch (err) {
        console.error('Error loading details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="details-loading-page">
        <div className="player-spinner" />
        <span>Cargando título...</span>
      </div>
    );
  }

  if (!mediaInfo) {
    return (
      <div className="details-not-found glass-panel">
        <h2>Título no encontrado</h2>
        <p>No pudimos encontrar la información de este contenido.</p>
        <button className="btn-accent" onClick={() => navigate('/')}>
          Volver al Inicio
        </button>
      </div>
    );
  }

  // Group episodes by season
  const seasonsMap = {};
  episodes.forEach(ep => {
    const s = ep.season || 1;
    if (!seasonsMap[s]) seasonsMap[s] = [];
    seasonsMap[s].push(ep);
  });

  const availableSeasons = Object.keys(seasonsMap).map(Number).sort((a, b) => a - b);
  const currentSeasonEpisodes = seasonsMap[selectedSeason] || episodes;

  const backdropUrl = mediaInfo.backdrop || mediaInfo.banner || mediaInfo.image;

  const handleStartWatching = () => {
    if (itemProgress && itemProgress.lastEpisodeId) {
      navigate(`/watch/${id}/${itemProgress.lastEpisodeId}?season=${itemProgress.lastSeasonNumber || 1}`);
    } else {
      const firstEp = episodes[0]?.id || 1;
      navigate(`/watch/${id}/${firstEp}?season=${selectedSeason}`);
    }
  };

  const handleShareClick = () => {
    navigator.clipboard?.writeText(window.location.href);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  };

  const castList = (mediaInfo.cast && mediaInfo.cast.length > 0)
    ? mediaInfo.cast
    : (mediaInfo.credits?.cast ? mediaInfo.credits.cast.slice(0, 15).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character || 'Personaje',
        avatar: c.profile_path ? (c.profile_path.startsWith('http') ? c.profile_path : `https://image.tmdb.org/t/p/w185${c.profile_path}`) : null
      })) : []);

  return (
    <div className="details-page-container">
      {/* Toast Notification */}
      {shareToast && (
        <div className="share-toast-notification glass-panel fade-in">
          <Check size={18} className="toast-check" />
          <span>¡Enlace copiado al portapapeles!</span>
        </div>
      )}

      {/* Immersive Hero Header */}
      <div className="details-hero-section">
        <div className="details-backdrop-wrap">
          <img
            src={backdropUrl}
            alt={mediaInfo.title}
            className="details-backdrop-img"
          />
          <div className="details-backdrop-vignette" />
          <div className="details-backdrop-gradient" />
        </div>

        <div className="details-header-content">
          <div className="details-poster-column">
            <div className="details-poster-frame">
              <img
                src={mediaInfo.image || backdropUrl}
                alt={mediaInfo.title}
                className="details-main-poster"
              />
            </div>
          </div>

          <div className="details-info-column">
            {/* Hierarchical Metadata Badges */}
            <div className="details-meta-pills">
              <span className="details-type-pill">{mediaInfo.type || 'Serie'}</span>
              
              {mediaInfo.releaseYear && (
                <span className="details-year-pill">
                  <Calendar size={13} />
                  <span>{mediaInfo.releaseYear}</span>
                </span>
              )}

              {mediaInfo.runtime && (
                <span className="details-runtime-pill">
                  <Clock size={13} />
                  <span>{mediaInfo.runtime} min</span>
                </span>
              )}

              <span className="details-score-pill">
                <Star size={13} fill="#ffb800" color="#ffb800" />
                <span>{mediaInfo.score || '8.8'}</span>
              </span>

              <span className="details-status-pill">{mediaInfo.status || 'Finalizado'}</span>

              {mediaInfo.isMovie ? (
                <span className="details-res-pill">Película Completa</span>
              ) : (
                <span className="details-res-pill">{episodes.length} Episodios</span>
              )}
            </div>

            <h1 className="details-title">{mediaInfo.title}</h1>

            {/* DYNAMIC AUDIO LANGUAGES (STRICTLY FROM DB) */}
            {languages.length > 0 && (
              <div className="details-audio-badges">
                <span className="audio-label">
                  <Volume2 size={15} />
                  <span>Audio disponible:</span>
                </span>
                {languages.map((lang, idx) => (
                  <span key={idx} className={`audio-pill ${lang === 'Latino' ? 'priority' : ''}`}>
                    {lang === 'Latino' ? 'Español Latino' : lang}
                  </span>
                ))}
              </div>
            )}

            {/* Genres Chips */}
            {mediaInfo.genres && mediaInfo.genres.length > 0 && (
              <div className="details-genres-row">
                {mediaInfo.genres.map((g, idx) => (
                  <span key={idx} className="genre-tag">{g}</span>
                ))}
              </div>
            )}

            <p className="details-synopsis">
              {mediaInfo.description || 'Sin sinopsis disponible para este título.'}
            </p>

            {/* Primary Action Buttons */}
            <div className="details-actions-row">
              <button className="btn-primary details-watch-btn" onClick={handleStartWatching}>
                <Play size={22} fill="currentColor" />
                <span>
                  {itemProgress && itemProgress.lastEpisodeId
                    ? `Continuar (Ep ${itemProgress.lastEpisodeId})`
                    : mediaInfo.isMovie ? 'Ver Película' : 'Ver Episodio 1'}
                </span>
              </button>

              <button
                className={`btn-secondary action-circle-btn ${inList ? 'active' : ''}`}
                onClick={() => requireAuth(() => toggleMyList(mediaInfo), 'Inicia sesión para añadir títulos a Mi Lista.')}
                title={inList ? 'Quitar de mi lista' : 'Agregar a mi lista'}
              >
                {inList ? <Check size={20} /> : <Plus size={20} />}
                <span>Mi Lista</span>
              </button>

              <button
                className={`btn-secondary action-circle-btn ${isFav ? 'active-fav' : ''}`}
                onClick={() => requireAuth(() => toggleFavorite(mediaInfo), 'Inicia sesión para guardar títulos en tus Favoritos.')}
                title={isFav ? 'Quitar de favoritos' : 'Marcar favorito'}
              >
                <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
                <span>Favoritos</span>
              </button>

              {/* Custom Lists Selector Trigger */}
              <div className="custom-lists-action-wrapper" ref={customListsMenuRef}>
                <button
                  className={`btn-secondary action-circle-btn ${isInAnyCustomList ? 'active' : ''}`}
                  onClick={() => requireAuth(() => setShowCustomListsMenu(prev => !prev), 'Inicia sesión para organizar títulos en tus listas personalizadas.')}
                  title="Agregar o quitar de listas personalizadas"
                >
                  {isInAnyCustomList ? <FolderCheck size={19} /> : <FolderPlus size={19} />}
                  <span>Listas</span>
                </button>

                {showCustomListsMenu && (
                  <div className="details-custom-lists-popover glass-panel fade-in">
                    <h5 className="custom-popover-title">Mis Listas Personalizadas</h5>
                    <div className="custom-popover-items">
                      {customLists.map(list => {
                        const inThisList = isInCustomList(list.id, id);
                        return (
                          <button
                            key={list.id}
                            className={`custom-popover-list-item ${inThisList ? 'active' : ''}`}
                            onClick={() => {
                              if (inThisList) {
                                removeItemFromCustomList(list.id, id);
                              } else {
                                addItemToCustomList(list.id, mediaInfo);
                              }
                            }}
                          >
                            <span className="popover-checkbox">
                              {inThisList && <Check size={14} color="#10b981" />}
                            </span>
                            <span className="popover-list-name">{list.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {!showQuickCreate ? (
                      <button
                        className="btn-quick-new-list"
                        onClick={() => setShowQuickCreate(true)}
                      >
                        <Plus size={14} />
                        <span>Nueva lista</span>
                      </button>
                    ) : (
                      <div className="quick-create-input-row">
                        <input
                          type="text"
                          placeholder="Nombre de lista"
                          value={quickListName}
                          onChange={(e) => setQuickListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && quickListName.trim()) {
                              const created = createCustomList({ name: quickListName.trim() });
                              if (created) addItemToCustomList(created.id, mediaInfo);
                              setQuickListName('');
                              setShowQuickCreate(false);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          className="btn-quick-create-confirm"
                          onClick={() => {
                            if (quickListName.trim()) {
                              const created = createCustomList({ name: quickListName.trim() });
                              if (created) addItemToCustomList(created.id, mediaInfo);
                              setQuickListName('');
                              setShowQuickCreate(false);
                            }
                          }}
                        >
                          Crear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn-secondary action-circle-btn share"
                onClick={handleShareClick}
                title="Compartir título"
              >
                <Share2 size={19} />
                <span>Compartir</span>
              </button>

              <button
                className={`btn-secondary action-circle-btn hide-rec-btn ${isTitleHidden(id) ? 'active-hidden' : ''}`}
                onClick={() => {
                  if (isTitleHidden(id)) {
                    unhideTitle(id);
                  } else {
                    hideTitle(mediaInfo);
                  }
                }}
                title={isTitleHidden(id) ? 'Mostrar de nuevo en recomendaciones' : 'Ocultar de recomendaciones'}
              >
                {isTitleHidden(id) ? <Eye size={19} /> : <EyeOff size={19} />}
                <span>{isTitleHidden(id) ? 'Oculto' : 'Ocultar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cast & Crew / Reparto Principal */}
      {castList && castList.length > 0 && (
        <section className="details-cast-section">
          <div className="details-section-container">
            <div className="cast-header-row">
              <h3 className="section-title">Elenco Principal</h3>
              <div className="cast-scroll-controls">
                <button
                  className="cast-arrow-btn"
                  onClick={() => handleCastScroll('left')}
                  title="Desplazar a la izquierda"
                  aria-label="Desplazar a la izquierda"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="cast-arrow-btn"
                  onClick={() => handleCastScroll('right')}
                  title="Desplazar a la derecha"
                  aria-label="Desplazar a la derecha"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="cast-grid-track" ref={castTrackRef}>
              {castList.map(actor => (
                <div key={actor.id} className="cast-card glass-panel">
                  <div className="cast-avatar-wrap">
                    {actor.avatar ? (
                      <img src={actor.avatar} alt={actor.name} className="cast-avatar-img" />
                    ) : (
                      <div className="cast-avatar-placeholder">
                        <User size={28} />
                      </div>
                    )}
                  </div>
                  <div className="cast-names">
                    <span className="actor-name" title={actor.name}>{actor.name}</span>
                    <span className="character-name" title={actor.character}>{actor.character}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Linked Franchise / Saga Banner (Harry Potter, Piratas del Caribe, etc.) */}
      {sagaInfo && sagaInfo.movies && sagaInfo.movies.length > 1 && (
        <section className="saga-franchise-section">
          <div className="saga-container glass-panel">
            <div className="saga-header">
              <Sparkles size={20} className="saga-icon" />
              <div className="saga-title-wrap">
                <h3 className="saga-title">Colección {sagaInfo.sagaTitle}</h3>
                <p className="saga-subtitle">Disfruta de todas las entregas de la franquicia en orden cronológico</p>
              </div>
            </div>

            <div className="saga-movies-track">
              {sagaInfo.movies.map((m, idx) => (
                <div
                  key={idx}
                  className="saga-movie-card"
                  onClick={() => {
                    if (m.tmdb_id) {
                      navigate(`/anime/${m.tmdb_id}`);
                    } else {
                      navigate(`/watch/${id}/${m.episode_number}`);
                    }
                  }}
                >
                  <div className="saga-movie-number">0{idx + 1}</div>
                  <div className="saga-movie-info">
                    <span className="saga-movie-name">{m.title}</span>
                    <span className="saga-movie-action">Ver entrega</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Seasons & Episodes Section (Netflix Style Horizontal Tabs) */}
      {!mediaInfo.isMovie && episodes.length > 0 && (
        <section className="details-episodes-section">
          <div className="episodes-section-header">
            <h3 className="section-title">Episodios</h3>

            {/* Horizontal Seasons Tabs */}
            {availableSeasons.length > 1 && (
              <div className="horizontal-season-tabs">
                {availableSeasons.map(s => {
                  const count = seasonsMap[s]?.length || 0;
                  return (
                    <button
                      key={s}
                      className={`season-tab-btn ${selectedSeason === s ? 'active' : ''}`}
                      onClick={() => setSelectedSeason(s)}
                    >
                      <span>Temporada {s}</span>
                      <span className="season-count-pill">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="episodes-list-grid">
            {currentSeasonEpisodes.map((ep, idx) => {
              const epProgress = itemProgress?.episodes?.[`s${ep.season || selectedSeason}_e${ep.id}`];
              return (
                <div
                  key={ep.id || idx}
                  className="episode-item-card glass-panel"
                  onClick={() => navigate(`/watch/${id}/${ep.id}?season=${ep.season || selectedSeason}`)}
                >
                  <div className="episode-thumbnail-wrap">
                    <img
                      src={mediaInfo.backdrop || mediaInfo.image}
                      alt={ep.title}
                      className="episode-thumb-img"
                    />
                    <div className="episode-play-overlay">
                      <Play size={26} fill="#fff" color="#fff" />
                    </div>
                    {epProgress && epProgress.percentage > 0 && (
                      <div className="episode-progress-bar">
                        <div
                          className="episode-progress-fill"
                          style={{ width: `${epProgress.percentage}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="episode-details">
                    <div className="episode-num-row">
                      <span className="ep-num-label">Episodio {idx + 1}</span>
                      <div className="ep-actions-right">
                        {epProgress?.completed && (
                          <span className="ep-watched-tag">✓ Visto</span>
                        )}
                        {epProgress && (
                          <button
                            className="ep-remove-watched-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEpisodeProgress(id, ep.season || selectedSeason, ep.id);
                            }}
                            title="Eliminar de vistos (1x1)"
                            aria-label="Quitar de vistos"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="episode-name-title">
                      {ep.title && !ep.title.toLowerCase().startsWith('episodio') ? ep.title : `Episodio ${idx + 1}`}
                    </h4>
                    <p className="episode-desc-snippet">
                      Reproducción fluida disponible en alta calidad con servidores en la nube.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Symmetrical Recommendations / Similares */}
      {similarTitles && similarTitles.length > 0 && (
        <section className="details-similar-section">
          <div className="details-section-container">
            <h3 className="section-title">Títulos Similares y Recomendados</h3>
            <div className="similar-cards-grid">
              {similarTitles.slice(0, 6).map((item, idx) => (
                <ContentCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  aspect="poster"
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Details;
