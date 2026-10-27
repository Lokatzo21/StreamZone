import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Star, Sparkles, Clock, Trash2, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import './SearchModal.css';

const TRENDING_TAGS = [
  'Harry Potter',
  'Piratas del Caribe',
  'The Walking Dead',
  'Solo Leveling',
  'Jujutsu Kaisen',
  'Arma Mortal',
  'Silo',
  'Reacher',
  'Bleach'
];

const SearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('todos');
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('streamzona_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      setRecentSearches([]);
    }
  }, [isOpen]);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    try {
      const updated = [clean, ...recentSearches.filter(s => s.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      setRecentSearches(updated);
      localStorage.setItem('streamzona_recent_searches', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('streamzona_recent_searches');
    } catch {
      // Ignore storage errors
    }
  };

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 70);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchCatalog(query.trim(), filterType);
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [query, filterType]);

  if (!isOpen) return null;

  const handleSelect = (item) => {
    saveRecentSearch(item.title);
    onClose();
    navigate(`/anime/${item.id}`);
  };

  const handleTagClick = (tag) => {
    setQuery(tag);
    saveRecentSearch(tag);
  };

  return (
    <div className="search-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="search-modal-dialog glass-panel fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar (Sticky & Mobile-Optimized) */}
        <div className="search-input-header">
          <button
            type="button"
            className="search-back-mobile-btn"
            onClick={onClose}
            aria-label="Regresar"
          >
            <ArrowLeft size={22} />
          </button>

          <Search size={22} className="search-icon" />

          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            className="search-input"
            placeholder="Buscar películas, series, anime..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                saveRecentSearch(query);
              }
            }}
          />

          {query && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Borrar texto"
            >
              <X size={18} />
            </button>
          )}

          {/* Desktop Escape pill */}
          <button
            type="button"
            className="close-modal-btn desktop-only"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ESC
          </button>

          {/* Mobile Explicit "Cancelar" button */}
          <button
            type="button"
            className="cancel-search-btn mobile-only"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>

        {/* Filter Pills */}
        <div className="search-filters-row">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'peliculas', label: 'Películas' },
            { id: 'series', label: 'Series' },
            { id: 'animes', label: 'Anime' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              className={`search-filter-pill ${filterType === f.id ? 'active' : ''}`}
              onClick={() => setFilterType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results / Suggestions Container */}
        <div className="search-results-area">
          {loading && (
            <div className="search-status-box">
              <div className="search-spinner" />
              <span>Buscando en Streamzona...</span>
            </div>
          )}

          {/* Live Search Results */}
          {!loading && results.length > 0 && (
            <div className="search-results-grid">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="search-result-card"
                  onClick={() => handleSelect(item)}
                >
                  <div className="search-card-poster-wrap">
                    <img
                      src={item.image || item.backdrop || 'https://via.placeholder.com/200x300'}
                      alt={item.title}
                      className="search-card-poster"
                      loading="lazy"
                    />
                    {item.type && (
                      <span className="search-card-badge">{item.type}</span>
                    )}
                  </div>
                  <div className="search-card-info">
                    <h4 className="search-card-title">{item.title}</h4>
                    <div className="search-card-meta">
                      {item.score && (
                        <span className="search-card-score">
                          <Star size={12} fill="#ffb800" color="#ffb800" />
                          <span>{item.score}</span>
                        </span>
                      )}
                      <span>{item.totalEpisodes ? `${item.totalEpisodes} Eps` : 'Película'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && query && results.length === 0 && (
            <div className="search-empty-state">
              <p>No se encontraron resultados para "<strong>{query}</strong>"</p>
              <span>Intenta buscar con otro nombre, género o palabra clave.</span>
            </div>
          )}

          {/* Suggestions & Recent Searches before typing */}
          {!query && (
            <div className="search-suggestions-container">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="recent-searches-block">
                  <div className="section-title-row">
                    <div className="title-left">
                      <Clock size={16} />
                      <span className="suggestions-label">Búsquedas recientes</span>
                    </div>
                    <button
                      type="button"
                      className="clear-recent-btn"
                      onClick={clearRecentSearches}
                      title="Borrar historial reciente"
                    >
                      <Trash2 size={14} />
                      <span>Limpiar</span>
                    </button>
                  </div>
                  <div className="suggestions-tags">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        className="tag-pill recent-tag"
                        onClick={() => handleTagClick(term)}
                      >
                        <Clock size={12} />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular & Trending Searches */}
              <div className="trending-searches-block">
                <div className="section-title-row">
                  <div className="title-left">
                    <Sparkles size={16} className="sparkle-icon" />
                    <span className="suggestions-label">Tendencias en Streamzona</span>
                  </div>
                </div>
                <div className="suggestions-tags">
                  {TRENDING_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="tag-pill"
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;