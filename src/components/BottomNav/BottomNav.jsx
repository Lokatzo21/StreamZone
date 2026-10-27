import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Home, Compass, Search, Bookmark, User, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import './BottomNav.css';

const BottomNav = ({ onOpenSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile, setIsProfileModalOpen } = useProfile();

  // Hide BottomNav on theater watch page
  if (location.pathname.startsWith('/watch/')) return null;

  const currentPath = location.pathname;

  const handleProfileClick = () => {
    if (user) {
      setIsProfileModalOpen(true);
    } else {
      navigate('/login');
    }
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación inferior móvil">
      <div className="bottom-nav-container">
        {/* Tab 1: Inicio */}
        <Link
          to="/"
          className={`bottom-nav-item ${currentPath === '/' ? 'active' : ''}`}
          aria-label="Ir a Inicio"
        >
          <div className="bottom-nav-icon-wrap">
            <Home size={22} />
          </div>
          <span className="bottom-nav-label">Inicio</span>
        </Link>

        {/* Tab 2: Explorar Catálogo */}
        <Link
          to="/catalog"
          className={`bottom-nav-item ${currentPath === '/catalog' ? 'active' : ''}`}
          aria-label="Explorar Catálogo"
        >
          <div className="bottom-nav-icon-wrap">
            <Compass size={22} />
          </div>
          <span className="bottom-nav-label">Explorar</span>
        </Link>

        {/* Tab 3: Buscar (Abre Fullscreen Search) */}
        <button
          type="button"
          className="bottom-nav-item search-tab-btn"
          onClick={onOpenSearch}
          aria-label="Buscar títulos"
        >
          <div className="bottom-nav-icon-wrap">
            <Search size={22} />
          </div>
          <span className="bottom-nav-label">Buscar</span>
        </button>

        {/* Tab 4: Mi Espacio / Favoritos */}
        <Link
          to="/my-list"
          className={`bottom-nav-item ${currentPath === '/my-list' || currentPath === '/favorites' ? 'active' : ''}`}
          aria-label="Ir a Mi Lista"
        >
          <div className="bottom-nav-icon-wrap">
            <Bookmark size={22} />
          </div>
          <span className="bottom-nav-label">Mi Espacio</span>
        </Link>

        {/* Tab 5: Cuenta / Perfil */}
        <button
          type="button"
          className={`bottom-nav-item profile-tab-btn ${currentPath === '/login' ? 'active' : ''}`}
          onClick={handleProfileClick}
          aria-label={user ? 'Mi Perfil' : 'Iniciar Sesión'}
        >
          <div className="bottom-nav-icon-wrap">
            {user ? (
              <img
                src={activeProfile?.avatar || '/avatars/1.webp'}
                alt={activeProfile?.name || 'Perfil'}
                className="bottom-nav-avatar"
              />
            ) : (
              <LogIn size={22} />
            )}
          </div>
          <span className="bottom-nav-label">{user ? (activeProfile?.name || 'Perfil') : 'Acceder'}</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
