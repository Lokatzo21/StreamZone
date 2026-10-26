import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bookmark, Clock, Heart, Play, Trash2, CheckCircle2,
  AlertTriangle, History, ArrowRight, FolderPlus, Plus, X, Film
} from 'lucide-react';
import ContentCard from '../../components/ContentCard/ContentCard';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import './MyList.css';

const MyList = ({ defaultTab = 'mylist' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    myList,
    continueWatchingList,
    watchedHistoryList,
    favorites,
    removeProgress,
    removeEpisodeProgress,
    clearAllHistory,
    customLists,
    createCustomList,
    deleteCustomList,
    removeItemFromCustomList
  } = useWatchProgress();

  const getInitialTab = () => {
    if (location.pathname === '/favorites') return 'favorites';
    const params = new URLSearchParams(location.search);
    return params.get('tab') || defaultTab;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    if (location.pathname === '/favorites') {
      setActiveTab('favorites');
    } else if (location.pathname === '/my-list' && !location.search) {
      setActiveTab(defaultTab || 'mylist');
    }
  }, [location.pathname, location.search, defaultTab]);
  const [selectedCustomListId, setSelectedCustomListId] = useState(customLists[0]?.id || null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  const handleCreateList = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const created = createCustomList({
      name: newListName.trim(),
      description: newListDesc.trim()
    });
    setNewListName('');
    setNewListDesc('');
    setShowCreateModal(false);
    if (created) setSelectedCustomListId(created.id);
  };

  const activeCustomList = customLists.find(l => l.id === selectedCustomListId) || customLists[0] || null;

  const handleClearAllConfirm = () => {
    clearAllHistory();
    setShowClearConfirm(false);
  };

  return (
    <div className="mylist-page-container">
      <div className="mylist-header-section">
        <h1 className="mylist-main-title">Mi Espacio Personal</h1>
        <p className="mylist-subtitle">
          Tus títulos guardados, historial de reproducción y series favoritas en un solo lugar.
        </p>

        {/* Navigation Tabs */}
        <div className="mylist-tabs-row">
          <button
            className={`tab-btn ${activeTab === 'mylist' ? 'active' : ''}`}
            onClick={() => setActiveTab('mylist')}
          >
            <Bookmark size={17} />
            <span>Mi Lista ({myList.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'continue' ? 'active' : ''}`}
            onClick={() => setActiveTab('continue')}
          >
            <Clock size={17} />
            <span>Continuar Viendo ({continueWatchingList.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={17} />
            <span>Historial de Vistos ({watchedHistoryList.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Heart size={17} />
            <span>Favoritos ({favorites.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <FolderPlus size={17} />
            <span>Listas Personalizadas ({customLists.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mylist-content-container">
        {/* TAB 1: Mi Lista */}
        {activeTab === 'mylist' && (
          <div>
            {myList.length === 0 ? (
              <div className="mylist-empty-state glass-panel">
                <Bookmark size={40} className="empty-icon" />
                <h3>Tu lista está vacía</h3>
                <p>Explora el catálogo y presiona el botón '+' para guardar películas y series para ver más tarde.</p>
                <button className="btn-accent" onClick={() => navigate('/catalog')}>
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              <div className="mylist-grid">
                {myList.map(item => (
                  <ContentCard key={item.id} item={item} aspect="poster" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Continuar Viendo */}
        {activeTab === 'continue' && (
          <div>
            {continueWatchingList.length === 0 ? (
              <div className="mylist-empty-state glass-panel">
                <Clock size={40} className="empty-icon" />
                <h3>No hay reproducciones pendientes</h3>
                <p>Cuando empieces a reproducir cualquier título, aparecerá aquí con tu minuto exacto para que continúes sin perder el hilo.</p>
                <button className="btn-accent" onClick={() => navigate('/catalog')}>
                  Descubrir Qué Ver
                </button>
              </div>
            ) : (
              <div className="mylist-grid backdrop-mode">
                {continueWatchingList.map(item => (
                  <div key={item.animeId} className="continue-watching-card glass-panel">
                    <div className="continue-thumb-wrap">
                      <img
                        src={item.banner || item.image}
                        alt={item.animeTitle}
                        className="continue-thumb-img"
                      />
                      <button
                        className="continue-play-circle"
                        onClick={() => navigate(`/watch/${item.animeId}/${item.lastEpisodeId}?season=${item.lastSeasonNumber || 1}`)}
                        title="Reanudar reproducción"
                      >
                        <Play size={22} fill="currentColor" />
                      </button>
                      <div className="continue-progress-bar">
                        <div
                          className="continue-progress-fill"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="continue-card-meta">
                      <div className="meta-left">
                        <h4 className="continue-card-title">{item.animeTitle}</h4>
                        <span className="continue-card-ep">
                          {item.lastEpisodeTitle || `Episodio ${item.lastEpisodeId}`} • {item.percentage}%
                        </span>
                      </div>
                      <button
                        className="remove-continue-btn"
                        onClick={() => removeProgress(item.animeId)}
                        title="Eliminar de la lista"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Historial de Vistos (1x1 deletion & Clear All) */}
        {activeTab === 'history' && (
          <div>
            {watchedHistoryList.length === 0 ? (
              <div className="mylist-empty-state glass-panel">
                <History size={40} className="empty-icon" />
                <h3>No tienes historial de visualización</h3>
                <p>A medida que veas episodios o películas, tu registro completo aparecerá aquí.</p>
                <button className="btn-accent" onClick={() => navigate('/catalog')}>
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              <div className="history-section-wrapper">
                {/* Header with Global "Borrar Todo el Historial" Button */}
                <div className="history-control-bar glass-panel">
                  <div className="history-summary">
                    <span className="history-count-badge">
                      {watchedHistoryList.length} registros guardados
                    </span>
                    <p className="history-hint">
                      Gestiona tus reproducciones: elimina episodios individuales (1 a 1) o vacía el historial completo.
                    </p>
                  </div>

                  <button
                    className="clear-all-history-btn"
                    onClick={() => setShowClearConfirm(true)}
                    title="Eliminar todos los registros"
                  >
                    <Trash2 size={16} />
                    <span>Borrar todo el historial</span>
                  </button>
                </div>

                {/* 1x1 Watched Episodes Grid */}
                <div className="mylist-grid backdrop-mode">
                  {watchedHistoryList.map(item => (
                    <div
                      key={`${item.animeId}-s${item.seasonNumber}-e${item.episodeId}`}
                      className="continue-watching-card history-card glass-panel"
                    >
                      <div className="continue-thumb-wrap">
                        <img
                          src={item.banner || item.image}
                          alt={item.animeTitle}
                          className="continue-thumb-img"
                        />
                        <button
                          className="continue-play-circle"
                          onClick={() => navigate(`/watch/${item.animeId}/${item.episodeId}?season=${item.seasonNumber}`)}
                          title="Volver a reproducir"
                        >
                          <Play size={22} fill="currentColor" />
                        </button>

                        {/* Watched Badge */}
                        <div className="history-status-badge">
                          {item.completed ? (
                            <span className="badge-watched">
                              <CheckCircle2 size={12} />
                              <span>Visto</span>
                            </span>
                          ) : (
                            <span className="badge-progress">
                              {item.percentage}%
                            </span>
                          )}
                        </div>

                        <div className="continue-progress-bar">
                          <div
                            className={`continue-progress-fill ${item.completed ? 'completed' : ''}`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="continue-card-meta">
                        <div className="meta-left">
                          <h4 className="continue-card-title">{item.animeTitle}</h4>
                          <span className="continue-card-ep">
                            T{item.seasonNumber}: {item.episodeTitle}
                          </span>
                        </div>

                        {/* 1x1 Delete Button */}
                        <button
                          className="remove-continue-btn"
                          onClick={() => removeEpisodeProgress(item.animeId, item.seasonNumber, item.episodeId)}
                          title="Eliminar este episodio del historial (1x1)"
                          aria-label="Eliminar episodio de vistos"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Favoritos */}
        {activeTab === 'favorites' && (
          <div>
            {favorites.length === 0 ? (
              <div className="mylist-empty-state glass-panel">
                <Heart size={40} className="empty-icon fav" />
                <h3>No has marcado favoritos aún</h3>
                <p>Haz clic en el corazón de cualquier ficha para añadir tus obras preferidas a tu colección personal.</p>
                <button className="btn-accent" onClick={() => navigate('/catalog')}>
                  Explorar Títulos
                </button>
              </div>
            ) : (
              <div className="mylist-grid">
                {favorites.map(item => (
                  <ContentCard key={item.id} item={item} aspect="poster" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Listas Personalizadas */}
        {activeTab === 'custom' && (
          <div className="custom-lists-tab-view fade-in">
            {/* Top Toolbar: Sub-tabs and New List Button */}
            <div className="custom-lists-toolbar glass-panel">
              <div className="custom-lists-chips-track">
                {customLists.map(list => (
                  <button
                    key={list.id}
                    className={`custom-list-chip ${activeCustomList?.id === list.id ? 'active' : ''}`}
                    onClick={() => setSelectedCustomListId(list.id)}
                  >
                    <FolderPlus size={15} />
                    <span>{list.name}</span>
                    <span className="chip-badge">{list.items?.length || 0}</span>
                  </button>
                ))}
              </div>

              <button
                className="btn-create-list-trigger"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} />
                <span>Nueva Lista</span>
              </button>
            </div>

            {/* Selected Custom List View */}
            {activeCustomList ? (
              <div className="active-custom-list-section">
                <div className="custom-list-details-bar glass-panel">
                  <div className="custom-list-info-block">
                    <h3 className="custom-list-name">{activeCustomList.name}</h3>
                    {activeCustomList.description && (
                      <p className="custom-list-description">{activeCustomList.description}</p>
                    )}
                    <span className="custom-list-meta-count">
                      {activeCustomList.items?.length || 0} {activeCustomList.items?.length === 1 ? 'título guardado' : 'títulos guardados'}
                    </span>
                  </div>

                  {customLists.length > 1 && (
                    <button
                      className="btn-delete-custom-list"
                      onClick={() => {
                        if (window.confirm(`¿Seguro que deseas eliminar la lista "${activeCustomList.name}"?`)) {
                          deleteCustomList(activeCustomList.id);
                          const remaining = customLists.filter(l => l.id !== activeCustomList.id);
                          if (remaining.length > 0) setSelectedCustomListId(remaining[0].id);
                        }
                      }}
                      title="Eliminar esta lista"
                    >
                      <Trash2 size={16} />
                      <span>Eliminar Lista</span>
                    </button>
                  )}
                </div>

                {(!activeCustomList.items || activeCustomList.items.length === 0) ? (
                  <div className="mylist-empty-state glass-panel">
                    <Film size={40} className="empty-icon" />
                    <h3>Esta lista está vacía</h3>
                    <p>Agrega películas, series o animes a <strong>"{activeCustomList.name}"</strong> desde la ficha de detalles de cualquier título con el botón "+ Lista".</p>
                    <button className="btn-accent" onClick={() => navigate('/catalog')}>
                      Explorar Catálogo
                    </button>
                  </div>
                ) : (
                  <div className="mylist-grid">
                    {activeCustomList.items.map(item => (
                      <div key={item.id} className="custom-list-item-wrapper">
                        <ContentCard item={item} aspect="poster" />
                        <button
                          className="btn-remove-from-custom-list"
                          onClick={() => removeItemFromCustomList(activeCustomList.id, item.id)}
                          title="Quitar de esta lista"
                          aria-label="Quitar de esta lista"
                        >
                          <Trash2 size={14} />
                          <span>Quitar de lista</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mylist-empty-state glass-panel">
                <FolderPlus size={40} className="empty-icon" />
                <h3>No tienes listas personalizadas</h3>
                <p>Crea listas temáticas como "Películas de Terror", "Maratón Anime", etc.</p>
                <button className="btn-accent" onClick={() => setShowCreateModal(true)}>
                  <Plus size={16} />
                  <span>Crear mi primera lista</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Custom List Modal */}
      {showCreateModal && (
        <div className="custom-list-modal-backdrop fade-in" onClick={() => setShowCreateModal(false)}>
          <div className="custom-list-modal-card glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-top-header">
              <div className="modal-title-wrap">
                <FolderPlus size={22} className="modal-top-icon" />
                <h3>Crear Nueva Lista</h3>
              </div>
              <button className="modal-close-x" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="create-list-form">
              <div className="form-field-group">
                <label htmlFor="custom-list-name-input">Nombre de la lista *</label>
                <input
                  id="custom-list-name-input"
                  type="text"
                  required
                  placeholder="ej. Maratón del Domingo, Joyas Ocultas..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="custom-list-desc-input">Descripción (opcional)</label>
                <textarea
                  id="custom-list-desc-input"
                  rows={3}
                  placeholder="ej. Películas y series recomendadas para disfrutar con amigos."
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn-accent">
                  Crear Lista
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear All History */}
      {showClearConfirm && (
        <div className="clear-confirm-modal-overlay fade-in">
          <div className="clear-confirm-modal glass-panel">
            <div className="modal-icon-wrap">
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 className="modal-title">¿Borrar todo el historial?</h3>
            <p className="modal-desc">
              Esta acción eliminará todos los registros de episodios y minutos vistos de tu perfil. Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions-row">
              <button
                className="btn-modal-danger"
                onClick={handleClearAllConfirm}
              >
                Sí, borrar todo el historial
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyList;
