import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className="stream-footer">
      <div className="footer-container">
        <div className="footer-top-row">
          <div className="footer-brand">
            <span className="footer-logo">STREAM<span className="accent">ZONA</span></span>
            <p className="footer-tagline">
              La experiencia definitiva de streaming en alta definición para películas, series y anime.
            </p>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <h4>Navegación</h4>
              <Link to="/">Inicio</Link>
              <Link to="/catalog?type=series">Series</Link>
              <Link to="/catalog?type=peliculas">Películas</Link>
              <Link to="/catalog?type=animes">Anime</Link>
              <Link to="/my-list">Mi Lista</Link>
            </div>
          </div>
        </div>

        <div className="footer-divider" />

        <div className="footer-bottom-row">
          <p className="footer-copyright">
            © {new Date().getFullYear()} Streamzona. Diseñado con arquitectura de alto rendimiento.
          </p>

          <button
            type="button"
            className="footer-scroll-top-btn"
            onClick={handleScrollToTop}
            aria-label="Volver arriba"
            title="Volver arriba"
          >
            <span>Volver arriba</span>
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
