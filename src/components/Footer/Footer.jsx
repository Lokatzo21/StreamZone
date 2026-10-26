import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="stream-footer">
      <div className="footer-container">
        <div className="footer-top-row">
          <div className="footer-brand">
            <span className="footer-logo">STREAM<span className="accent">ZONE</span></span>
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
            © {new Date().getFullYear()} StreamZone. Diseñado con arquitectura de alto rendimiento.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
