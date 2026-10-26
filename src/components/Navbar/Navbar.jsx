import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X, ChevronDown, User, Shield, LogOut, Heart, Bookmark, Sparkles, EyeOff, LogIn } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown when clicking outside
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
    { to: '/', label: 'Inicio' },
    { to: '/catalog?type=peliculas', label: 'Películas' },
    { to: '/catalog?type=series', label: 'Series' },
    { to: '/catalog?type=animes', label: 'Anime' },
    { to: '/favorites', label: 'Favoritos' },
    { to: '/my-list', label: 'Mi Lista' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname + location.search === path;
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileDropdownOpen(false);
    navigate('/');
  };

  return (
    <header className={`navbar-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Left Side: Brand & Main Navigation */}
        <div className="navbar-left">
          <Link to="/" className="navbar-logo">
            <span className="logo-stream">STREAM</span>
            <span className="logo-zona">ZONA</span>
          </Link>

          <nav className="navbar-links-desktop">
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

        {/* Right Side: Search, Notifications & Profile */}
        <div className="navbar-right">
          {/* Quick Search Trigger */}
          <button
            className="nav-icon-btn search-btn"
            onClick={onOpenSearch}
            aria-label="Buscar títulos"
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

              {/* Profile Dropdown */}
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

          {/* Mobile Hamburger Button */}
          <button
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer glass-panel fade-in">
          <div className="mobile-links">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`mobile-nav-link ${isActive(link.to) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mobile-menu-footer">
            {user ? (
              <button
                className="btn-accent mobile-profile-switch"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsProfileModalOpen(true);
                }}
              >
                <User size={18} />
                <span>Cambiar Perfil ({activeProfile?.name || 'Perfil'})</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="btn-accent mobile-profile-switch"
                onClick={() => setMobileMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
              >
                <LogIn size={18} />
                <span>Iniciar Sesión / Registrarse</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
