import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, UserPlus, X, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthRequiredModal.css';

const AuthRequiredModal = () => {
  const navigate = useNavigate();
  const { isAuthModalOpen, closeAuthModal, authModalReason } = useAuth();

  if (!isAuthModalOpen) return null;

  const handleGoLogin = (mode = 'login') => {
    closeAuthModal();
    navigate(mode === 'register' ? '/login?mode=register' : '/login');
  };

  return (
    <div className="auth-modal-backdrop fade-in" onClick={closeAuthModal}>
      <div className="auth-modal-card glass-panel" onClick={e => e.stopPropagation()}>
        <button
          className="auth-modal-close"
          onClick={closeAuthModal}
          aria-label="Cerrar ventana"
        >
          <X size={20} />
        </button>

        <div className="auth-modal-icon-wrap">
          <div className="auth-icon-glow" />
          <Lock size={32} className="auth-modal-icon" />
        </div>

        <h3 className="auth-modal-title">Inicia Sesión para Continuar</h3>
        
        <p className="auth-modal-desc">
          {authModalReason || 'Para guardar tus películas y series en Favoritos, crear listas personalizadas o continuar viendo donde lo dejaste, necesitas tener una cuenta.'}
        </p>

        <div className="auth-modal-actions">
          <button
            className="btn-accent auth-modal-btn login-btn"
            onClick={() => handleGoLogin('login')}
          >
            <LogIn size={18} />
            <span>Iniciar Sesión</span>
          </button>

          <button
            className="btn-secondary auth-modal-btn register-btn"
            onClick={() => handleGoLogin('register')}
          >
            <UserPlus size={18} />
            <span>Crear Cuenta Gratis</span>
          </button>
        </div>

        <button className="auth-modal-cancel" onClick={closeAuthModal}>
          Seguir explorando como invitado
        </button>
      </div>
    </div>
  );
};

export default AuthRequiredModal;
