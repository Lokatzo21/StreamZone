import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Tv, Flame, Compass, Sparkles } from 'lucide-react';
import './BrandHubs.css';

const HUBS = [
  {
    id: 'peliculas_hub',
    title: 'Películas',
    subtitle: 'Éxitos de taquilla y cine',
    bgImage: 'https://image.tmdb.org/t/p/w780/m0eJc9CwCy5nowYQdNEaxkHHmj4.jpg',
    gradient: 'linear-gradient(135deg, rgba(229, 9, 20, 0.5) 0%, rgba(13, 17, 30, 0.95) 100%)',
    borderGlow: 'rgba(229, 9, 20, 0.45)',
    icon: Film,
    path: '/catalog?type=peliculas'
  },
  {
    id: 'series_hub',
    title: 'Series',
    subtitle: 'Temporadas y estrenos',
    bgImage: 'https://image.tmdb.org/t/p/w780/uTWhbLc7Bj4qNSdW3ZvZKL8cOHv.jpg',
    gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.5) 0%, rgba(13, 17, 30, 0.95) 100%)',
    borderGlow: 'rgba(99, 102, 241, 0.45)',
    icon: Tv,
    path: '/catalog?type=series'
  },
  {
    id: 'anime_hub',
    title: 'Anime',
    subtitle: 'Simulcasts y animación',
    bgImage: 'https://image.tmdb.org/t/p/w780/89qSKhLrJOUhp6xgbqgSTpzblbA.jpg',
    gradient: 'linear-gradient(135deg, rgba(255, 107, 0, 0.5) 0%, rgba(13, 17, 30, 0.95) 100%)',
    borderGlow: 'rgba(255, 107, 0, 0.5)',
    icon: Flame,
    path: '/catalog?type=animes'
  },
  {
    id: 'sagas_hub',
    title: 'Sagas y Franquicias',
    subtitle: 'Universos cinematográficos',
    bgImage: 'https://image.tmdb.org/t/p/w780/1RgPyOhN4DRs225BGTlHJqCudII.jpg',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(13, 17, 30, 0.95) 100%)',
    borderGlow: 'rgba(16, 185, 129, 0.45)',
    icon: Compass,
    path: '/catalog?search=saga'
  },
  {
    id: 'aclamadas_hub',
    title: 'Aclamadas',
    subtitle: 'Mejor calificadas (+8.5★)',
    bgImage: 'https://image.tmdb.org/t/p/w780/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.5) 0%, rgba(13, 17, 30, 0.95) 100%)',
    borderGlow: 'rgba(245, 158, 11, 0.5)',
    icon: Sparkles,
    path: '/catalog?sort=top'
  }
];

const BrandHubs = () => {
  const navigate = useNavigate();

  return (
    <section className="brand-hubs-section">
      <div className="brand-hubs-container">
        <div className="brand-hubs-grid">
          {HUBS.map((hub) => {
            const Icon = hub.icon;
            return (
              <div
                key={hub.id}
                className="brand-hub-card"
                onClick={() => navigate(hub.path)}
                style={{ '--hub-glow': hub.borderGlow }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(hub.path);
                }}
              >
                {/* Background Combined Artwork Image */}
                <img
                  src={hub.bgImage}
                  alt={hub.title}
                  className="hub-bg-artwork"
                  loading="lazy"
                />

                {/* Duotone Gradient Overlay */}
                <div
                  className="hub-gradient-overlay"
                  style={{ background: hub.gradient }}
                />

                <div className="hub-content">
                  <div className="hub-icon-wrap">
                    <Icon size={22} />
                  </div>
                  <div className="hub-text-wrap">
                    <span className="hub-title">{hub.title}</span>
                    <span className="hub-subtitle">{hub.subtitle}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BrandHubs;
