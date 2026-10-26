import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Database, PlusCircle, CheckCircle,
  Trash2, Edit3, ArrowLeft, Layers, Film, Search, Sparkles
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { api, TMDB_GENRES } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Admin.css';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('custom_titles'); // 'custom_titles', 'db_episodes'
  const [customList, setCustomList] = useState([]);
  const [dbEpisodesCount, setDbEpisodesCount] = useState(0);
  const [dbEpisodesSample, setDbEpisodesSample] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Form state for creating / editing custom title
  const [formState, setFormState] = useState({
    id: '',
    title: '',
    image: '',
    banner: '',
    description: '',
    total_episodes: 12,
    status: 'En emisión',
    is_secret: false,
    genres: ['Animación']
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'custom_titles') {
        const { data } = await supabase
          .from('custom_animes')
          .select('*')
          .order('created_at', { ascending: false });
        setCustomList(data || []);
      } else if (activeTab === 'db_episodes') {
        const { count } = await supabase
          .from('anime_episodes')
          .select('*', { count: 'exact', head: true });
        setDbEpisodesCount(count || 0);

        const { data: sample } = await supabase
          .from('anime_episodes')
          .select('id, anime_tmdb_id, search_title, episode_name, episode_number, season_number, server_name, language, created_at')
          .order('id', { ascending: false })
          .limit(50);
        setDbEpisodesSample(sample || []);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustom = async (e) => {
    e.preventDefault();
    if (!formState.title.trim()) return;

    try {
      const record = {
        title: formState.title.trim(),
        image: formState.image.trim(),
        banner: formState.banner.trim(),
        description: formState.description.trim(),
        total_episodes: Number(formState.total_episodes) || 1,
        status: formState.status,
        is_secret: Boolean(formState.is_secret),
        genres: formState.genres,
        updated_at: new Date().toISOString()
      };

      if (isEditing && formState.id) {
        await supabase.from('custom_animes').update(record).eq('id', formState.id);
        setStatusMsg('Título actualizado correctamente en Supabase.');
      } else {
        const newId = `custom-${Date.now()}`;
        await supabase.from('custom_animes').insert([{ id: newId, ...record }]);
        setStatusMsg('Nuevo título creado con éxito.');
      }

      resetForm();
      loadAdminData();
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      console.error('Error saving custom anime:', err);
      alert('Error guardando en la base de datos: ' + err.message);
    }
  };

  const handleEditClick = (item) => {
    setFormState({
      id: item.id,
      title: item.title || '',
      image: item.image || '',
      banner: item.banner || '',
      description: item.description || '',
      total_episodes: item.total_episodes || 1,
      status: item.status || 'En emisión',
      is_secret: Boolean(item.is_secret),
      genres: Array.isArray(item.genres) ? item.genres : ['Animación']
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este título de Supabase?')) return;
    try {
      await supabase.from('custom_animes').delete().eq('id', id);
      loadAdminData();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const resetForm = () => {
    setFormState({
      id: '',
      title: '',
      image: '',
      banner: '',
      description: '',
      total_episodes: 12,
      status: 'En emisión',
      is_secret: false,
      genres: ['Animación']
    });
    setIsEditing(false);
  };

  if (!isAdmin) {
    return (
      <div className="admin-page-container">
        <div className="admin-unauthorized-card glass-panel" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '520px', margin: '80px auto' }}>
          <ShieldAlert size={54} color="#ef4444" style={{ margin: '0 auto 16px auto', display: 'block' }} />
          <h2 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '8px' }}>Acceso Restringido</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Esta área está reservada exclusivamente para cuentas de administradores autorizados.
          </p>
          <button className="btn-accent" onClick={() => navigate('/')}>
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-title">Panel de Control & Catálogo</h1>
          <p className="admin-subtitle">Administra títulos personalizados y explora la base de datos de streaming.</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Volver al Inicio</span>
        </button>
      </div>

      {statusMsg && (
        <div className="admin-alert-banner fade-in">
          <CheckCircle size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="admin-tabs-row">
        <button
          className={`admin-tab-btn ${activeTab === 'custom_titles' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom_titles')}
        >
          <Layers size={18} />
          <span>Títulos Personalizados ({customList.length})</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'db_episodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('db_episodes')}
        >
          <Database size={18} />
          <span>Biblioteca de Servidores en la Nube ({dbEpisodesCount})</span>
        </button>
      </div>

      {/* TAB 1: Custom Titles Management */}
      {activeTab === 'custom_titles' && (
        <div className="admin-tab-content">
          {/* Form */}
          <form className="admin-form-panel glass-panel" onSubmit={handleSaveCustom}>
            <h3 className="form-heading">
              {isEditing ? `Editar: ${formState.title}` : 'Añadir Nuevo Título al Catálogo'}
            </h3>

            <div className="form-grid-inputs">
              <div className="form-col">
                <label className="input-label">Título</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Ej: Piratas del Caribe, Reacher, etc."
                  value={formState.title}
                  onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-col">
                <label className="input-label">URL de Carátula (Poster)</label>
                <input
                  type="url"
                  className="admin-input"
                  placeholder="https://..."
                  value={formState.image}
                  onChange={e => setFormState(prev => ({ ...prev, image: e.target.value }))}
                />
              </div>

              <div className="form-col">
                <label className="input-label">URL de Banner / Fondo</label>
                <input
                  type="url"
                  className="admin-input"
                  placeholder="https://..."
                  value={formState.banner}
                  onChange={e => setFormState(prev => ({ ...prev, banner: e.target.value }))}
                />
              </div>

              <div className="form-col">
                <label className="input-label">Total Episodios (1 para Película)</label>
                <input
                  type="number"
                  min="1"
                  className="admin-input"
                  value={formState.total_episodes}
                  onChange={e => setFormState(prev => ({ ...prev, total_episodes: e.target.value }))}
                />
              </div>

              <div className="form-col full-width">
                <label className="input-label">Sinopsis / Descripción</label>
                <textarea
                  rows="3"
                  className="admin-input textarea"
                  placeholder="Descripción de la trama..."
                  value={formState.description}
                  onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-footer-buttons">
              <button type="submit" className="btn-accent">
                {isEditing ? 'Actualizar Título' : 'Guardar en Catálogo'}
              </button>
              {isEditing && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {/* List of custom items */}
          <div className="custom-items-list-section">
            <h3 className="section-title">Títulos Registrados en Supabase</h3>
            <div className="custom-items-grid">
              {customList.map((item) => (
                <div key={item.id} className="custom-item-card glass-panel">
                  <img
                    src={item.image || 'https://via.placeholder.com/200x300'}
                    alt={item.title}
                    className="custom-item-thumb"
                  />
                  <div className="custom-item-details">
                    <h4 className="item-title">{item.title}</h4>
                    <span className="item-meta">
                      {item.total_episodes === 1 ? 'Película' : `${item.total_episodes} Eps`} • {item.status}
                    </span>
                    <p className="item-desc">{item.description || 'Sin descripción'}</p>

                    <div className="item-actions">
                      <button
                        className="btn-secondary edit-btn"
                        onClick={() => handleEditClick(item)}
                      >
                        <Edit3 size={15} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn-secondary delete-btn"
                        onClick={() => handleDeleteClick(item.id)}
                      >
                        <Trash2 size={15} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Database Library Inspector */}
      {activeTab === 'db_episodes' && (
        <div className="admin-tab-content">
          <div className="db-stats-card glass-panel">
            <h3 className="stats-heading">Estado de la Base de Datos en Supabase</h3>
            <p className="stats-metric">
              Total de servidores y episodios registrados: <strong>{dbEpisodesCount}</strong>
            </p>
          </div>

          <div className="table-wrapper glass-panel">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título / Saga</th>
                  <th>Episodio</th>
                  <th>Temporada</th>
                  <th>Servidor</th>
                  <th>Idioma</th>
                  <th>TMDB ID</th>
                </tr>
              </thead>
              <tbody>
                {dbEpisodesSample.map((ep) => (
                  <tr key={ep.id}>
                    <td>#{ep.id}</td>
                    <td className="table-title-cell">{ep.search_title}</td>
                    <td>{ep.episode_name || `Ep ${ep.episode_number}`}</td>
                    <td>T{ep.season_number || 1}</td>
                    <td><span className="srv-tag">{ep.server_name}</span></td>
                    <td>{ep.language || 'SUB'}</td>
                    <td>{ep.anime_tmdb_id || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
