import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, UserPlus, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegistering) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        alert('Cuenta creada con éxito. Ya puedes iniciar sesión.');
        setIsRegistering(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Error en la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-dialog glass-panel fade-in">
        <Link to="/" className="login-back-btn">
          <ArrowLeft size={16} />
          <span>Volver al Inicio</span>
        </Link>

        <div className="login-header">
          <h2 className="login-title">
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>
          <p className="login-subtitle">
            {isRegistering
              ? 'Regístrate para sincronizar tus listas y progreso en la nube.'
              : 'Accede a tus perfiles y continúa disfrutando de tus series.'}
          </p>
        </div>

        {errorMsg && (
          <div className="login-error-alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-field-group">
            <label className="field-label">Correo Electrónico</label>
            <div className="input-wrap">
              <Mail size={18} className="field-icon" />
              <input
                type="email"
                className="field-input"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="input-field-group">
            <label className="field-label">Contraseña</label>
            <div className="input-wrap">
              <Lock size={18} className="field-icon" />
              <input
                type="password"
                className="field-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-accent login-submit-btn" disabled={loading}>
            {loading ? (
              <span>Cargando...</span>
            ) : isRegistering ? (
              <>
                <UserPlus size={18} />
                <span>Registrarme</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>

        <div className="login-toggle-row">
          <span>{isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta todavía?'}</span>
          <button
            type="button"
            className="toggle-auth-btn"
            onClick={() => {
              setIsRegistering(prev => !prev);
              setErrorMsg('');
            }}
          >
            {isRegistering ? 'Inicia Sesión' : 'Crea una gratis'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
