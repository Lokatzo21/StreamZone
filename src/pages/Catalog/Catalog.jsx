import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Sparkles, Grid, SlidersHorizontal, ChevronDown } from 'lucide-react';
import ContentCard from '../../components/ContentCard/ContentCard';
import { api, TMDB_GENRES } from '../../services/api';
import './Catalog.css';

const CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'peliculas', label: 'Películas' },
  { id: 'series', label: 'Series' },
  { id: 'animes', label: 'Anime' },
];

const GENRES_LIST = [
  'Todos',
  'Animación',
  'Action & Adventure',
  'Sci-Fi & Fantasy',
  'Comedia',
  'Drama',
  'Misterio'
];

const SORT_OPTIONS = [
  { id: 'popular', label: 'Más Populares' },
  { id: 'score', label: 'Mejor Puntuados' },
  { id: 'title', label: 'Título (A - Z)' },
];

const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'todos';
  const initialSearch = searchParams.get('search') || '';

  const [activeType, setActiveType] = useState(initialType);
  const [activeGenre, setActiveGenre] = useState('Todos');
  const [activeSort, setActiveSort] = useState('popular');
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Sync state with URL params
  useEffect(() => {
    const urlType = searchParams.get('type');
    const urlSearch = searchParams.get('search');
    if (urlType && urlType !== activeType) setActiveType(urlType);
    if (urlSearch !== null && urlSearch !== searchQuery) setSearchQuery(urlSearch);
  }, [searchParams]);

  const loadData = async (resetPage = false) => {
    try {
      setLoading(true);
      const currentPage = resetPage ? 1 : page;

      let fetchedItems = [];
      if (searchQuery.trim()) {
        fetchedItems = await api.searchCatalog(searchQuery.trim(), activeType, activeGenre);
      } else {
        fetchedItems = await api.getDiscoverAnime(currentPage, activeGenre, activeType);
      }

      // Sort items
      let sorted = [...fetchedItems];
      if (activeSort === 'score') {
        sorted.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
      } else if (activeSort === 'title') {
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }

      if (resetPage || currentPage === 1) {
        setItems(sorted);
      } else {
        setItems(prev => [...prev, ...sorted]);
      }

      setHasMore(fetchedItems.length >= 15);
    } catch (err) {
      console.error('Error loading catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData(true);
  }, [activeType, activeGenre, activeSort, searchQuery]);

  const handleTypeChange = (typeId) => {
    setActiveType(typeId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('type', typeId);
      return next;
    });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(false);
  };

  return (
    <div className="catalog-page-container">
      {/* Catalog Header Banner */}
      <div className="catalog-header-section">
        <div className="catalog-header-content">
          <span className="catalog-eyebrow">Explorar Catálogo</span>
          <h1 className="catalog-main-title">
            {activeType === 'peliculas' && 'Películas y Sagas'}
            {activeType === 'series' && 'Series de Televisión'}
            {activeType === 'animes' && 'Anime y Animación Japonesa'}
            {activeType === 'todos' && 'Todo el Contenido'}
          </h1>
          <p className="catalog-description">
            Descubre miles de horas de entretenimiento en calidad ultra alta, disponible en audio latino, castellano y subtitulado.
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="catalog-filters-sticky-bar">
        <div className="catalog-filters-container">
          {/* Main Category Pills */}
          <div className="category-pills-row">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`category-pill ${activeType === cat.id ? 'active' : ''}`}
                onClick={() => handleTypeChange(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Secondary Filters: Genre and Sorting */}
          <div className="secondary-filters-row">
            {/* Genre Dropdown */}
            <div className="filter-dropdown-wrap">
              <label className="filter-label">Género:</label>
              <select
                className="filter-select"
                value={activeGenre}
                onChange={e => setActiveGenre(e.target.value)}
              >
                {GENRES_LIST.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div className="filter-dropdown-wrap">
              <label className="filter-label">Ordenar por:</label>
              <select
                className="filter-select"
                value={activeSort}
                onChange={e => setActiveSort(e.target.value)}
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      <div className="catalog-grid-container">
        {loading && items.length === 0 && (
          <div className="catalog-loading-state">
            <div className="player-spinner" />
            <span>Cargando catálogo...</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="catalog-empty-state glass-panel">
            <h3>No se encontraron resultados</h3>
            <p>Prueba seleccionando otra categoría o limpiando los filtros actuales.</p>
            <button
              className="btn-accent"
              onClick={() => {
                setActiveType('todos');
                setActiveGenre('Todos');
                setSearchQuery('');
              }}
            >
              Restablecer Filtros
            </button>
          </div>
        )}

        <div className="catalog-cards-grid">
          {items.map((item, idx) => (
            <ContentCard
              key={`${item.id}-${idx}`}
              item={item}
              aspect="poster"
            />
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="catalog-load-more-wrap">
            <button className="btn-secondary load-more-btn" onClick={handleLoadMore}>
              Cargar Más Títulos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Catalog;
