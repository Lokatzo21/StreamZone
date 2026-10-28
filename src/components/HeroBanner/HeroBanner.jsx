import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Info, Plus, Check, Star, Sparkles } from 'lucide-react';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import { useAuth } from '../../contexts/AuthContext';
import { getOptimizedBackdropUrl } from '../../utils/imageOptimizer';
import './HeroBanner.css';

const GENRE_TRANSLATIONS = {
  'action & adventure': 'Acción',
  'action': 'Acción',
  'adventure': 'Aventura',
  'sci-fi & fantasy': 'Ciencia Ficción',
  'science fiction': 'Ciencia Ficción',
  'war & politics': 'Bélico',
  'animation': 'Animación',
  'animación': 'Animación',
  'comedy': 'Comedia',
  'comedia': 'Comedia',
  'drama': 'Drama',
  'horror': 'Terror',
  'mystery': 'Misterio',
  'misterio': 'Misterio',
  'thriller': 'Suspenso',
  'crime': 'Crimen',
  'family': 'Familiar',
  'documentary': 'Documental',
  'romance': 'Romance',
  'western': 'Western'
};

const formatGenre = (raw) => {
  if (!raw) return '';
  const str = String(raw).trim();
  return GENRE_TRANSLATIONS[str.toLowerCase()] || str;
};

const HeroBanner = ({ featuredItems = [] }) => {
  const navigate = useNavigate();
  const { isInMyList, toggleMyList } = useWatchProgress();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-cycle through featured items every 9 seconds if not interacted
  useEffect(() => {
    if (!featuredItems || featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % featuredItems.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [featuredItems]);

  if (!featuredItems || featuredItems.length === 0) {
    return (
      <section className="hero-banner hero-skeleton-reserved">
        <div className="card-image-skeleton" />
      </section>
    );
  }

  const current = featuredItems[currentIndex] || featuredItems[0];
  const inList = isInMyList(current?.id);

  const rawBackdrop = current?.backdrop || current?.banner || current?.image;
  const backdropUrl = getOptimizedBackdropUrl(rawBackdrop);

  return (
    <section className="hero-banner">
      {/* Background Media & Cinematic Gradient Overlays */}
      <div className="hero-backdrop-container">
        <img
          key={current?.id}
          src={backdropUrl}
          alt={current?.title}
          className="hero-backdrop-img fade-in"
          loading="eager"
          decoding="async"
        />
        <div className="hero-vignette-overlay" />
        <div className="hero-bottom-gradient" />
      </div>

      {/* Main Content Info */}
      <div className="hero-content-wrapper">
        <div className="hero-content">
          {/* Top Badges */}
          <div className="hero-meta-row">
            <span className="hero-top10-badge">
              <Sparkles size={14} />
              <span>TOP 10 HOY</span>
            </span>
            <span className="hero-rating-badge">
              <Star size={14} fill="#ffb800" color="#ffb800" />
              <span>{current?.score || '8.8'}</span>
            </span>
            <span className="hero-type-badge">{current?.type || (current?.contentType === 'peliculas' ? 'Película' : 'Serie')}</span>
          </div>

          {/* Title */}
          <h1 className="hero-title">{current?.title}</h1>

          {/* Genres */}
          {current?.genres && current.genres.length > 0 && (
            <div className="hero-genres-row">
              {current.genres.slice(0, 4).map((genre, idx) => (
                <span key={idx} className="genre-pill">{formatGenre(genre)}</span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <p className="hero-description">
            {current?.description || 'Disfruta de esta increíble historia disponible en alta definición con opciones de audio y subtítulos.'}
          </p>

          {/* Action Buttons */}
          <div className="hero-actions-row">
            <button
              className="btn-primary hero-play-btn"
              onClick={() => navigate(`/watch/${current?.id}/1`)}
            >
              <Play size={22} fill="currentColor" />
              <span>Reproducir</span>
            </button>

            <button
              className="btn-secondary hero-info-btn"
              onClick={() => navigate(`/anime/${current?.id}`)}
            >
              <Info size={20} />
              <span>Más Información</span>
            </button>

            {/* Add to list - Only for logged-in users */}
            {user && (
              <button
                className={`hero-icon-action-btn ${inList ? 'in-list' : ''}`}
                onClick={() => toggleMyList(current)}
                aria-label={inList ? 'Quitar de mi lista' : 'Agregar a mi lista'}
                title={inList ? 'Quitar de mi lista' : 'Agregar a mi lista'}
              >
                {inList ? <Check size={20} /> : <Plus size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Featured Cycle Indicators */}
      {featuredItems.length > 1 && (
        <div className="hero-indicators">
          {featuredItems.slice(0, 5).map((item, idx) => (
            <button
              key={idx}
              className={`indicator-dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Ir al título ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
