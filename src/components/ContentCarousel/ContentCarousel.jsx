import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ContentCard from '../ContentCard/ContentCard';
import { useProfile } from '../../contexts/ProfileContext';
import './ContentCarousel.css';

const ContentCarousel = ({
  title,
  subtitle = null,
  items = [],
  viewAllLink = null,
  aspect = 'poster',
  showRank = false,
  progressMap = null,
  loading = false
}) => {
  const { isTitleHidden } = useProfile();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 55);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 55);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [items]);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const visibleItems = (items || []).filter(item => !isTitleHidden(item.id));

  if (!visibleItems || visibleItems.length === 0) {
    if (!loading) return null;
    return (
      <section className={`content-carousel-section ${showRank ? 'is-rank-carousel' : ''}`}>
        <div className="carousel-header">
          <div className="carousel-title-wrap">
            <h3 className="carousel-title">{title}</h3>
            {subtitle && <p className="carousel-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="carousel-viewport-wrapper">
          <div className="carousel-track">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="carousel-card-item">
                <div className={`content-card ${aspect}`}>
                  <div className="card-media-wrapper">
                    <div className="card-image-skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`content-carousel-section ${showRank ? 'is-rank-carousel' : ''}`}>
      <div className="carousel-header">
        <div className="carousel-title-wrap">
          <h3 className="carousel-title">{title}</h3>
          {subtitle && <p className="carousel-subtitle">{subtitle}</p>}
        </div>

        {viewAllLink && (
          <Link to={viewAllLink} className="carousel-view-all">
            <span>Ver Todo</span>
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      <div className="carousel-viewport-wrapper">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button
            className="carousel-arrow-btn left"
            onClick={() => handleScroll('left')}
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Scrollable Track */}
        <div className="carousel-track" ref={scrollRef}>
          {visibleItems.map((item, idx) => {
            const itemProgress = progressMap ? progressMap[String(item.id)] : null;
            return (
              <div key={item.id || idx} className="carousel-card-item">
                <ContentCard
                  item={item}
                  aspect={aspect}
                  rank={showRank ? idx + 1 : null}
                  progress={itemProgress}
                />
              </div>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button
            className="carousel-arrow-btn right"
            onClick={() => handleScroll('right')}
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </section>
  );
};

export default ContentCarousel;
