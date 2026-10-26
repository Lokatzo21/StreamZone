import React, { useState } from 'react';
import { X, Plus, Edit2, Check, Trash2, Shield, User } from 'lucide-react';
import { useProfile } from '../../contexts/ProfileContext';
import './ProfileModal.css';

const ProfileModal = () => {
  const {
    profiles,
    activeProfileId,
    switchProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    isProfileModalOpen,
    setIsProfileModalOpen,
    availableAvatars
  } = useProfile();

  const [isManaging, setIsManaging] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('/avatars/1.webp');
  const [isKidInput, setIsKidInput] = useState(false);

  if (!isProfileModalOpen) return null;

  const handleStartCreate = () => {
    setNameInput('');
    setSelectedAvatar(availableAvatars[profiles.length % availableAvatars.length]);
    setIsKidInput(false);
    setIsCreating(true);
    setEditingProfile(null);
  };

  const handleStartEdit = (profile, e) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setNameInput(profile.name);
    setSelectedAvatar(profile.avatar);
    setIsKidInput(profile.isKid || false);
    setIsCreating(false);
  };

  const handleSaveCreate = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const newProf = addProfile({
      name: nameInput.trim(),
      avatar: selectedAvatar,
      isKid: isKidInput
    });
    setIsCreating(false);
    switchProfile(newProf.id);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingProfile || !nameInput.trim()) return;
    updateProfile(editingProfile.id, {
      name: nameInput.trim(),
      avatar: selectedAvatar,
      isKid: isKidInput
    });
    setEditingProfile(null);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este perfil?')) {
      deleteProfile(id);
      setEditingProfile(null);
    }
  };

  return (
    <div className="profile-modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
      <div className="profile-modal-dialog glass-panel fade-in" onClick={e => e.stopPropagation()}>
        <button
          className="modal-close-btn"
          onClick={() => setIsProfileModalOpen(false)}
          aria-label="Cerrar modal"
        >
          <X size={22} />
        </button>

        {/* View Mode: Profiles Selection */}
        {!isCreating && !editingProfile && (
          <div className="modal-content-wrap">
            <h2 className="modal-title">¿Quién está viendo?</h2>
            <p className="modal-subtitle">Selecciona tu perfil para acceder a tus listas y recomendaciones</p>

            <div className="profiles-grid">
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    className={`profile-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (!isManaging) {
                        switchProfile(p.id);
                      }
                    }}
                  >
                    <div className="avatar-wrap">
                      <img src={p.avatar} alt={p.name} className="profile-card-img" />
                      {isManaging && (
                        <button
                          className="edit-badge-btn"
                          onClick={(e) => handleStartEdit(p, e)}
                          title="Editar perfil"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isActive && !isManaging && (
                        <div className="active-badge-indicator">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <span className="profile-card-name">{p.name}</span>
                    {p.isKid && <span className="profile-kid-badge">Niños</span>}
                  </div>
                );
              })}

              {/* Add Profile Card */}
              {profiles.length < 5 && (
                <div className="profile-card add-card" onClick={handleStartCreate}>
                  <div className="avatar-wrap add-icon-wrap">
                    <Plus size={36} />
                  </div>
                  <span className="profile-card-name">Añadir Perfil</span>
                </div>
              )}
            </div>

            <div className="modal-bottom-actions">
              <button
                className="btn-secondary manage-profiles-btn"
                onClick={() => setIsManaging(prev => !prev)}
              >
                {isManaging ? 'Listo' : 'Administrar Perfiles'}
              </button>
            </div>
          </div>
        )}

        {/* Create / Edit Profile Form */}
        {(isCreating || editingProfile) && (
          <form className="profile-edit-form" onSubmit={isCreating ? handleSaveCreate : handleSaveEdit}>
            <h3 className="modal-title">
              {isCreating ? 'Crear Nuevo Perfil' : 'Editar Perfil'}
            </h3>

            <div className="avatar-selector-section">
              <p className="selector-label">Elige un avatar</p>
              <div className="avatars-picker-grid">
                {availableAvatars.map((av, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={`avatar-choice-btn ${selectedAvatar === av ? 'chosen' : ''}`}
                    onClick={() => setSelectedAvatar(av)}
                  >
                    <img src={av} alt={`Avatar ${idx + 1}`} className="avatar-choice-img" />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="profileName" className="form-label">Nombre del perfil</label>
              <input
                id="profileName"
                type="text"
                className="form-input"
                placeholder="Nombre"
                maxLength={20}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                required
                autoFocus
              />
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isKidInput}
                onChange={e => setIsKidInput(e.target.checked)}
              />
              <span>¿Es un perfil para niños? (Filtra contenido maduro)</span>
            </label>

            <div className="form-actions-row">
              <button type="submit" className="btn-accent">
                Guardar
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsCreating(false);
                  setEditingProfile(null);
                }}
              >
                Cancelar
              </button>

              {editingProfile && profiles.length > 1 && (
                <button
                  type="button"
                  className="btn-secondary delete-profile-btn"
                  onClick={(e) => handleDelete(editingProfile.id, e)}
                  title="Eliminar este perfil"
                >
                  <Trash2 size={16} />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
