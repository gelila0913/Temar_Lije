import React, { useState } from 'react';
import { Check } from 'lucide-react';
import './create_group.css';

const ICONS = ['🦋', '⚛️', '🌲', '🎯', '🚀', '🔥', '💡', '🧪', '🎨', '⚡', '📚', '🏆'];
const COLORS = [
    { value: '#6366f1', name: 'indigo' },
    { value: '#0d9488', name: 'teal' },
    { value: '#06b6d4', name: 'cyan' },
    { value: '#8b5cf6', name: 'violet' },
    { value: '#be185d', name: 'pink' }
];

function CreateGroup({ isOpen, onClose, onCreate, availableMembers = [], currentUserId, isUserOnline }) {
    const [groupName, setGroupName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('📚');
    const [selectedColor, setSelectedColor] = useState('#06b6d4');
    const [selectedMembers, setSelectedMembers] = useState([]);

    if (!isOpen) return null;

    // Filter out self and teachers from the candidate members to invite
    const candidateMembers = (availableMembers || []).filter(
        (m) => m.id !== currentUserId && (m.role || '').toUpperCase() !== 'TEACHER'
    );

    const handleToggleMember = (id) => {
        setSelectedMembers(prev =>
            prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
        );
    };

    const handleCreate = () => {
        if (!groupName.trim()) return;
        onCreate({
            name: groupName.trim(),
            icon: selectedIcon,
            color: selectedColor,
            members: selectedMembers
        });
        // Reset states
        setGroupName('');
        setSelectedIcon('📚');
        setSelectedColor('#06b6d4');
        setSelectedMembers([]);
    };

    return (
        <div className="create-group-modal-overlay" onClick={onClose}>
            <div className="create-group-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="create-group-header">
                    <h2>Create Private Study Group</h2>
                    <p>Start a private group for projects and peer study. Only invited members can see and join this group.</p>
                </div>

                <div className="create-group-form-field">
                    <label className="field-label-text">Group Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Mobile App Project Team"
                        className="create-group-text-input"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="create-group-pickers-row">
                    {/* Icon Picker */}
                    <div className="picker-block icon-selector-block">
                        <label className="field-label-text">Icon</label>
                        <div className="icons-selection-grid">
                            {ICONS.map(icon => (
                                <button
                                    key={icon}
                                    type="button"
                                    className={`icon-grid-item-btn ${selectedIcon === icon ? 'selected' : ''}`}
                                    onClick={() => setSelectedIcon(icon)}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="picker-block color-selector-block">
                        <label className="field-label-text">Color</label>
                        <div className="colors-selection-list">
                            {COLORS.map(color => (
                                <button
                                    key={color.value}
                                    type="button"
                                    className={`color-list-dot-btn ${selectedColor === color.value ? 'selected' : ''}`}
                                    style={{ '--accent-color-dot': color.value }}
                                    onClick={() => setSelectedColor(color.value)}
                                    aria-label={color.name}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="create-group-members-area">
                    <label className="field-label-text">
                        Invite Students <span className="selected-members-counter">({selectedMembers.length} selected)</span>
                    </label>
                    <div className="members-scrollable-container">
                        {candidateMembers.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                No other students enrolled in this class yet. You can still create the group now.
                            </div>
                        ) : (
                            candidateMembers.map(member => {
                                const isChecked = selectedMembers.includes(member.id);
                                const online = isUserOnline ? isUserOnline(member.id) : false;
                                return (
                                    <div
                                        key={member.id}
                                        className={`member-selection-row ${isChecked ? 'active' : ''}`}
                                        onClick={() => handleToggleMember(member.id)}
                                    >
                                        <div className="member-avatar-badge" style={{ backgroundColor: member.avatarBg || '#3b82f6', position: 'relative' }}>
                                            {member.initials || 'ST'}
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '-1px',
                                                    right: '-1px',
                                                    width: '9px',
                                                    height: '9px',
                                                    borderRadius: '50%',
                                                    backgroundColor: online ? '#22c55e' : '#94a3b8',
                                                    border: '2px solid #ffffff'
                                                }}
                                            />
                                        </div>
                                        <div className="member-details-column">
                                            <span className="member-row-name">{member.name || member.email}</span>
                                            <span className="member-row-status" style={{ color: online ? '#15803d' : '#94a3b8', fontWeight: 600, fontSize: '11px' }}>
                                                {online ? 'online' : 'offline'}
                                            </span>
                                        </div>
                                        <div className="member-checkbox-container">
                                            <div className={`member-checkbox-circle ${isChecked ? 'checked' : ''}`}>
                                                {isChecked && (
                                                    <Check size={10} strokeWidth={4} color="white" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="create-group-footer-actions">
                    <button type="button" className="modal-action-button cancel-button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="modal-action-button submit-button"
                        onClick={handleCreate}
                        disabled={!groupName.trim()}
                    >
                        Create Group {selectedMembers.length > 0 ? `& Invite (${selectedMembers.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroup;
