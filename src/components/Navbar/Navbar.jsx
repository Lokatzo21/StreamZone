import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Menu,
  X,
  ChevronDown,
  User,
  Shield,
  LogOut,
  Heart,
  Bookmark,
  Sparkles,
  EyeOff,
  LogIn,
  Film,
  Tv,
  Home,
  Compass
} from 'lucide-react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import './Navbar.css';

const Navbar = ({ onOpenSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeProfile,
    setIsProfileModalOpen,
    setIsHiddenModalOpen,
    hiddenTitles
  } = useProfile();
  const { user, signOut, isAdmin } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Close sidebar and profile dropdown on route change
  useEffect(() => {
    setSidebarOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname, location.search]);

  // Lock body scroll when sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Smart Sticky Header scroll tracking (Hide on scroll down, show on scroll up)
  useEffect(() => {
    let ticking = false;
    let prevScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(currentScrollY > 25);

          // Top of the page: always visible
          if (currentScrollY <= 40) {
            setShowHeader(true);
          }
          // Scrolled down past threshold: hide
          else if (currentScrollY > prevScrollY + 8 && currentScrollY > 70) {
            setShowHeader(false);
          }
          // Scrolled up: show
          else if (currentScrollY < prevScrollY - 8) {
            setShowHeader(true);
          }

          prevScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close desktop profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const navLinks = [
    { to: '/', label: 'Inicio', icon: Home },
    { to: '/catalog?type=peliculas', label: 'Películas', icon: Film },
    { to: '/catalog?type=series', label: 'Series', icon: Tv },
    { to: '/catalog?type=animes', label: 'Anime', icon: Sparkles },
    { to: '/favorites', label: 'Favoritos', icon: Heart },
    { to: '/my-list', label: 'Mi Lista', icon: Bookmark },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname + location.search === path;
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileDropdownOpen(false);
    setSidebarOpen(false);
    navigate('/');
  };

  return (
    <>
      {/* Smart Sticky Header */}
      <header
        className={`navbar-header ${scrolled ? 'scrolled' : ''} ${showHeader ? 'header-visible' : 'header-hidden'}`}
      >
        <div className="navbar-container">
          {/* Mobile Hamburger Trigger (Left on mobile, min 48x48px target) */}
          <button
            className="mobile-hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú de navegación"
            title="Menú"
          >
            <Menu size={24} />
          </button>

          {/* Left Side: Brand & Desktop Navigation */}
          <div className="navbar-left">
            <Link to="/" className="navbar-logo" aria-label="Streamzona Inicio">
              <span className="logo-stream">STREAM</span>
              <span className="logo-zona">ZONA</span>
            </Link>

            <nav className="navbar-links-desktop" aria-label="Navegación principal">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Side: Search & User Controls */}
          <div className="navbar-right">
            {/* Desktop & Mobile Quick Search Trigger */}
            <button
              className="nav-icon-btn search-btn"
              onClick={onOpenSearch}
              aria-label="Buscar películas, series y anime"
              title="Buscar (Presiona / o haz clic)"
            >
              <Search size={20} />
              <span className="search-hint">Buscar títulos...</span>
            </button>

            {/* User Profile Menu (Logged in) OR Iniciar Sesión (Guest) */}
            {user ? (
              <div className="profile-menu-wrapper" ref={profileMenuRef}>
                <button
                  className="profile-btn"
                  onClick={() => setProfileDropdownOpen(prev => !prev)}
                  aria-label="Menú de perfil"
                >
                  <img
                    src={activeProfile?.avatar || '/avatars/1.webp'}
                    alt={activeProfile?.name || 'Perfil'}
                    className="profile-avatar-img"
                  />
                  <span className="profile-name-label">{activeProfile?.name || 'Mi Perfil'}</span>
                  <ChevronDown size={16} className={`chevron-icon ${profileDropdownOpen ? 'open' : ''}`} />
                </button>

                {/* Profile Dropdown (Desktop) */}
                {profileDropdownOpen && (
                  <div className="profile-dropdown glass-panel fade-in">
                    <div className="dropdown-header">
                      <img
                        src={activeProfile?.avatar || '/avatars/1.webp'}
                        alt={activeProfile?.name}
                        className="dropdown-avatar"
                      />
                      <div className="dropdown-user-info">
                        <p className="dropdown-user-name">{activeProfile?.name || 'Mi Perfil'}</p>
                        <p className="dropdown-user-role">{user.email}</p>
                      </div>
                    </div>

                    <div className="dropdown-divider" />

                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                    >
                      <User size={18} />
                      <span>Cambiar de Perfil</span>
                    </button>

                    <Link
                      to="/favorites"
                      className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Heart size={18} />
                      <span>Mis Favoritos</span>
                    </Link>

                    <Link
                      to="/my-list"
                      className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Bookmark size={18} />
                      <span>Mi Lista y Continuar Viendo</span>
                    </Link>

                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setIsHiddenModalOpen(true);
                      }}
                    >
                      <EyeOff size={18} />
                      <span style={{ flex: 1, textAlign: 'left' }}>Títulos Ocultos</span>
                      {hiddenTitles && hiddenTitles.length > 0 && (
                        <span className="dropdown-counter-pill">{hiddenTitles.length}</span>
                      )}
                    </button>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <Shield size={18} />
                        <span>Panel Administrador</span>
                      </Link>
                    )}

                    <div className="dropdown-divider" />

                    <button className="dropdown-item logout" onClick={handleSignOut}>
                      <LogOut size={18} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="navbar-guest-actions">
                <Link to="/login" className="btn-nav-login" title="Iniciar sesión o registrarte">
                  <LogIn size={16} />
                  <span>Iniciar Sesión</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Off-Canvas Sidebar Drawer for Mobile & Tablet */}
      <div
        className={`offcanvas-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={`offcanvas-sidebar-drawer ${sidebarOpen ? 'open' : ''}`}
        aria-label="Menú lateral de navegación"
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar-inner-content">
          {/* Drawer Header */}
          <div className="sidebar-header">
            <Link to="/" className="navbar-logo" onClick={() => setSidebarOpen(false)}>
              <span className="logo-stream">STREAM</span>
              <span className="logo-zona">ZONA</span>
            </Link>
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
            >
              <X size={24} />
            </button>
          </div>

          {/* User Profile Card in Drawer */}
          <div className="sidebar-profile-card">
            {user ? (
              <div className="sidebar-user-info">
                <img
                  src={activeProfile?.avatar || '/avatars/1.webp'}
                  alt={activeProfile?.name || 'Perfil'}
                  className="sidebar-avatar"
                />
                <div className="sidebar-user-text">
                  <span className="sidebar-user-name">{activeProfile?.name || 'Mi Perfil'}</span>
                  <span className="sidebar-user-email">{user.email}</span>
                </div>
                <button
                  className="sidebar-profile-switch-btn"
                  onClick={() => {
                    setSidebarOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  title="Cambiar perfil"
                >
                  <User size={16} />
                </button>
              </div>
            ) : (
              <div className="sidebar-guest-card">
                <div className="guest-card-icon">
                  <User size={22} />
                </div>
                <div className="guest-card-text">
                  <span className="guest-title">Invitado</span>
                  <span className="guest-subtitle">Accede para guardar tu lista y favoritos</span>
                </div>
                <Link
                  to="/login"
                  className="sidebar-login-btn"
                  onClick={() => setSidebarOpen(false)}
                >
                  <LogIn size={15} />
                  <span>Acceder</span>
                </Link>
              </div>
            )}
          </div>

          {/* Navigation Links with Icons */}
          <div className="sidebar-section-title">Explorar</div>
          <nav className="sidebar-nav-list">
            <Link
              to="/"
              className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Home size={20} />
              </div>
              <span className="sidebar-item-label">Inicio</span>
            </Link>

            <Link
              to="/catalog?type=peliculas"
              className={`sidebar-nav-item ${isActive('/catalog?type=peliculas') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Film size={20} />
              </div>
              <span className="sidebar-item-label">Películas</span>
            </Link>

            <Link
              to="/catalog?type=series"
              className={`sidebar-nav-item ${isActive('/catalog?type=series') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Tv size={20} />
              </div>
              <span className="sidebar-item-label">Series</span>
            </Link>

            <Link
              to="/catalog?type=animes"
              className={`sidebar-nav-item ${isActive('/catalog?type=animes') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Sparkles size={20} />
              </div>
              <span className="sidebar-item-label">Anime</span>
            </Link>
          </nav>

          <div className="sidebar-section-title">Mi Espacio</div>
          <nav className="sidebar-nav-list">
            <Link
              to="/favorites"
              className={`sidebar-nav-item ${isActive('/favorites') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Heart size={20} />
              </div>
              <span className="sidebar-item-label">Favoritos</span>
            </Link>

            <Link
              to="/my-list"
              className={`sidebar-nav-item ${isActive('/my-list') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <div className="sidebar-item-icon">
                <Bookmark size={20} />
              </div>
              <span className="sidebar-item-label">Mi Lista & Historial</span>
            </Link>

            {user && (
              <button
                className="sidebar-nav-item btn-action"
                onClick={() => {
                  setSidebarOpen(false);
                  setIsHiddenModalOpen(true);
                }}
              >
                <div className="sidebar-item-icon">
                  <EyeOff size={20} />
                </div>
                <span className="sidebar-item-label" style={{ flex: 1, textAlign: 'left' }}>Títulos Ocultos</span>
                {hiddenTitles && hiddenTitles.length > 0 && (
                  <span className="sidebar-counter-pill">{hiddenTitles.length}</span>
                )}
              </button>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                className={`sidebar-nav-item admin-link ${isActive('/admin') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <div className="sidebar-item-icon">
                  <Shield size={20} />
                </div>
                <span className="sidebar-item-label">Panel Administrador</span>
              </Link>
            )}
          </nav>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            {user ? (
              <button className="sidebar-logout-btn" onClick={handleSignOut}>
                <LogOut size={18} />
                <span>Cerrar Sesión</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="sidebar-full-login-btn"
                onClick={() => setSidebarOpen(false)}
              >
                <LogIn size={18} />
                <span>Iniciar Sesión / Registrarse</span>
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Navbar;