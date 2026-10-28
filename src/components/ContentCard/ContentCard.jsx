import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Star, CheckCircle2, EyeOff, Heart } from 'lucide-react';
import { useProfile } from '../../contexts/ProfileContext';
import { useWatchProgress } from '../../contexts/WatchProgressContext';
import { useAuth } from '../../contexts/AuthContext';
import { getOptimizedPosterUrl, getOptimizedBackdropUrl } from '../../utils/imageOptimizer';
import './ContentCard.css';

const ContentCard = ({
  item,
  rank = null,
  progress = null,
  aspect = 'poster' // 'poster' (2:3) or 'backdrop' (16:9)
}) => {
  const navigate = useNavigate();
  const { hideTitle, isTitleHidden } = useProfile();
  const { isFavorite, toggleFavorite } = useWatchProgress();
  const { user, requireAuth } = useAuth();

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [isHidingAnim, setIsHidingAnim] = useState(false);

  const targetId = item?.id || item?.anime_tmdb_id || item?.tmdb_id;
  const isFav = targetId ? isFavorite(targetId) : false;

  // Optimized poster or backdrop resolution with WPO WebP
  const rawUrl = aspect === 'backdrop'
    ? (item?.backdrop || item?.banner || item?.image)
    : (item?.image || item?.backdrop || item?.banner);

  const imageUrl = aspect === 'backdrop'
    ? getOptimizedBackdropUrl(rawUrl)
    : getOptimizedPosterUrl(rawUrl, 500);

  const fallbackUrl = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22450%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%230f1424%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23475569%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20font-weight%3D%22bold%22%20text-anchor%3D%22middle%22%3EStreamzona%3C%2Ftext%3E%3C%2Fsvg%3E';

  // Safety fallback for Smart TVs (Roku / Samsung Tizen) where onLoad in horizontal carousels can be delayed or swallowed
  useEffect(() => {
    if (imgLoaded) return;
    const timer = setTimeout(() => {
      setImgLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [imageUrl, imgLoaded]);

  if (!item || isTitleHidden(item.id)) return null;

  const handleCardClick = () => {
    if (showHideConfirm) return;
    navigate(`/anime/${item.id}`);
  };

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(item);
  };

  const handleOpenConfirm = (e) => {
    e.stopPropagation();
    if (!requireAuth(() => setShowHideConfirm(true), 'Inicia sesión para personalizar tus recomendaciones.')) {
      return;
    }
    setShowHideConfirm(true);
  };

  const handleConfirmHide = (e) => {
    e.stopPropagation();
    setIsHidingAnim(true);
    setTimeout(() => {
      hideTitle(item);
    }, 320);
  };

  const handleCancelHide = (e) => {
    e.stopPropagation();
    setShowHideConfirm(false);
  };

  const isCompleted = progress && (progress.completed || progress.percentage >= 90);

  return (
    <div
      className={`content-card ${aspect} ${rank ? 'has-rank' : ''} ${isHovered ? 'hover-active' : ''} ${isHidingAnim ? 'card-collapsing' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (showHideConfirm) setShowHideConfirm(false);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCardClick();
      }}
    >
      {/* Layout Flow (Split into Rank Badge and Main Content Column when ranked) */}
      <div className={`card-inner-flow ${rank ? 'with-rank-layout' : ''}`}>
        {/* Optional Top 10 Rank Number (Netflix style) */}
        {rank && (
          <div className={`card-rank-badge-box ${rank >= 10 ? 'double-digit' : ''}`}>
            <span className={`card-rank-number ${rank >= 10 ? 'double-digit' : ''}`}>{rank}</span>
          </div>
        )}

        <div className="card-main-content-box">
          <div className="card-media-wrapper">
            {/* Skeleton Shimmer Placeholder */}
            {!imgLoaded && !imgError && (
              <div className="card-image-skeleton" />
            )}

            <img
              ref={(el) => {
                if (el && el.complete && !imgLoaded) {
                  setImgLoaded(true);
                }
              }}
              src={imgError ? fallbackUrl : (imageUrl || fallbackUrl)}
              alt={item.title || 'Contenido'}
              className={`card-media-img ${imgLoaded ? 'loaded' : 'loading'}`}
              loading={rank ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                if (!imgError) {
                  setImgError(true);
                  setImgLoaded(true);
                }
              }}
            />

            {/* Score & Completed Badges */}
            <div className="card-top-badges">
              {item.score && item.score !== 'N/A' && (
                <span className="card-badge score">
                  <Star size={11} fill="#ffb800" color="#ffb800" />
                  <span>{item.score}</span>
                </span>
              )}
              {isCompleted && (
                <span className="card-badge watched">
                  <CheckCircle2 size={11} />
                  <span>Visto</span>
                </span>
              )}
            </div>

            {/* Card Action Buttons: Favorites (Heart) & Hide (EyeOff) - STRICTLY AUTHENTICATED */}
            {user && !showHideConfirm && (
              <div className="card-top-actions" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className={`card-action-btn fav-btn ${isFav ? 'active' : ''} ${isHovered ? 'visible' : ''}`}
                  onClick={handleToggleFavorite}
                  title={isFav ? 'Quitar de Favoritos' : 'Guardar en Favoritos'}
                  aria-label="Guardar en Favoritos"
                >
                  <Heart
                    size={15}
                    fill={isFav ? '#ff2a5f' : 'none'}
                    color={isFav ? '#ff2a5f' : 'currentColor'}
                    style={{ pointerEvents: 'none' }}
                  />
                </button>

                <button
                  type="button"
                  className={`card-action-btn hide-btn ${isHovered ? 'visible' : ''}`}
                  onClick={handleOpenConfirm}
                  title="Ocultar recomendación"
                  aria-label="Ocultar recomendación"
                >
                  <EyeOff size={13} style={{ pointerEvents: 'none' }} />
                </button>
              </div>
            )}

            {/* In-Card Confirmation Overlay */}
            {showHideConfirm && (
              <div className="card-hide-confirm-overlay fade-in" onClick={e => e.stopPropagation()}>
                <EyeOff size={24} className="confirm-eye-icon" />
                <span className="confirm-hide-title">¿Ocultar título?</span>
                <span className="confirm-hide-sub">No volverá a recomendarse</span>
                <div className="confirm-hide-actions">
                  <button className="confirm-btn-yes" onClick={handleConfirmHide}>
                    Ocultar
                  </button>
                  <button className="confirm-btn-no" onClick={handleCancelHide}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Continue Watching Progress Bar (Netflix red line) */}
            {progress && progress.percentage > 0 && (
              <div className="card-progress-bar-wrap">
                <div
                  className={`card-progress-bar-fill ${isCompleted ? 'completed' : ''}`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            )}

            {/* Sleek, Clean Glass Play Indicator on Hover (Apple TV+ / HBO Max style) */}
            <div className={`card-hover-play-badge ${isHovered ? 'visible' : ''}`}>
              <div className="card-play-glass-disc">
                <Play size={20} fill="#fff" color="#fff" />
              </div>
            </div>
          </div>

          {/* Symmetrical Title Label Underneath */}
          <div className="card-bottom-label">
            <h5 className="card-title-text">{item.title}</h5>
            <div className="card-sub-info-row">
              <span className="card-sub-type">{item.type || (item.contentType === 'peliculas' ? 'Película' : 'Serie')}</span>
              {progress ? (
                <span className="card-sub-progress">
                  {progress.percentage}% visto
                </span>
              ) : item.genres && item.genres.length > 0 ? (
                <span className="card-sub-genre">{item.genres[0]}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCard;
