import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Star, Film, Tv, Play, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import './SearchModal.css';

const SearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('todos');

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
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
    }, 280);

    return () => clearTimeout(timer);
  }, [query, filterType]);

  if (!isOpen) return null;

  const handleSelect = (item) => {
    onClose();
    navigate(`/anime/${item.id}`);
  };

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div className="search-modal-dialog glass-panel fade-in" onClick={e => e.stopPropagation()}>
        {/* Search Input Bar */}
        <div className="search-input-header">
          <Search size={22} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Buscar por título, saga, personaje o género..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-search-btn" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
          <button className="close-modal-btn" onClick={onClose}>
            ESC
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
              className={`search-filter-pill ${filterType === f.id ? 'active' : ''}`}
              onClick={() => setFilterType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="search-results-area">
          {loading && (
            <div className="search-status-box">
              <div className="search-spinner" />
              <span>Buscando en el catálogo...</span>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="search-results-grid">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="search-result-card"
                  onClick={() => handleSelect(item)}
                >
                  <img
                    src={item.image || item.backdrop || 'https://via.placeholder.com/200x300'}
                    alt={item.title}
                    className="search-card-poster"
                  />
                  <div className="search-card-info">
                    <span className="search-card-type">{item.type || 'Contenido'}</span>
                    <h4 className="search-card-title">{item.title}</h4>
                    <div className="search-card-meta">
                      {item.score && (
                        <span className="search-card-score">
                          <Star size={11} fill="#ffb800" color="#ffb800" />
                          <span>{item.score}</span>
                        </span>
                      )}
                      <span>{item.totalEpisodes ? `${item.totalEpisodes} Eps` : '1 Ep'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="search-empty-state">
              <p>No se encontraron resultados para "<strong>{query}</strong>"</p>
              <span>Intenta buscar con otro término o categoría.</span>
            </div>
          )}

          {!query && (
            <div className="search-suggestions-state">
              <span className="suggestions-label">Búsquedas populares</span>
              <div className="suggestions-tags">
                {['Harry Potter', 'Piratas del Caribe', 'The Walking Dead', 'Solo Leveling', 'Jujutsu Kaisen', 'Arma Mortal', 'Silo'].map(tag => (
                  <button
                    key={tag}
                    className="tag-pill"
                    onClick={() => setQuery(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
