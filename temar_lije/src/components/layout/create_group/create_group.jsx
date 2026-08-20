import React from 'react';
import CreateGroupModal from '../../members/CreateGroupModal';

const ICONS = ['🦋', '⚛️', '🌲', '🎯', '🚀', '🔥', '💡', '🧪', '🎨', '⚡', '📚', '🏆'];
const COLORS = [
    { value: '#6366f1', name: 'indigo' },
    { value: '#0d9488', name: 'teal' },
    { value: '#06b6d4', name: 'cyan' },
    { value: '#8b5cf6', name: 'violet' },
    { value: '#be185d', name: 'pink' }
];

const MOCK_MEMBERS = [
    { id: 'at', name: 'Abebe Tadesse', status: 'online', initials: 'AT', avatarBg: '#8b5cf6' },
    { id: 'mh', name: 'Meron Haile', status: 'last seen 2h ago', initials: 'MH', avatarBg: '#f97316' },
    { id: 'yb', name: 'Yonas Bekele', status: 'online', initials: 'YB', avatarBg: '#0d9488' },
    { id: 'ta', name: 'Tigist Alemu', status: 'online', initials: 'TA', avatarBg: '#a855f7' }
];

function CreateGroup({ isOpen, onClose, onCreate }) {
    const [groupName, setGroupName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('📚');
    const [selectedColor, setSelectedColor] = useState('#06b6d4');
    const [selectedMembers, setSelectedMembers] = useState(['at', 'mh', 'yb']);

    if (!isOpen) return null;

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
        setSelectedMembers(['at', 'mh', 'yb']);
    };

    return (
        <div className="create-group-modal-overlay">
            <div className="create-group-modal-content">
                <div className="create-group-header">
                    <h2>Create Study Group</h2>
                    <p>Start a private group for projects, assignments, and peer study.</p>
                </div>

                <div className="create-group-form-field">
                    <label className="field-label-text">Group Name</label>
                    <input
                        type="text"
                        placeholder="e.g. packages"
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
                        Add Members <span className="selected-members-counter">({selectedMembers.length} selected)</span>
                    </label>
                    <div className="members-scrollable-container">
                        {MOCK_MEMBERS.map(member => {
                            const isChecked = selectedMembers.includes(member.id);
                            return (
                                <div
                                    key={member.id}
                                    className={`member-selection-row ${isChecked ? 'active' : ''}`}
                                    onClick={() => handleToggleMember(member.id)}
                                >
                                    <div className="member-avatar-badge" style={{ backgroundColor: member.avatarBg }}>
                                        {member.initials}
                                        <span className={`member-online-dot ${member.status === 'online' ? 'online' : 'offline'}`} />
                                    </div>
                                    <div className="member-details-column">
                                        <span className="member-row-name">{member.name}</span>
                                        <span className={`member-row-status ${member.status === 'online' ? 'online-text' : ''}`}>
                                            {member.status}
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
                        })}
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
                        Create & Invite ({selectedMembers.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
