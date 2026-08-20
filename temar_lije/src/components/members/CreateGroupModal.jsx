import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Check, Users, Sparkles } from 'lucide-react';
import './CreateGroupModal.css';
import { API_BASE_URL } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';

const AVAILABLE_ICONS = ['📚', '🚀', '🔥', '💡', '🧪', '🎨', '⚡', '🏆', '🦋', '⚛️', '🎯', '👥'];
const AVAILABLE_COLORS = [
  { value: '#6366f1', name: 'indigo' },
  { value: '#0d9488', name: 'teal' },
  { value: '#06b6d4', name: 'cyan' },
  { value: '#8b5cf6', name: 'violet' },
  { value: '#be185d', name: 'pink' },
  { value: '#f59e0b', name: 'amber' },
];

const FALLBACK_MEMBERS = [
  { id: '44444444-4444-4444-8444-444444444444', name: 'Abebe Tadesse', initials: 'AT', avatarBg: '#8b5cf6', role: 'STUDENT' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'Meron Haile', initials: 'MH', avatarBg: '#f97316', role: 'STUDENT' },
  { id: '66666666-6666-4666-8666-666666666666', name: 'Yonas Bekele', initials: 'YB', avatarBg: '#0d9488', role: 'STUDENT' },
  { id: '77777777-7777-4777-8777-777777777777', name: 'Tigist Alemu', initials: 'TA', avatarBg: '#a855f7', role: 'STUDENT' },
  { id: '88888888-8888-4888-8888-888888888888', name: 'Hana Tesfaye', initials: 'HT', avatarBg: '#ec4899', role: 'STUDENT' },
];

export default function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
  onCreate,
  classroomId = 'current-class-uuid',
}) {
  const { accessToken } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📚');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [classmates, setClassmates] = useState(FALLBACK_MEMBERS);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch classroom members when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setLoading(true);

    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const targetClassId = classroomId || 'current-class-uuid';
    fetch(`${API_BASE_URL}/classrooms/${targetClassId}/members`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((m) => ({
            id: m.id,
            name: m.name || m.fullName || 'Classmate',
            initials: m.initials || (m.name || m.fullName || 'U').slice(0, 2).toUpperCase(),
            avatarBg: m.avatarBg || '#3b82f6',
            role: m.role || 'STUDENT',
          }));
          setClassmates(mapped);
          // Pre-select first 3 members by default if none selected
          setSelectedMemberIds(mapped.slice(0, 3).map((m) => m.id));
        } else {
          setClassmates(FALLBACK_MEMBERS);
          setSelectedMemberIds(FALLBACK_MEMBERS.slice(0, 3).map((m) => m.id));
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch classroom members, using fallbacks:', err);
        setClassmates(FALLBACK_MEMBERS);
        setSelectedMemberIds(FALLBACK_MEMBERS.slice(0, 3).map((m) => m.id));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, classroomId, accessToken]);

  if (!isOpen) return null;

  const handleToggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!groupName.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      name: groupName.trim(),
      classroomId: classroomId || 'current-class-uuid',
      memberIds: selectedMemberIds,
      icon: selectedIcon,
      colorAccent: selectedColor,
      color: selectedColor,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      // Primary API Request: POST /study-groups
      let res = await fetch(`${API_BASE_URL}/study-groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      // Fallback endpoint if /study-groups returns 404
      if (res.status === 404) {
        res = await fetch(`${API_BASE_URL}/chat/groups`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: payload.name,
            icon: payload.icon,
            color: payload.colorAccent,
            memberIds: payload.memberIds,
          }),
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed with status ${res.status}`);
      }

      const createdGroup = await res.json();

      // Reset state
      setGroupName('');
      setSelectedIcon('📚');
      setSelectedColor('#6366f1');

      // Trigger callbacks
      if (onGroupCreated) onGroupCreated(createdGroup);
      if (onCreate) onCreate(createdGroup);
      onClose();
    } catch (err) {
      console.error('Study group creation error:', err);
      setError(err.message || 'Failed to create study group');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="create-group-modal-overlay" onClick={onClose}>
      <div className="create-group-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-group-header">
          <div className="create-group-header-text">
            <h2>Create Study Group</h2>
            <p>Start a private group chat for project assignments, topics, or peer study.</p>
          </div>
          <button type="button" className="modal-close-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Group Name Input */}
          <div className="create-group-field">
            <label className="field-label">Group Name *</label>
            <input
              type="text"
              placeholder="e.g. Flutter Project Group 1"
              className="create-group-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Icon & Color Accent Pickers */}
          <div className="pickers-row">
            <div className="create-group-field" style={{ marginBottom: 0 }}>
              <label className="field-label">Icon Accent</label>
              <div className="icon-picker-grid">
                {AVAILABLE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`icon-btn ${selectedIcon === icon ? 'selected' : ''}`}
                    onClick={() => setSelectedIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="create-group-field" style={{ marginBottom: 0 }}>
              <label className="field-label">Color</label>
              <div className="color-picker-list">
                {AVAILABLE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`color-dot-btn ${selectedColor === c.value ? 'selected' : ''}`}
                    style={{ backgroundColor: c.value, '--color-dot-accent': c.value }}
                    onClick={() => setSelectedColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Classmate Selector */}
          <div className="create-group-field" style={{ marginTop: '16px' }}>
            <label className="field-label">
              <span>Select Classmates</span>
              <span>({selectedMemberIds.length} selected)</span>
            </label>
            <div className="members-checklist-box">
              {loading ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                  Loading classmates...
                </div>
              ) : (
                classmates.map((member) => {
                  const isChecked = selectedMemberIds.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      className={`member-check-row ${isChecked ? 'selected' : ''}`}
                      onClick={() => handleToggleMember(member.id)}
                    >
                      <div
                        className="member-avatar-circle"
                        style={{ backgroundColor: member.avatarBg || '#3b82f6' }}
                      >
                        {member.initials}
                      </div>
                      <div className="member-info-col">
                        <span className="member-name">{member.name}</span>
                        <span className="member-role">{member.role === 'TEACHER' ? 'Teacher' : 'Student'}</span>
                      </div>
                      <div className="custom-checkbox">
                        {isChecked && <Check size={12} strokeWidth={3.5} color="white" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="modal-actions-footer">
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-submit"
              disabled={!groupName.trim() || submitting}
            >
              {submitting ? 'Creating...' : `Create Group (${selectedMemberIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
