import React, { useState } from 'react';
import { X, EyeOff, RotateCcw, Trash2, Search, Plus, Film, Check } from 'lucide-react';
import { useProfile } from '../../contexts/ProfileContext';
import { api } from '../../services/api';
import './HiddenTitlesModal.css';

const HiddenTitlesModal = () => {
  const {
    activeProfile,
    isHiddenModalOpen,
    setIsHiddenModalOpen,
    hiddenTitles,
    hideTitle,
    unhideTitle,
    clearAllHidden
  } = useProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  if (!isHiddenModalOpen) return null;

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await api.searchAnime(q.trim());
      setSearchResults(res.slice(0, 5));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleHideFromSearch = (item) => {
    hideTitle(item);
    setSearchQuery('');
    setSearchResults([]);
    setSuccessToast(`"${item.title}" ahora está oculto.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleUnhide = (id, title) => {
    unhideTitle(id);
    setSuccessToast(`"${title}" restaurado.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="hidden-modal-backdrop" onClick={() => setIsHiddenModalOpen(false)}>
      <div className="hidden-modal-dialog glass-panel fade-in" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button
          className="modal-close-btn"
          onClick={() => setIsHiddenModalOpen(false)}
          aria-label="Cerrar modal"
        >
          <X size={22} />
        </button>

        {/* Modal Header */}
        <div className="hidden-modal-header">
          <div className="hidden-modal-icon-wrap">
            <EyeOff size={24} />
          </div>
          <div className="hidden-modal-header-text">
            <h2 className="hidden-modal-title">Títulos Ocultos</h2>
            <p className="hidden-modal-subtitle">
              Gestiona las recomendaciones ocultas de tu perfil (<strong>{activeProfile?.name}</strong>). Los títulos ocultos no aparecerán en carruseles ni listas públicas.
            </p>
          </div>
        </div>

        {/* Quick Search & Add Box */}
        <div className="hidden-search-box">
          <div className="hidden-search-input-wrap">
            <Search size={18} className="hidden-search-icon" />
            <input
              type="text"
              placeholder="Buscar título para ocultarlo de recomendaciones..."
              value={searchQuery}
              onChange={handleSearch}
              className="hidden-search-input"
            />
            {searchQuery && (
              <button className="hidden-clear-search" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="hidden-search-dropdown glass-panel">
              {searchResults.map((item) => (
                <div key={item.id} className="hidden-search-item">
                  <img
                    src={item.image || 'https://via.placeholder.com/60x90'}
                    alt={item.title}
                    className="hidden-item-thumb"
                  />
                  <div className="hidden-item-info">
                    <span className="hidden-item-title">{item.title}</span>
                    <span className="hidden-item-type">{item.type || 'Contenido'}</span>
                  </div>
                  <button
                    className="btn-accent-sm hide-action-btn"
                    onClick={() => handleHideFromSearch(item)}
                  >
                    <EyeOff size={14} />
                    <span>Ocultar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toast Feedback */}
        {successToast && (
          <div className="hidden-toast-alert glass-panel fade-in">
            <Check size={16} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Hidden Titles Content Area */}
        <div className="hidden-list-container">
          {hiddenTitles.length === 0 ? (
            <div className="hidden-empty-state">
              <div className="empty-icon-circle">
                <EyeOff size={38} />
              </div>
              <h4>No tienes títulos ocultos</h4>
              <p>
                Para ocultar una película, serie o anime que no desees ver, haz clic en el icono del ojo tachado sobre la carátula o en su página de detalle.
              </p>
            </div>
          ) : (
            <div className="hidden-cards-grid">
              {hiddenTitles.map((item) => (
                <div key={item.id} className="hidden-item-row glass-panel">
                  <img
                    src={item.image || 'https://via.placeholder.com/60x90'}
                    alt={item.title}
                    className="hidden-row-thumb"
                  />
                  <div className="hidden-row-meta">
                    <h5 className="hidden-row-title">{item.title}</h5>
                    <span className="hidden-row-badge">{item.type || 'Contenido'}</span>
                  </div>
                  <button
                    className="btn-secondary-sm restore-btn"
                    onClick={() => handleUnhide(item.id, item.title)}
                    title="Mostrar en recomendaciones"
                  >
                    <RotateCcw size={14} />
                    <span>Restaurar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="hidden-modal-footer">
          {hiddenTitles.length > 0 && (
            <button
              className="btn-danger-ghost"
              onClick={() => {
                if (confirm('¿Deseas restaurar todos los títulos ocultos?')) {
                  clearAllHidden();
                  setSuccessToast('Todos los títulos fueron restaurados.');
                  setTimeout(() => setSuccessToast(null), 3000);
                }
              }}
            >
              <RotateCcw size={15} />
              <span>Restaurar todos</span>
            </button>
          )}
          <button
            className="btn-accent"
            onClick={() => setIsHiddenModalOpen(false)}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export default HiddenTitlesModal;
